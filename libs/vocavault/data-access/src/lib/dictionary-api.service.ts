import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';

export interface DefinitionMeaning {
  pos: string; // 'noun', 'verb', etc.
  posAbbrev: string; // 'n.', 'v.', etc.
  definition: string;
  example?: string;
  pronunciation: string;
  sourceIndex: number; // 0 = primary, 1 = fallback
}

export interface DictionaryLookupResult {
  pronunciation: string;
  definition: string;
  examples: string[];
  allMeanings?: DefinitionMeaning[];
}

export class RateLimitError extends Error {
  constructor(word: string) {
    super(`Rate limited while looking up "${word}"`);
    this.name = 'RateLimitError';
  }
}

interface DictionaryApiPhonetic {
  text?: string;
  audio?: string;
}

interface DictionaryApiDefinition {
  definition: string;
  example?: string;
}

interface DictionaryApiMeaning {
  partOfSpeech: string;
  definitions: DictionaryApiDefinition[];
}

interface DictionaryApiEntry {
  word: string;
  phonetics: DictionaryApiPhonetic[];
  meanings: DictionaryApiMeaning[];
}

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
// freedictionaryapi.com has NO `api.` subdomain (that host does not resolve)
// and returns a different JSON shape than the primary — see fallbackToEntry.
const FALLBACK_API_BASE = 'https://freedictionaryapi.com/api/v1/entries/en/';
const RATE_LIMIT_COOLDOWN_MS = 30_000;
const CACHE_MAX_SIZE = 200;

import { POS_ABBREVS } from './pos-abbreviations';
import { normalizeHeadword } from './normalize-term';

// ── Fallback API (freedictionaryapi.com) response shape ──────────────
// Deliberately different from DictionaryApiEntry; fallbackToEntry() adapts it.
interface FreeDictPronunciation {
  type?: string;
  text?: string;
}
interface FreeDictSense {
  definition?: string;
  examples?: string[];
}
interface FreeDictEntry {
  partOfSpeech?: string;
  pronunciations?: FreeDictPronunciation[];
  senses?: FreeDictSense[];
}
interface FreeDictResponse {
  word?: string;
  entries?: FreeDictEntry[];
}

