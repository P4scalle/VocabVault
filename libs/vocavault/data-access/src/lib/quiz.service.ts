import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { MasteryLevel, QuizSet, Word } from './models';
import { WordService } from './word.service';
import { persistedSignal } from './persisted-signal';
import { ISO_DATE_RE } from './serialization';
import { shuffle } from '@vocavault/util';

const QUIZ_SETS_KEY = 'vv_quiz_sets';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private readonly storage = inject(StorageService);
  private readonly wordService = inject(WordService);
  private readonly _store = persistedSignal<QuizSet[]>(this.storage, QUIZ_SETS_KEY, []);

  readonly quizSets = this._store.value;

  addQuizSet(
    data: Omit<QuizSet, 'id' | 'createdAt' | 'updatedAt'>
  ): { quizSet: QuizSet; ok: boolean } {
    const quizSet: QuizSet = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const ok = this._store.update((qs) => [...qs, quizSet]);
    return { quizSet, ok };
  }

  updateQuizSet(
    id: string,
    changes: Partial<Omit<QuizSet, 'id' | 'createdAt'>>
  ): boolean {
    return this._store.update((qs) =>
      qs.map((q) =>
        q.id === id ? { ...q, ...changes, updatedAt: new Date() } : q
      )
    );
  }

  deleteQuizSet(id: string): boolean {
    return this._store.update((qs) => qs.filter((q) => q.id !== id));
  }

  /** Re-insert a previously deleted quiz set (for undo). */
  restoreQuizSet(quizSet: QuizSet): boolean {
    return this._store.update((qs) => [...qs, quizSet]);
  }

  private static readonly TEMP_KEY = 'vv_temp_quiz_set';
  private _tempQuizSet: QuizSet | null = null;

  private static readonly QUIZ_MODES = ['flashcard', 'multiple-choice', 'type', 'match'] as const;
  private static readonly QUICK_QUIZ_LIMIT = 20;
  static readonly SESSION_SIZE = 20;
  private static readonly NEW_WORDS_PER_SESSION = 10;

  createTempQuizSet(wordIds: string[], name = 'Smart Review', id = '__smart_review__'): QuizSet {
    this._tempQuizSet = {
      id,
      name,
      description: 'Auto-generated temporary quiz set',
      wordIds,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.saveTempToSession(this._tempQuizSet);
    return this._tempQuizSet;
  }

  startQuickQuiz(): { quizSet: QuizSet; mode: string } {
    const wordIds = shuffle(this.wordService.quizzableWords().map((w) => w.id))
      .slice(0, QuizService.QUICK_QUIZ_LIMIT);
    const mode = QuizService.QUIZ_MODES[Math.floor(Math.random() * QuizService.QUIZ_MODES.length)];
    const quizSet = this.createTempQuizSet(wordIds, 'Quick Quiz', '__quick_quiz__');
    return { quizSet, mode };
  }

  getQuizSet(id: string): QuizSet | undefined {
    const temp = this._tempQuizSet ?? this.loadTempFromSession();
    if (temp?.id === id) return temp;
    return this._store.value().find((q) => q.id === id);
  }

  private saveTempToSession(qs: QuizSet): void {
    try { sessionStorage.setItem(QuizService.TEMP_KEY, JSON.stringify(qs)); }
    catch { /* quota or private browsing, non-critical */ }
  }

  private loadTempFromSession(): QuizSet | null {
    try {
      const raw = sessionStorage.getItem(QuizService.TEMP_KEY);
      if (!raw) return null;
      this._tempQuizSet = JSON.parse(raw, (_k, v) =>
        typeof v === 'string' && ISO_DATE_RE.test(v) ? new Date(v) : v,
      ) as QuizSet;
      return this._tempQuizSet;
    } catch { return null; }
  }

  removeWordFromAllQuizSets(wordId: string): boolean {
    return this._store.update((qs) =>
      qs.map((q) =>
        q.wordIds.includes(wordId)
          ? { ...q, wordIds: q.wordIds.filter((id) => id !== wordId), updatedAt: new Date() }
          : q
      )
    );
  }

  /** Returns quiz set IDs that contain the given word (for undo capture). */
  getQuizSetIdsForWord(wordId: string): string[] {
    return this._store.value()
      .filter((q) => q.wordIds.includes(wordId))
      .map((q) => q.id);
  }

  /** Re-add a word to the given quiz sets (for undo restore). */
  restoreWordToQuizSets(wordId: string, quizSetIds: string[]): void {
    if (quizSetIds.length === 0) return;
    const idSet = new Set(quizSetIds);
    this._store.update((qs) =>
      qs.map((q) =>
        idSet.has(q.id) && !q.wordIds.includes(wordId)
          ? { ...q, wordIds: [...q.wordIds, wordId], updatedAt: new Date() }
          : q
      )
    );
  }

  /**
   * Pick a session-sized batch from a quiz set, prioritising words that need practice.
   * Order: new (capped) → learning → review → mastered. Returns all words if set is small enough.
   */
  getSessionWords(quizSetId: string): string[] {
    const words = this.getWordsForQuizSet(quizSetId);
    if (words.length <= QuizService.SESSION_SIZE) return words.map((w) => w.id);

    const buckets: Record<MasteryLevel, string[]> = {
      [MasteryLevel.New]: [],
      [MasteryLevel.Learning]: [],
      [MasteryLevel.Review]: [],
      [MasteryLevel.Mastered]: [],
    };
    for (const w of words) buckets[w.masteryLevel].push(w.id);

    const session: string[] = [];
    const limit = QuizService.SESSION_SIZE;
    const newCap = QuizService.NEW_WORDS_PER_SESSION;

    // New words (capped to avoid cognitive overload, mixed with review for confidence)
    session.push(...shuffle(buckets[MasteryLevel.New]).slice(0, newCap));
    // Learning (got wrong before, highest review value)
    if (session.length < limit) session.push(...shuffle(buckets[MasteryLevel.Learning]).slice(0, limit - session.length));
    // Review (almost mastered, reinforce)
    if (session.length < limit) session.push(...shuffle(buckets[MasteryLevel.Review]).slice(0, limit - session.length));
    // Mastered (fill remaining, keeps confidence high)
    if (session.length < limit) session.push(...shuffle(buckets[MasteryLevel.Mastered]).slice(0, limit - session.length));
    // Backfill with remaining new if session is still short
    if (session.length < limit) {
      const remaining = shuffle(buckets[MasteryLevel.New]).filter((id) => !session.includes(id));
      session.push(...remaining.slice(0, limit - session.length));
    }

    return shuffle(session);
  }

  getSessionInfo(quizSetId: string): { totalWords: number; practicedWords: number; totalSessions: number; needsChunking: boolean } {
    const words = this.getWordsForQuizSet(quizSetId);
    const totalWords = words.length;
    const practicedWords = words.filter((w) => w.masteryLevel !== MasteryLevel.New).length;
    const totalSessions = Math.ceil(totalWords / QuizService.SESSION_SIZE);
    return { totalWords, practicedWords, totalSessions, needsChunking: totalWords > QuizService.SESSION_SIZE };
  }

  getWordsForQuizSet(quizSetId: string): Word[] {
    const qs = this.getQuizSet(quizSetId);
    if (!qs) return [];
    return qs.wordIds
      .map((id) => this.wordService.getWord(id))
      .filter((w): w is Word => w !== undefined && !w.incomplete);
  }
}
