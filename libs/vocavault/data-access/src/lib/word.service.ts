import { Injectable, inject, computed } from '@angular/core';
import { StorageService } from './storage.service';
import { Word, MasteryLevel, SR_DEFAULTS, FlagReason } from './models';
import { persistedSignal } from './persisted-signal';

const WORDS_KEY = 'vv_words';

/** A word is incomplete if it's missing key fields or word/definition are identical. */
function isIncomplete(word: string, definition: string): boolean {
  if (!word?.trim() || !definition?.trim()) return true;
  return word.trim().toLowerCase() === definition.trim().toLowerCase();
}

@Injectable({ providedIn: 'root' })
export class WordService {
  private readonly storage = inject(StorageService);
  private readonly _store = persistedSignal<Word[]>(this.storage, WORDS_KEY, [], {
    migrate: (words) => words.map((w) => ({
      ...w,
      incomplete: isIncomplete(w.word, w.definition) || undefined,
      interval: w.interval ?? SR_DEFAULTS.interval,
      easeFactor: w.easeFactor ?? SR_DEFAULTS.easeFactor,
      reviewCount: w.reviewCount ?? SR_DEFAULTS.reviewCount,
    })),
  });

  readonly words = this._store.value;

  /** Words that have both a term and definition — safe to quiz. */
  readonly quizzableWords = computed(() =>
    this.words().filter((w) => !w.incomplete)
  );

  readonly toughWords = computed(() =>
    this.words().filter(
      (w) =>
        w.reviewCount > 0 &&
        w.masteryLevel === MasteryLevel.Learning &&
        w.easeFactor < SR_DEFAULTS.easeFactor
    )
  );

  readonly flaggedWords = computed(() =>
    this.words().filter((w) => w.flag != null)
  );

  flagWord(id: string, reason?: FlagReason): boolean {
    const word = this.getWord(id);
    if (!word) return false;
    return this.updateWord(id, {
      flag: { reason, flaggedAt: new Date() },
    });
  }

  unflagWord(id: string): boolean {
    const word = this.getWord(id);
    if (!word) return false;
    return this.updateWord(id, { flag: undefined });
  }

  addWord(
    data: Omit<Word, 'id' | 'masteryLevel' | 'createdAt' | 'updatedAt' | 'interval' | 'easeFactor' | 'reviewCount' | 'lastReviewedAt' | 'nextReviewDate'>
  ): { word: Word; ok: boolean } {
    const word: Word = {
      ...data,
      incomplete: data.incomplete || isIncomplete(data.word, data.definition) || undefined,
      id: crypto.randomUUID(),
      masteryLevel: MasteryLevel.New,
      createdAt: new Date(),
      updatedAt: new Date(),
      interval: SR_DEFAULTS.interval,
      easeFactor: SR_DEFAULTS.easeFactor,
      reviewCount: SR_DEFAULTS.reviewCount,
    };
    const ok = this._store.update((ws) => [...ws, word]);
    return { word, ok };
  }

  addWords(
    items: Array<Omit<Word, 'id' | 'masteryLevel' | 'createdAt' | 'updatedAt' | 'interval' | 'easeFactor' | 'reviewCount' | 'lastReviewedAt' | 'nextReviewDate'>>
  ): { words: Word[]; ok: boolean } {
    const now = new Date();
    const words: Word[] = items.map((data) => ({
      ...data,
      incomplete: data.incomplete || isIncomplete(data.word, data.definition) || undefined,
      id: crypto.randomUUID(),
      masteryLevel: MasteryLevel.New,
      createdAt: now,
      updatedAt: now,
      interval: SR_DEFAULTS.interval,
      easeFactor: SR_DEFAULTS.easeFactor,
      reviewCount: SR_DEFAULTS.reviewCount,
    }));
    const ok = this._store.update((ws) => [...ws, ...words]);
    return { words, ok };
  }

  updateWord(
    id: string,
    changes: Partial<Omit<Word, 'id' | 'createdAt'>>
  ): boolean {
    return this._store.update((ws) =>
      ws.map((w) => {
        if (w.id !== id) return w;
        const merged = { ...w, ...changes, updatedAt: new Date() };
        merged.incomplete = isIncomplete(merged.word, merged.definition) || undefined;
        return merged;
      })
    );
  }

  deleteWord(id: string): boolean {
    return this._store.update((ws) => ws.filter((w) => w.id !== id));
  }

  deleteWords(ids: Set<string>): boolean {
    return this._store.update((ws) => ws.filter((w) => !ids.has(w.id)));
  }

  /** Re-insert a previously deleted word (for undo). */
  restoreWord(word: Word): boolean {
    return this._store.update((ws) => [...ws, word]);
  }

  /** Re-insert multiple previously deleted words (for undo). */
  restoreWords(words: Word[]): boolean {
    return this._store.update((ws) => [...ws, ...words]);
  }

  getWord(id: string): Word | undefined {
    return this._store.value().find((w) => w.id === id);
  }
}
