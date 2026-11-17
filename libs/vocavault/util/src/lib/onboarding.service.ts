import { Injectable, Signal, signal, computed, effect } from '@angular/core';

const STORAGE_KEY = 'vv_onboarding';

export type OnboardingStep = 'add-word' | 'create-quiz' | 'start-quiz' | null;

export interface OnboardingContext {
  totalWords: Signal<number>;
  quizzableWords: Signal<number>;
  quizSets: Signal<number>;
  completedQuizzes: Signal<number>;
}

/**
 * The user's progress counts captured the moment a replay starts. The replay
 * tour is derived from how far the live counts have moved *past* this baseline,
 * so a user who has already finished the loop re-walks the whole tour from the
 * welcome to the end — exactly like a brand-new user — as they add a word,
 * build a quiz, and complete it again.
 */
interface ReplayBaseline {
  words: number;
  quizSets: number;
  completed: number;
}

interface PersistedState {
  dismissed: boolean;
  replay: boolean;
  replayBaseline: ReplayBaseline | null;
  // The one-time first-run completion celebration has already been shown, so it
  // never pops again on later completions or reloads.
  celebratedFirstRun: boolean;
}

/**
 * The single definition of the first-run ladder: given how many words / quizzes
 * / completed quizzes a user has, which milestone are they on? The live step and
 * the replay tour both call this — the live step with absolute counts, the
 * replay with counts measured from the baseline captured when the tour started —
 * so the add-word -> create-quiz -> start-quiz progression is defined in exactly
 * one place. Pure and total: same inputs always give the same step.
 */
