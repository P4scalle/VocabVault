import { Injectable, Signal, signal, computed, effect } from '@angular/core';

const STORAGE_KEY = 'vv_onboarding';

export type OnboardingStep = 'add-word' | 'create-quiz' | 'start-quiz' | null;

export interface OnboardingContext {
  totalWords: Signal<number>;
  quizzableWords: Signal<number>;
  quizSets: Signal<number>;
  completedQuizzes: Signal<number>;
}

interface PersistedState {
  dismissed: boolean;
  replay: boolean;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  // Load persisted flags once so the two signals stay in sync with a single read.
  private readonly _persisted = this.load();
  private readonly _dismissed = signal<boolean>(this._persisted.dismissed);

  // On-demand replay of the guided tour (triggered from Settings). Persisted so a
  // mid-tour page reload does not silently drop the recap; it is cleared the
  // moment the user dismisses or reaches the end of the recap (see endReplay), so
  // it cannot get "stuck" on. Drives the teaching cues directly, so they reappear
  // even for a user whose data-derived currentStep is already null (loop complete).
  private readonly _replay = signal<boolean>(this._persisted.replay);

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

  /**
   * True while the user is replaying the getting-started tour. The per-cue
   * getters below each read this once, so the "a replay re-shows the cue" rule
   * lives in one place and a new cue can't forget it.
   */
  readonly replaying = computed(() => this._replay());

  /**
   * The step the home banner should render. During a replay it is always the
   * 'add-word' welcome, so toggling "getting-started tips" back on reproduces the
   * exact first-run experience a brand-new (zero-word) user sees, no matter how
   * far the user has actually progressed. Outside a replay it tracks the live
   * milestone (or null once the loop is complete / guidance was dismissed).
   */
  readonly displayStep = computed<OnboardingStep>(
    () => (this._replay() ? 'add-word' : this.currentStep()),
  );

  // Per-cue visibility. Each reads the replay flag once, so every screen asks
  // the service instead of re-deriving `currentStep === X || replay` for itself
  // (easy to get subtly wrong, or to forget when adding a new cue).

  /** Show the "what is a quiz" teaching banner on the create-quiz screen. */
  readonly showCreateQuizCue = computed(
    () => this.currentStep() === 'create-quiz' || this._replay(),
  );

  /** Show the start-quiz cues (quiz-detail mode hint, quiz-card "Start here"). */
  readonly showStartQuizCue = computed(
    () => this.currentStep() === 'start-quiz' || this._replay(),
  );

  /** Whether the user has dismissed the first-run guidance. */
  readonly dismissed = computed(() => this._dismissed());

  constructor() {
    effect(() => {
      const state: PersistedState = { dismissed: this._dismissed(), replay: this._replay() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* quota, non-critical */
      }
    });
  }

  dismiss(): void {
    this._dismissed.set(true);
    this._replay.set(false);
  }

  /**
   * Replay the first-run guided tour on demand (from Settings). Clears any prior
   * dismiss and turns the replay flag on so the teaching cues come back on every
   * screen (the home welcome, the create-quiz and start-quiz cues, the results
   * hint), even for a user who has already finished the loop and whose live
   * currentStep is null. It is persisted so it survives a page reload, and it
   * ends when the user dismisses or reaches the end of the recap (see endReplay).
   */
  replay(): void {
    this._dismissed.set(false);
    this._replay.set(true);
  }

  /** End an in-progress replay once the recap has run its course. */
  endReplay(): void {
    this._replay.set(false);
  }

  private load(): PersistedState {
    const empty: PersistedState = { dismissed: false, replay: false };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      return { dismissed: parsed.dismissed ?? false, replay: parsed.replay ?? false };
    } catch {
      return empty;
    }
  }
}
