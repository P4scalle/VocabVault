import { Injectable, inject, signal, computed } from '@angular/core';
import { WordService } from './word.service';
import { DictionaryApiService, RateLimitError } from './dictionary-api.service';
import { BulkParseService, DetectedDelimiter } from './bulk-parse.service';
import { isPlaceholderDefinition } from './definition-validation';

export type { DetectedDelimiter } from './bulk-parse.service';

export interface ParsedRow {
  id: string;
  word: string;
  definition: string;
  pronunciation: string;
  examples: string[];
  status: 'ok' | 'missing-def' | 'duplicate';
  duplicateOf?: string;
  duplicateAction?: 'keep' | 'skip' | 'merge';
  lookupFailed?: boolean;
}

const DRAFT_KEY = 'vv_bulk_draft';
const LOOKUP_CONCURRENCY = 2;
const CHUNK_DELAY_MS = 1200;
const THROTTLED_DELAY_MS = 3000;
const RETRY_BACKOFF_MS = [5000, 10000, 15000];
const MAX_RETRY_ROUNDS = 3;

@Injectable({ providedIn: 'root' })
export class BulkImportService {
  private readonly wordService = inject(WordService);
  private readonly dictionaryApiService = inject(DictionaryApiService);
  private readonly parseService = inject(BulkParseService);

  readonly rows = signal<ParsedRow[]>([]);
  readonly detectedDelimiter = signal<DetectedDelimiter | string>('');
  readonly mixedSeparators = signal<DetectedDelimiter[]>([]);
  // Auto-synced from detection unless user has explicitly toggled.
  readonly wordsOnlyMode = signal(false);
  // True when the parser found no delimiter in the input.
  readonly detectedWordsOnly = signal(false);
  // Prevents auto-sync from overwriting after user explicitly toggles.
  private userToggledMode = false;
  // Preserves raw input so "Back to editing" can restore the textarea.
  readonly lastInputText = signal('');
  readonly lookupServiceError = signal(false);
  readonly lookupProgress = signal<{ current: number; total: number } | null>(null);
  readonly currentLookupWord = signal<string>('');
  readonly lastLookupResult = signal<{ found: number; notFound: number } | null>(null);
  readonly lookupResults = signal<Array<{ word: string; found: boolean }>>([]);

  readonly retryRound = signal(0);
  readonly retryCountdown = signal(0);
  readonly retriableCount = signal(0);

  readonly readyCount = computed(() => this.rows().filter((r) => r.status === 'ok').length);
  readonly amberCount = computed(() => this.rows().filter((r) => r.status === 'missing-def').length);
  readonly redCount = computed(() => this.rows().filter((r) => r.status === 'duplicate').length);
  readonly importableCount = computed(() =>
    this.rows().filter((r) => {
      if (r.status === 'duplicate') {
        return r.duplicateAction === 'keep' || r.duplicateAction === 'merge';
      }
      // Words without definitions are never importable — they must be looked up or filled in manually
      return r.status === 'ok';
    }).length
  );

  private lookupAbort: AbortController | null = null;

  private syncDetectedMode(wordsOnly: boolean): void {
    this.detectedWordsOnly.set(wordsOnly);
    if (!this.userToggledMode) {
      this.wordsOnlyMode.set(wordsOnly);
    }
  }

  toggleWordsOnlyMode(): void {
    this.userToggledMode = true;
    this.wordsOnlyMode.update(v => !v);
  }

  parseText(text: string, overrideDelimiter?: DetectedDelimiter | string): void {
    this.lastInputText.set(text);
    const result = this.parseService.parseText(text, overrideDelimiter);
    this.detectedDelimiter.set(result.delimiter);
    this.mixedSeparators.set(result.mixedSeparators);
    if (!overrideDelimiter) {
      this.syncDetectedMode(result.wordsOnly);
    }
    this.buildRows(result.data);
  }

  async parseFile(file: File): Promise<{ ok: boolean; error?: string }> {
    const result = await this.parseService.parseFile(file);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    this.detectedDelimiter.set(result.result.delimiter);
    this.mixedSeparators.set(result.result.mixedSeparators);
    this.syncDetectedMode(result.result.wordsOnly);
    this.buildRows(result.result.data);
    return { ok: true };
  }

