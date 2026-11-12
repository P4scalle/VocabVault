import { Injectable, Signal, signal, computed, effect } from '@angular/core';

const STORAGE_KEY = 'vv_onboarding';

interface OnboardingState {
  dismissed: boolean;
  firstQuizDone: boolean;
}

const DEFAULTS: OnboardingState = {
  dismissed: false,
  firstQuizDone: false,
};

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly _state = signal<OnboardingState>(this.load());
  private _wordCount: Signal<number> = signal(0);

  /** Provide a live word count signal so onboarding can react to dictionary state */
  setWordCount(wordCount: Signal<number>): void {
    this._wordCount = wordCount;
  }

  /** Current onboarding step to show, or null if complete/dismissed */
  readonly currentStep = computed((): 'add-word' | 'try-quiz' | null => {
    const s = this._state();
    if (s.dismissed) return null;
    if (this._wordCount() === 0) return 'add-word';
    if (!s.firstQuizDone) return 'try-quiz';
    return null;
  });

  constructor() {
    effect(() => {
      const state = this._state();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch { /* quota — non-critical */ }
    });
  }

  markQuizDone(): void {
    this._state.update((s) => ({ ...s, firstQuizDone: true }));
  }

  dismiss(): void {
    this._state.update((s) => ({ ...s, dismissed: true }));
  }

  private load(): OnboardingState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULTS;
      const parsed = JSON.parse(raw);
      return { dismissed: parsed.dismissed ?? false, firstQuizDone: parsed.firstQuizDone ?? false };
    } catch {
      return DEFAULTS;
    }
  }
}