@Injectable({ providedIn: 'root' })
export class DictionaryApiService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, DictionaryLookupResult>();

  private primaryRateLimited = false;
  private primaryCooldownUntil = 0;

  async lookupWord(
    word: string,
    options?: { bulkMode?: boolean },
  ): Promise<DictionaryLookupResult> {
    const trimmed = word.trim();
    if (!trimmed) {
      throw new Error('Please enter a word to look up');
    }

    // Defense-in-depth: strip any list marker ("1. apple") before querying,
    // regardless of how the term reached us (import, manual entry, retry).
    const headword = normalizeHeadword(trimmed);
    const encoded = encodeURIComponent(headword.toLowerCase());

    const cached = this.cache.get(encoded);
    if (cached) return cached;

    if (this.primaryRateLimited && Date.now() >= this.primaryCooldownUntil) {
      this.primaryRateLimited = false;
    }

    const result = options?.bulkMode
      ? await this.lookupBulkMode(encoded, trimmed)
      : await this.lookupSingleMode(encoded, trimmed);

    this.cacheResult(encoded, result);
    return result;
  }

  /** Bulk mode: primary first, fallback on 429 or 404 */
  private async lookupBulkMode(
    encoded: string,
    word: string,
  ): Promise<DictionaryLookupResult> {
    if (!this.primaryRateLimited) {
      try {
        const result = await this.lookupFrom(API_BASE, encoded, word);
        if (!result.definition) {
          return await this.lookupFrom(FALLBACK_API_BASE, encoded, word);
        }
        return result;
      } catch (error) {
        if (error instanceof RateLimitError) {
          this.primaryRateLimited = true;
          this.primaryCooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        } else if (this.isNotFoundError(error)) {
          return this.lookupFrom(FALLBACK_API_BASE, encoded, word);
        } else {
          throw error;
        }
      }
    }
    return this.lookupFrom(FALLBACK_API_BASE, encoded, word);
  }

  private isNotFoundError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('Word not found');
  }

  /** Single mode: try both APIs in parallel, merge for richer results */
  private async lookupSingleMode(
    encoded: string,
    word: string,
  ): Promise<DictionaryLookupResult> {
    const primaryPromise = this.primaryRateLimited
      ? Promise.reject(new RateLimitError(word))
      : this.lookupFrom(API_BASE, encoded, word, 0);

    const fallbackPromise = this.lookupFrom(
      FALLBACK_API_BASE,
      encoded,
      word,
      1,
    );

    const [primarySettled, fallbackSettled] = await Promise.allSettled([
      primaryPromise,
      fallbackPromise,
    ]);

    const primary =
      primarySettled.status === 'fulfilled' ? primarySettled.value : null;
    const fallback =
      fallbackSettled.status === 'fulfilled' ? fallbackSettled.value : null;

    if (
      primarySettled.status === 'rejected' &&
      primarySettled.reason instanceof RateLimitError &&
      !this.primaryRateLimited
    ) {
      this.primaryRateLimited = true;
      this.primaryCooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    }

    if (primary || fallback) {
      const allMeanings = this.deduplicateMeanings([
        ...(primary?.allMeanings ?? []),
        ...(fallback?.allMeanings ?? []),
      ]);
      const merged = this.mergeResults(primary, fallback);
      merged.allMeanings = allMeanings;
      return merged;
    }

    const primaryErr =
      primarySettled.status === 'rejected' ? primarySettled.reason : null;
    const fallbackErr =
      fallbackSettled.status === 'rejected' ? fallbackSettled.reason : null;

    if (fallbackErr && !(fallbackErr instanceof RateLimitError))
      throw fallbackErr;
    if (primaryErr && !(primaryErr instanceof RateLimitError)) throw primaryErr;
    throw primaryErr ?? fallbackErr;
  }

  private async lookupFrom(
    baseUrl: string,
    encoded: string,
    word: string,
    sourceIndex?: 0 | 1,
  ): Promise<DictionaryLookupResult> {
    const url = `${baseUrl}${encoded}`;
    const isFallback = baseUrl === FALLBACK_API_BASE;

    try {
      const response = await firstValueFrom(
        this.http.get<unknown>(url).pipe(timeout(10000)),
      );

      const entry = isFallback
        ? this.fallbackToEntry(response as FreeDictResponse)
        : (response as DictionaryApiEntry[] | null)?.[0];

      if (isFallback) {
        // freedictionaryapi returns HTTP 200 with { entries: [] } for unknown
        // words (not a 404), so an empty result IS a "not found".
        if (!entry || entry.meanings.length === 0) {
          throw new Error('Word not found. Try a different spelling.');
        }
      } else if (!entry || !Array.isArray(entry.meanings)) {
        throw new Error('Unexpected response from dictionary API');
      }

      const normalized = this.normalizeEntry(entry);
      if (sourceIndex !== undefined) {
        normalized.allMeanings = this.extractAllMeanings(entry, sourceIndex);
      }
      return normalized;
    } catch (error: unknown) {
      if (error instanceof TimeoutError) {
        throw new Error('Dictionary lookup timed out. Please try again.');
      }
      if (error instanceof HttpErrorResponse) {
        if (error.status === 429) {
          throw new RateLimitError(word);
        }
        if (error.status === 404) {
          throw new Error('Word not found. Try a different spelling.');
        }
        if (error.status === 0) {
          throw new Error(
            'Could not connect to dictionary. Check your internet connection.',
          );
        }
      }
      if (error instanceof RateLimitError) {
        throw error;
      }
      if (error instanceof Error) throw error;
      throw new Error('Dictionary lookup failed.');
    }
  }

  /**
   * Adapt the fallback API's shape into the primary's DictionaryApiEntry so all
   * downstream normalization (normalizeEntry / extractAllMeanings / merge) is
   * reused unchanged. Each fallback entry is one part-of-speech; we fold them
   * into a single synthetic entry whose meanings[] mirrors the primary.
   * Meanings with no usable definition are dropped so an empty result is
   * correctly treated as "not found" by the caller.
   */
  private fallbackToEntry(data: FreeDictResponse): DictionaryApiEntry {
    const entries = data?.entries ?? [];

    const phonetics: DictionaryApiPhonetic[] = [];
    for (const entry of entries) {
      for (const p of entry.pronunciations ?? []) {
        if (p.text) phonetics.push({ text: p.text });
      }
    }

    const meanings: DictionaryApiMeaning[] = entries
      .map((entry) => ({
        partOfSpeech: entry.partOfSpeech ?? '',
        definitions: (entry.senses ?? [])
          .filter((s): s is FreeDictSense & { definition: string } =>
            Boolean(s.definition?.trim()),
          )
          .map((s) => ({ definition: s.definition, example: s.examples?.[0] })),
      }))
      .filter((m) => m.definitions.length > 0);

    return { word: data?.word ?? '', phonetics, meanings };
  }

  private normalizeEntry(entry: DictionaryApiEntry): DictionaryLookupResult {
    const pronunciation =
      entry.phonetics?.find((p) => p.text && p.text.length > 0)?.text ?? '';

    const definitions: string[] = [];
    for (const meaning of entry.meanings) {
      const firstDef = meaning.definitions?.[0]?.definition;
      if (firstDef) {
        const pos =
          POS_ABBREVS[meaning.partOfSpeech.toLowerCase()] ??
          `${meaning.partOfSpeech}.`;
        definitions.push(`${pos} ${firstDef}`);
      }
    }
    const definition = definitions.join(' · ') || '';

    const examples: string[] = [];
    for (const meaning of entry.meanings) {
      for (const def of meaning.definitions ?? []) {
        if (def.example && examples.length < 5) {
          examples.push(def.example);
        }
      }
    }

    return { pronunciation, definition, examples };
  }

  private mergeResults(
    primary: DictionaryLookupResult | null,
    fallback: DictionaryLookupResult | null,
  ): DictionaryLookupResult {
    // The sole caller (lookupSingleMode) only invokes this inside
    // `if (primary || fallback)`, so both-null is unreachable in practice.
    // We keep this as a defensive guard that fails loud rather than returning
    // a null typed as non-null (the pre-lint `return fallback!` behavior).
    if (!primary && !fallback) throw new Error('mergeResults: both primary and fallback are null');
    if (!primary) return fallback as DictionaryLookupResult;
    if (!fallback) return primary;

    const pronunciation =
      primary.pronunciation.length >= fallback.pronunciation.length
        ? primary.pronunciation
        : fallback.pronunciation;

    const definition = this.mergeDefinitions(
      primary.definition,
      fallback.definition,
    );

    const seen = new Set<string>();
    const examples: string[] = [];
    for (const ex of [...primary.examples, ...fallback.examples]) {
      const key = ex.toLowerCase();
      if (!seen.has(key) && examples.length < 5) {
        seen.add(key);
        examples.push(ex);
      }
    }

    return { pronunciation, definition, examples };
  }

  private mergeDefinitions(a: string, b: string): string {
    if (a === b || !b) return a;
    if (!a) return b;
    if (a.includes(b)) return a;
    if (b.includes(a)) return b;
    return `${a} · ${b}`;
  }

  private extractAllMeanings(
    entry: DictionaryApiEntry,
    sourceIndex: 0 | 1,
  ): DefinitionMeaning[] {
    const pronunciation =
      entry.phonetics?.find((p) => p.text && p.text.length > 0)?.text ?? '';
    const meanings: DefinitionMeaning[] = [];
    for (const meaning of entry.meanings ?? []) {
      const pos = meaning.partOfSpeech?.toLowerCase() ?? '';
      const posAbbrev = POS_ABBREVS[pos] ?? `${pos}.`;
      for (const def of meaning.definitions ?? []) {
        if (!def.definition?.trim()) continue;
        meanings.push({
          pos,
          posAbbrev,
          definition: def.definition,
          example: def.example,
          pronunciation,
          sourceIndex,
        });
      }
    }
    return meanings;
  }

  private deduplicateMeanings(meanings: DefinitionMeaning[]): DefinitionMeaning[] {
    const seen = new Set<string>();
    return meanings.filter((m) => {
      const key = `${m.pos}|${m.definition.toLowerCase().trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private cacheResult(key: string, result: DictionaryLookupResult): void {
    if (this.cache.size >= CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, result);
  }
}