  private buildRows(data: string[][]): void {
    const parsedRows: ParsedRow[] = data
      .filter((row) => row.length > 0 && (row[0]?.trim()))
      .map((row) => {
        const word = (row[0] != null ? String(row[0]) : '').trim().replace(/\s+/g, ' ');
        const definition = (row[1] != null ? String(row[1]) : '').trim().replace(/\s+/g, ' ');
        // A word is only "ok" if it has a real, non-placeholder definition
        const status: ParsedRow['status'] =
          definition && !isPlaceholderDefinition(definition) ? 'ok' : 'missing-def';
        return {
          id: crypto.randomUUID(),
          word,
          definition,
          pronunciation: '',
          examples: [],
          status,
        };
      });

    this.rows.set(this.detectDuplicates(parsedRows));
  }

  private detectDuplicates(parsedRows: ParsedRow[]): ParsedRow[] {
    const existingWords = this.wordService.words();
    const existingMap = new Map<string, string>();
    for (const w of existingWords) {
      existingMap.set(w.word.toLowerCase().trim(), w.id);
    }

    // Track words seen within this import batch
    const seenInImport = new Map<string, string>();

    return parsedRows.map((row) => {
      const key = row.word.toLowerCase().trim();
      if (!key) return row;

      if (existingMap.has(key)) {
        return { ...row, status: 'duplicate' as const, duplicateOf: existingMap.get(key) };
      }
      if (seenInImport.has(key)) {
        return { ...row, status: 'duplicate' as const, duplicateOf: seenInImport.get(key) };
      }
      seenInImport.set(key, row.id);
      return row;
    });
  }

