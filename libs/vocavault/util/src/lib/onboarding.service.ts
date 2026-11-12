import { Injectable, Signal, signal, computed, effect } from '@angular/core';

const STORAGE_KEY = 'vv_onboarding';

export type OnboardingStep = 'add-word' | 'create-quiz' | 'start-quiz' | null;

export interface OnboardingContext {
  totalWords: Signal<number>;
  quizzableWords: Signal<number>;
  quizSets: Signal<number>;
  completedQuizzes: Signal<number>;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly _dismissed = signal<boolean>(this.load());

  // Live data counts, wired once from the always-mounted app shell so the
  // current step stays correct no matter which page the user is on.
  private _totalWords: Signal<number> = signal(0);
  private _quizzableWords: Signal<number> = signal(0);
  private _quizSets: Signal<number> = signal(0);
  private _completedQuizzes: Signal<number> = signal(0);

  /** Wire the live data counts that drive the first-run guidance. */
  setContext(ctx: OnboardingContext): void {
    this._totalWords = ctx.totalWords;
    this._quizzableWords = ctx.quizzableWords;
    this._quizSets = ctx.quizSets;
    this._completedQuizzes = ctx.completedQuizzes;
  }

  /**
   * The next first-run milestone to guide the user toward, or null when the
   * loop is complete or the user dismissed guidance.
   *   add-word    no words yet
   *   create-quiz has a quizzable word but no quiz set
   *   start-quiz  has a quiz but hasn't completed one
   */
  readonly currentStep = computed<OnboardingStep>(() => {
    if (this._dismissed()) return null;
    if (this._totalWords() === 0) return 'add-word';
    if (this._quizSets() === 0) {
      return this._quizzableWords() > 0 ? 'create-quiz' : null;
    }
    if (this._completedQuizzes() === 0) return 'start-quiz';
    return null;
  });

  /** Whether the user has dismissed the first-run guidance. */
  readonly dismissed = computed(() => this._dismissed());

  constructor() {
    effect(() => {
      const dismissed = this._dismissed();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissed }));
      } catch {
        /* quota, non-critical */
      }
    });
  }

  dismiss(): void {
    this._dismissed.set(true);
  }

  private load(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      return JSON.parse(raw).dismissed ?? false;
    } catch {
      return false;
    }
  }
}
