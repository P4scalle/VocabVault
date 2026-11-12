import { Injectable, inject, computed } from '@angular/core';
import { WordService } from './word.service';
import { MasteryLevel, MASTERY_WEIGHTS, QuizResult } from './models';
import { StorageService } from './storage.service';
import { persistedSignal } from './persisted-signal';

const RESULTS_KEY = 'vv_quiz_results';
const SNAPSHOTS_KEY = 'vv_progress_snapshots';
const STREAK_KEY = 'vv_streak';

export interface WeeklySnapshot {
  weekStart: string; // ISO date string (Monday)
  wordsAdded: number;
  wordsLearned: number;
  quizzesTaken: number;
  accuracy: number;
  eloquenceScore: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // ISO date
}

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly wordService = inject(WordService);
  private readonly storage = inject(StorageService);
  private readonly _store = persistedSignal<QuizResult[]>(this.storage, RESULTS_KEY, []);
  private readonly _snapshots = persistedSignal<WeeklySnapshot[]>(this.storage, SNAPSHOTS_KEY, []);
  private readonly _streak = persistedSignal<StreakData>(this.storage, STREAK_KEY, {
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
  });

  readonly results = this._store.value;
  readonly snapshots = this._snapshots.value;
  readonly streak = this._streak.value;

  readonly masteryDistribution = computed(() => {
    const result = {
      [MasteryLevel.New]: 0,
      [MasteryLevel.Learning]: 0,
      [MasteryLevel.Review]: 0,
      [MasteryLevel.Mastered]: 0,
    };
    for (const w of this.wordService.words()) {
      result[w.masteryLevel]++;
    }
    return result;
  });

  readonly eloquenceScore = computed(() => {
    const words = this.wordService.words();
    if (words.length === 0) return 0;
    let total = 0;
    for (const w of words) {
      total += MASTERY_WEIGHTS[w.masteryLevel];
    }
    return Math.round(total / words.length);
  });

  readonly wordsLearned = computed(() => {
    const dist = this.masteryDistribution();
    return dist[MasteryLevel.Review] + dist[MasteryLevel.Mastered];
  });

  readonly wordsThisWeek = computed(() => {
    const weekStart = this.getWeekStart(new Date());
    return this.wordService.words().filter(
      (w) => new Date(w.createdAt) >= weekStart,
    ).length;
  });

  readonly quizzesThisWeek = computed(() => {
    const weekStart = this.getWeekStart(new Date());
    return this.results().filter(
      (r) => new Date(r.completedAt) >= weekStart,
    ).length;
  });

  readonly weekOverWeek = computed(() => {
    const snaps = this.snapshots();
    if (snaps.length < 2) return null;
    const current = snaps[snaps.length - 1];
    const previous = snaps[snaps.length - 2];
    return {
      scoreChange: current.eloquenceScore - previous.eloquenceScore,
      wordsChange: current.wordsLearned - previous.wordsLearned,
      accuracyChange: current.accuracy - previous.accuracy,
    };
  });

  addResult(result: Omit<QuizResult, 'id' | 'completedAt'>): boolean {
    const r: QuizResult = {
      ...result,
      id: crypto.randomUUID(),
      completedAt: new Date(),
    };
    const ok = this._store.update((rs) => [...rs, r]);
    if (ok) {
      this.updateStreak();
      this.maybeSnapshot();
    }
    return ok;
  }

  /** Re-insert a previously deleted result (for data import). */
  restoreResult(result: QuizResult): boolean {
    return this._store.update((rs) => [...rs, result]);
  }

  getLatestResult(quizSetId: string): QuizResult | undefined {
    const all = this._store.value();
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].quizSetId === quizSetId) return all[i];
    }
    return undefined;
  }

  private updateStreak(): void {
    const today = new Date().toISOString().slice(0, 10);
    this._streak.update((s) => {
      if (s.lastActiveDate === today) return s;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const isConsecutive = s.lastActiveDate === yesterdayStr;
      const newStreak = isConsecutive ? s.currentStreak + 1 : 1;

      return {
        currentStreak: newStreak,
        longestStreak: Math.max(s.longestStreak, newStreak),
        lastActiveDate: today,
      };
    });
  }

  private maybeSnapshot(): void {
    const snaps = this.snapshots();
    const weekStart = this.getWeekStart(new Date()).toISOString().slice(0, 10);

    // Only one snapshot per week
    if (snaps.length > 0 && snaps[snaps.length - 1].weekStart === weekStart) return;

    const results = this.results();
    const weekResults = results.filter(
      (r) => new Date(r.completedAt) >= this.getWeekStart(new Date()),
    );

    const snapshot: WeeklySnapshot = {
      weekStart,
      wordsAdded: this.wordsThisWeek(),
      wordsLearned: this.wordsLearned(),
      quizzesTaken: weekResults.length,
      accuracy: weekResults.length > 0
        ? Math.round(weekResults.reduce((s, r) => s + r.accuracy, 0) / weekResults.length)
        : 0,
      eloquenceScore: this.eloquenceScore(),
    };

    // Keep last 12 weeks
    this._snapshots.update((ss) => [...ss.slice(-11), snapshot]);
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