function stepFromCounts(
  words: number,
  quizzableWords: number,
  quizSets: number,
  completedQuizzes: number,
): OnboardingStep {
  if (words <= 0) return 'add-word';
  if (quizSets <= 0) return quizzableWords > 0 ? 'create-quiz' : null;
  if (completedQuizzes <= 0) return 'start-quiz';
  return null;
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  // Load persisted flags once so the two signals stay in sync with a single read.
  private readonly _persisted = this.load();
  private readonly _dismissed = signal<boolean>(this._persisted.dismissed);

  // On-demand replay of the guided tour (triggered from Settings). Persisted so a
  // mid-tour page reload does not silently drop the tour; it is cleared the
  // moment the user dismisses or reaches the end of the tour (see endReplay), so
  // it cannot get "stuck" on.
  private readonly _replay = signal<boolean>(this._persisted.replay);

  // Progress counts captured when the current replay started. The replay step is
  // derived from how far the live counts have moved past this baseline, so the
  // tour advances add-word -> create-quiz -> start-quiz as the user re-performs
  // each action — even if they already had words/quizzes before replaying.
  // Persisted alongside _replay so a reload keeps the tour at the right stage.
  private readonly _replayBaseline = signal<ReplayBaseline | null>(
    this._persisted.replayBaseline,
  );

  // Whether the once-ever first-run completion celebration has been shown.
  // Persisted so it fires exactly once and never surprises a returning user.
  private readonly _celebratedFirstRun = signal<boolean>(this._persisted.celebratedFirstRun);

  // Live data counts, wired once from the always-mounted app shell so the
  // current step stays correct no matter which page the user is on. Held in a
  // signal (not reassigned fields) so currentStep reacts even when setContext
  // runs after the step has already been read somewhere.
  private readonly _ctx = signal<OnboardingContext | null>(null);

  /** Wire the live data counts that drive the first-run guidance. */
  setContext(ctx: OnboardingContext): void {
    this._ctx.set(ctx);
    // Self-heal a replay that was turned on before counts were available (e.g. a
    // reload of state persisted by an older build): anchor the tour baseline to
    // the first counts we see so it starts at the welcome rather than freezing.
    if (this._replay() && !this._replayBaseline()) {
      this._replayBaseline.set({
        words: ctx.totalWords(),
        quizSets: ctx.quizSets(),
        completed: ctx.completedQuizzes(),
      });
    }
    // Don't retroactively celebrate a user who had already completed the loop
    // before this feature shipped: treat an existing completion, seen on the
    // first context wire, as already celebrated.
    if (!this._celebratedFirstRun() && ctx.completedQuizzes() >= 1) {
      this._celebratedFirstRun.set(true);
    }
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
    if (!ctx) return 'add-word';
    return stepFromCounts(
      ctx.totalWords(),
      ctx.quizzableWords(),
      ctx.quizSets(),
      ctx.completedQuizzes(),
    );
  });

  /**
   * True while the user is replaying the getting-started tour. Drives the
   * Settings toggle state; the per-cue visibility below flows through
   * displayStep so the "replay" rule lives in one place.
   */
  readonly replaying = computed(() => this._replay());

  /**
   * The step of the guided tour currently being replayed, derived from how far
   * the live counts have moved past the baseline captured when replay started.
   * It walks the full first-run path — add-word until a new word is added,
   * create-quiz until a new quiz is built, start-quiz until one is completed —
   * then null once the loop has been re-walked end to end. This is what lets a
   * user who already finished the loop redo the whole tour from the beginning.
   */
  private readonly replayStep = computed<OnboardingStep>(() => {
    const base = this._replayBaseline();
    const ctx = this._ctx();
    // No baseline/counts yet: open the tour at the welcome.
    if (!base || !ctx) return 'add-word';
    // Same ladder as the live step, measured from the baseline so the tour walks
    // add-word -> create-quiz -> start-quiz as the user re-performs each action.
    // Quizzable words are read absolutely: the user only needs to be *able* to
    // build a quiz, which a returning user already can with their existing words.
    return stepFromCounts(
      ctx.totalWords() - base.words,
      ctx.quizzableWords(),
      ctx.quizSets() - base.quizSets,
      ctx.completedQuizzes() - base.completed,
    );
  });

  /**
   * The step the home banner should render. During a replay it follows the
   * replay tour (which always starts at the 'add-word' welcome and advances as
   * the user re-performs each action). Outside a replay it tracks the live
   * milestone (or null once the loop is complete / guidance was dismissed).
   */
  readonly displayStep = computed<OnboardingStep>(
    () => (this._replay() ? this.replayStep() : this.currentStep()),
  );

  // Per-cue visibility. Each keys off displayStep (the replay-aware step), so
  // every screen asks the service instead of re-deriving the rule for itself,
  // and the cues advance in lockstep with the tour during a replay.

  /** Show the "what is a quiz" teaching banner on the create-quiz screen. */
  readonly showCreateQuizCue = computed(() => this.displayStep() === 'create-quiz');

  /** Show the start-quiz cues (quiz-detail mode hint, quiz-card "Start here"). */
  readonly showStartQuizCue = computed(() => this.displayStep() === 'start-quiz');

  /** Whether the user has dismissed the first-run guidance. */
  readonly dismissed = computed(() => this._dismissed());

  /**
   * The final beat of the loop: a one-shot celebration shown the moment the user
   * closes the add -> practice -> master loop by completing a quiz. It fires once
   * ever on the real first completion (persisted so it never surprises a
   * returning user), and again at the end of each replayed tour, so a replay runs
   * from the welcome all the way to the finish line just like a first-timer.
   */
  readonly showCelebration = computed<boolean>(() => {
    const ctx = this._ctx();
    if (!ctx) return false;
    if (this._replay()) {
      // Replayed tour: celebrate once the user re-completes a quiz past the
      // baseline captured when the replay started.
      const base = this._replayBaseline();
      return !!base && ctx.completedQuizzes() > base.completed;
    }
    // First run: celebrate the first completion, unless guidance was dismissed or
    // the celebration has already been shown.
    if (this._dismissed() || this._celebratedFirstRun()) return false;
    return ctx.completedQuizzes() >= 1;
  });

  constructor() {
    effect(() => {
      const state: PersistedState = {
        dismissed: this._dismissed(),
        replay: this._replay(),
        replayBaseline: this._replayBaseline(),
        celebratedFirstRun: this._celebratedFirstRun(),
      };
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
    this._replayBaseline.set(null);
  }

  /**
   * Replay the first-run guided tour on demand (from Settings). Clears any prior
   * dismiss and snapshots the user's current progress as the baseline, so the
   * tour restarts at the welcome and then advances add-word -> create-quiz ->
   * start-quiz as the user re-performs each action — the full first-run path,
   * even for a user who has already finished the loop. Persisted so it survives
   * a page reload; it ends when the user dismisses or reaches the end of the
   * tour (see endReplay).
   */
  replay(): void {
    const ctx = this._ctx();
    this._dismissed.set(false);
    this._replayBaseline.set({
      words: ctx?.totalWords() ?? 0,
      quizSets: ctx?.quizSets() ?? 0,
      completed: ctx?.completedQuizzes() ?? 0,
    });
    this._replay.set(true);
  }

  /** End an in-progress replay once the tour has run its course. */
  endReplay(): void {
    this._replay.set(false);
    this._replayBaseline.set(null);
  }

  /**
   * Acknowledge the completion celebration. Always records that the once-ever
   * first-run celebration has been seen (so it never pops again — even if the
   * user reached completion via a replay before ever seeing the first-run one),
   * and ends the tour when this was a replay.
   */
  dismissCelebration(): void {
    this._celebratedFirstRun.set(true);
    if (this._replay()) {
      this.endReplay();
    }
  }

  private load(): PersistedState {
    const empty: PersistedState = {
      dismissed: false,
      replay: false,
      replayBaseline: null,
      celebratedFirstRun: false,
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      return {
        dismissed: parsed.dismissed ?? false,
        replay: parsed.replay ?? false,
        replayBaseline: parsed.replayBaseline ?? null,
        celebratedFirstRun: parsed.celebratedFirstRun ?? false,
      };
    } catch {
      return empty;
    }
  }
}