  updateRow(id: string, changes: Partial<ParsedRow>): void {
    this.rows.update((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row;

        let updated = { ...row, ...changes };

        // If definition is being added to a missing-def row, promote to ok
        // Promote missing-def -> ok only when definition is real (not a placeholder)
        if (
          changes.definition !== undefined &&
          changes.definition.trim() &&
          !isPlaceholderDefinition(changes.definition) &&
          row.status === 'missing-def'
        ) {
          updated = { ...updated, status: 'ok' };
        }
        // Demote ok -> missing-def when definition is cleared
        if (
          changes.definition !== undefined &&
          !changes.definition.trim() &&
          row.status === 'ok'
        ) {
          updated = { ...updated, status: 'missing-def' };
        }

        return updated;
      })
    );
  }

  resolveDuplicate(id: string, action: 'keep' | 'skip' | 'merge'): void {
    this.rows.update((rows) =>
      rows.map((row) =>
        row.id === id ? { ...row, duplicateAction: action } : row
      )
    );
  }

  skipAllDuplicates(): void {
    this.rows.update((rows) =>
      rows.map((row) =>
        row.status === 'duplicate' ? { ...row, duplicateAction: 'skip' } : row
      )
    );
  }

  /**
   * Returns importable words separated into newWords (to add) and mergeWords (to update).
   * - newWords: ok rows + wordsOnly rows + keep-resolved duplicates
   * - mergeWords: merge-resolved duplicates
   * - Skipped duplicates are excluded from both lists
   */
  getImportableWords(): {
    newWords: Array<{
      word: string;
      definition: string;
      pronunciation: string;
      examples: string[];
      incomplete?: boolean;
      folderId?: string;
    }>;
    mergeWords: Array<{
      duplicateOf: string;
      definition: string;
      pronunciation: string;
      examples: string[];
    }>;
  } {
    const newWords: ReturnType<typeof this.getImportableWords>['newWords'] = [];
    const mergeWords: ReturnType<typeof this.getImportableWords>['mergeWords'] = [];

    for (const row of this.rows()) {
      if (row.status === 'duplicate') {
        if (row.duplicateAction === 'skip') continue;
        if (row.duplicateAction === 'merge' && row.duplicateOf) {
          mergeWords.push({
            duplicateOf: row.duplicateOf,
            definition: row.definition,
            pronunciation: row.pronunciation,
            examples: row.examples,
          });
          continue;
        }
        // keep or unresolved duplicates — treat as new
      }

      const incomplete = !row.definition || row.word.trim().toLowerCase() === row.definition.trim().toLowerCase() ? true : undefined;
      newWords.push({
        word: row.word,
        definition: row.definition,
        pronunciation: row.pronunciation,
        examples: row.examples,
        incomplete,
      });
    }

    return { newWords, mergeWords };
  }

  private delay(ms: number, abortSignal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (abortSignal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const timer = setTimeout(() => {
        abortSignal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      abortSignal.addEventListener('abort', onAbort, { once: true });
    });
  }

  async lookupAll(): Promise<{ found: number; notFound: number }> {
    this.lookupServiceError.set(false);
    this.lookupProgress.set({ current: 0, total: 0 });
    this.lookupResults.set([]);
    this.lastLookupResult.set(null);
    this.retryRound.set(0);
    this.retryCountdown.set(0);
    this.retriableCount.set(0);
    this.lookupAbort?.abort();

    const abort = new AbortController();
    this.lookupAbort = abort;

    const missingRows = this.rows().filter((r) => r.status === 'missing-def');
    let found = 0;
    let notFound = 0;
    let completed = 0;
    const rateLimitedIds = new Set<string>();

    this.lookupProgress.set({ current: 0, total: missingRows.length });

    const pendingUpdates = new Map<string, Partial<ParsedRow>>();

    const doLookup = async (row: ParsedRow): Promise<void> => {
      if (abort.signal.aborted) return;
      this.currentLookupWord.set(row.word);

      try {
        const result = await this.dictionaryApiService.lookupWord(row.word, { bulkMode: true });
        if (abort.signal.aborted) return;
        pendingUpdates.set(row.id, {
          definition: result.definition,
          pronunciation: result.pronunciation,
          examples: result.examples,
          status: 'ok',
        });
        found++;
        this.lookupResults.update(r => [...r, { word: row.word, found: true }]);
      } catch (error) {
        if (error instanceof RateLimitError) {
          rateLimitedIds.add(row.id);
        } else {
          pendingUpdates.set(row.id, { lookupFailed: true });
          notFound++;
          this.lookupResults.update(r => [...r, { word: row.word, found: false }]);
        }
      }

      completed++;
      this.lookupProgress.set({ current: completed, total: missingRows.length });
    };

    // Process in chunks — adaptive delay increases when rate-limited
    let chunkDelay = CHUNK_DELAY_MS;
    for (let i = 0; i < missingRows.length; i += LOOKUP_CONCURRENCY) {
      if (abort.signal.aborted) break;
      const chunk = missingRows.slice(i, i + LOOKUP_CONCURRENCY);
      const prevRateLimited = rateLimitedIds.size;
      await Promise.all(chunk.map(doLookup));

      // If this chunk triggered new rate limits, slow down for the rest
      if (rateLimitedIds.size > prevRateLimited) {
        chunkDelay = THROTTLED_DELAY_MS;
      }

      // Flush pending updates in a single batch
      if (pendingUpdates.size > 0) {
        const updates = new Map(pendingUpdates);
        pendingUpdates.clear();
        this.rows.update((rows) =>
          rows.map((r) => {
            const upd = updates.get(r.id);
            return upd ? { ...r, ...upd } : r;
          })
        );
      }

      // Inter-chunk delay to avoid triggering rate limits
      if (i + LOOKUP_CONCURRENCY < missingRows.length && !abort.signal.aborted) {
        try {
          await this.delay(chunkDelay, abort.signal);
        } catch {
          break; // aborted
        }
      }
    }

    // Retry loop for rate-limited words
    if (rateLimitedIds.size > 0 && !abort.signal.aborted) {
      const allRows = this.rows();
      const rowMap = new Map(allRows.map(r => [r.id, r]));

      for (let round = 0; round < MAX_RETRY_ROUNDS; round++) {
        if (abort.signal.aborted || rateLimitedIds.size === 0) break;

        const backoffMs = RETRY_BACKOFF_MS[round];
        this.retryRound.set(round + 1);
        this.retriableCount.set(rateLimitedIds.size);

        // Countdown
        const countdownSeconds = Math.ceil(backoffMs / 1000);
        for (let s = countdownSeconds; s > 0; s--) {
          if (abort.signal.aborted) break;
          this.retryCountdown.set(s);
          try {
            await this.delay(1000, abort.signal);
          } catch {
            break; // aborted
          }
        }
        this.retryCountdown.set(0);

        if (abort.signal.aborted) break;

        // Build retry list from current rate-limited IDs
        const retryRows = Array.from(rateLimitedIds)
          .map(id => rowMap.get(id))
          .filter((r): r is ParsedRow => r !== undefined);

        let retryCompleted = 0;
        this.lookupProgress.set({ current: 0, total: retryRows.length });

        const retryPending = new Map<string, Partial<ParsedRow>>();

        const doRetryLookup = async (row: ParsedRow): Promise<void> => {
          if (abort.signal.aborted) return;
          this.currentLookupWord.set(row.word);

          try {
            const result = await this.dictionaryApiService.lookupWord(row.word, { bulkMode: true });
            if (abort.signal.aborted) return;
            retryPending.set(row.id, {
              definition: result.definition,
              pronunciation: result.pronunciation,
              examples: result.examples,
              status: 'ok',
            });
            rateLimitedIds.delete(row.id);
            found++;
            this.lookupResults.update(r => [...r, { word: row.word, found: true }]);
          } catch (error) {
            if (error instanceof RateLimitError) {
              // stays in rateLimitedIds for next round
            } else {
              retryPending.set(row.id, { lookupFailed: true });
              rateLimitedIds.delete(row.id);
              notFound++;
              this.lookupResults.update(r => [...r, { word: row.word, found: false }]);
            }
          }

          retryCompleted++;
          this.lookupProgress.set({ current: retryCompleted, total: retryRows.length });
        };

        // Process retry rows in chunks
        for (let i = 0; i < retryRows.length; i += LOOKUP_CONCURRENCY) {
          if (abort.signal.aborted) break;
          const chunk = retryRows.slice(i, i + LOOKUP_CONCURRENCY);
          await Promise.all(chunk.map(doRetryLookup));

          // Flush retry updates
          if (retryPending.size > 0) {
            const updates = new Map(retryPending);
            retryPending.clear();
            this.rows.update((rows) =>
              rows.map((r) => {
                const upd = updates.get(r.id);
                return upd ? { ...r, ...upd } : r;
              })
            );
          }

          if (i + LOOKUP_CONCURRENCY < retryRows.length && !abort.signal.aborted) {
            try {
              await this.delay(CHUNK_DELAY_MS, abort.signal);
            } catch {
              break; // aborted
            }
          }
        }
      }
    }

    // Any remaining rate-limited words: mark as failed
    if (rateLimitedIds.size > 0) {
      this.lookupServiceError.set(true);
      this.rows.update((rows) =>
        rows.map((r) => {
          if (rateLimitedIds.has(r.id)) {
            notFound++;
            return { ...r, lookupFailed: true };
          }
          return r;
        })
      );
    }

    this.lastLookupResult.set({ found, notFound });
    this.lookupProgress.set(null);
    this.currentLookupWord.set('');
    this.retryRound.set(0);
    this.retryCountdown.set(0);
    this.retriableCount.set(0);
    this.lookupAbort = null;
    return { found, notFound };
  }

  async lookupOne(id: string): Promise<boolean> {
    const row = this.rows().find((r) => r.id === id);
    if (!row) return false;

    this.currentLookupWord.set(row.word);
    try {
      const result = await this.dictionaryApiService.lookupWord(row.word);
      this.updateRow(id, {
        definition: result.definition,
        pronunciation: result.pronunciation,
        examples: result.examples,
        status: 'ok',
        lookupFailed: false,
      });
      this.currentLookupWord.set('');
      return true;
    } catch {
      this.updateRow(id, { lookupFailed: true });
      this.currentLookupWord.set('');
      return false;
    }
  }

  abortLookup(): void {
    this.lookupAbort?.abort();
    this.lookupAbort = null;
    this.lookupProgress.set(null);
    this.currentLookupWord.set('');
    this.retryRound.set(0);
    this.retryCountdown.set(0);
    this.retriableCount.set(0);
  }

  saveDraft(): void {
    try {
      const data = {
        rows: this.rows(),
        delimiter: this.detectedDelimiter(),
        inputText: this.lastInputText(),
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {
      /* quota exceeded -- silently ignore */
    }
  }

  /** Returns true if rows were restored. */
  restoreDraft(): boolean {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as { rows: ParsedRow[]; delimiter: string; inputText?: string };
      if (data.rows?.length > 0) {
        this.rows.set(data.rows);
        // Re-validate duplicates against current dictionary state
        this.rows.update((rows) => this.detectDuplicates(rows));
        this.detectedDelimiter.set((data.delimiter ?? '') as DetectedDelimiter);
        if (data.inputText) this.lastInputText.set(data.inputText);
        return true;
      }
    } catch {
      /* corrupted data -- ignore */
    }
    return false;
  }

  clearDraft(): void {
    sessionStorage.removeItem(DRAFT_KEY);
  }

  reset(): void {
    this.abortLookup();
    this.lookupServiceError.set(false);
    this.rows.set([]);
    this.detectedDelimiter.set('');
    this.mixedSeparators.set([]);
    this.wordsOnlyMode.set(false);
    this.detectedWordsOnly.set(false);
    this.userToggledMode = false;
    this.lookupProgress.set(null);
    this.currentLookupWord.set('');
    this.lastInputText.set('');
    this.lastLookupResult.set(null);
    this.lookupResults.set([]);
    this.retryRound.set(0);
    this.retryCountdown.set(0);
    this.retriableCount.set(0);
    this.clearDraft();
  }
}
