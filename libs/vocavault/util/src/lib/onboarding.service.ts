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
  // current step stays correct no matter which page the user is on. Held in a
  // signal (not reassigned fields) so currentStep reacts even when setContext
  // runs after the step has already been read somewhere.
  private readonly _ctx = signal<OnboardingContext | null>(null);

  /** Wire the live data counts that drive the first-run guidance. */
  setContext(ctx: OnboardingContext): void {
    this._ctx.set(ctx);
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
    const ctx = this._ctx();
    // No data wired yet: treat as a brand-new, empty dictionary.
    if (!ctx || ctx.totalWords() === 0) return 'add-word';
    if (ctx.quizSets() === 0) {
      return ctx.quizzableWords() > 0 ? 'create-quiz' : null;
    }
    if (ctx.completedQuizzes() === 0) return 'start-quiz';
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

  /**
   * Re-enable first-run guidance (undo a dismiss). Because the current step is
   * derived from live data, the contextual cues reappear for whatever milestone
   * the user is currently at; a user who has already finished the loop simply
   * sees nothing, which is correct.
   */
  reset(): void {
    this._dismissed.set(false);
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
