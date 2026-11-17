import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OnboardingService } from './onboarding.service';

const STORAGE_KEY = 'vv_onboarding';

interface Counts {
  totalWords: WritableSignal<number>;
  quizzableWords: WritableSignal<number>;
  quizSets: WritableSignal<number>;
  completedQuizzes: WritableSignal<number>;
}

/** Wire a fresh set of count signals into the service and hand them back for mutation. */
function wireContext(
  service: OnboardingService,
  init: Partial<Record<keyof Counts, number>> = {},
): Counts {
  const counts: Counts = {
    totalWords: signal(init.totalWords ?? 0),
    quizzableWords: signal(init.quizzableWords ?? 0),
    quizSets: signal(init.quizSets ?? 0),
    completedQuizzes: signal(init.completedQuizzes ?? 0),
  };
  service.setContext({
    totalWords: counts.totalWords.asReadonly(),
    quizzableWords: counts.quizzableWords.asReadonly(),
    quizSets: counts.quizSets.asReadonly(),
    completedQuizzes: counts.completedQuizzes.asReadonly(),
  });
  return counts;
}

describe('OnboardingService', () => {
  let service: OnboardingService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(OnboardingService);
  });

  describe('currentStep', () => {
    it('returns add-word when there are no words', () => {
      wireContext(service, { totalWords: 0 });
      expect(service.currentStep()).toBe('add-word');
    });

    it('returns create-quiz when a quizzable word exists but no quiz set', () => {
      wireContext(service, { totalWords: 1, quizzableWords: 1, quizSets: 0 });
      expect(service.currentStep()).toBe('create-quiz');
    });

    it('returns null when a word exists but is not yet quizzable (incomplete)', () => {
      // e.g. a word with no definition: there's something in the dictionary,
      // but nothing to quiz, so there is no next step to guide toward yet.
      wireContext(service, { totalWords: 1, quizzableWords: 0, quizSets: 0 });
      expect(service.currentStep()).toBeNull();
    });

    it('returns start-quiz when a quiz exists but none completed', () => {
      wireContext(service, { totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 0 });
      expect(service.currentStep()).toBe('start-quiz');
    });

    it('returns null once a quiz has been completed', () => {
      wireContext(service, { totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 1 });
      expect(service.currentStep()).toBeNull();
    });

    it('returns null when dismissed regardless of state', () => {
      wireContext(service, { totalWords: 0 });
      service.dismiss();
      expect(service.currentStep()).toBeNull();
    });

    it('advances add-word -> create-quiz -> start-quiz -> null as the user progresses', () => {
      const counts = wireContext(service, { totalWords: 0 });
      expect(service.currentStep()).toBe('add-word');

      counts.totalWords.set(1);
      counts.quizzableWords.set(1);
      expect(service.currentStep()).toBe('create-quiz');

      counts.quizSets.set(1);
      expect(service.currentStep()).toBe('start-quiz');

      counts.completedQuizzes.set(1);
      expect(service.currentStep()).toBeNull();
    });

    it('shows add-word again if all words are deleted', () => {
      const counts = wireContext(service, { totalWords: 1, quizzableWords: 1 });
      expect(service.currentStep()).toBe('create-quiz');

      counts.totalWords.set(0);
      counts.quizzableWords.set(0);
      expect(service.currentStep()).toBe('add-word');
    });
  });

  describe('persistence', () => {
    it('persists dismissed state to localStorage', () => {
      service.dismiss();
      TestBed.flushEffects();
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const stored = JSON.parse(raw as string);
      expect(stored.dismissed).toBe(true);
    });

    it('loads persisted dismissed state on creation', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissed: true }));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const fresh = TestBed.inject(OnboardingService);
      wireContext(fresh, { totalWords: 0 });
      expect(fresh.currentStep()).toBeNull();
      expect(fresh.dismissed()).toBe(true);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const fresh = TestBed.inject(OnboardingService);
      wireContext(fresh, { totalWords: 0 });
      expect(fresh.currentStep()).toBe('add-word');
    });

    it('handles missing localStorage gracefully', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const fresh = TestBed.inject(OnboardingService);
      wireContext(fresh, { totalWords: 0 });
      expect(fresh.currentStep()).toBe('add-word');
    });
  });

  describe('dismiss', () => {
    it('hides all steps and flips the dismissed flag', () => {
      wireContext(service, { totalWords: 0 });
      expect(service.currentStep()).toBe('add-word');
      service.dismiss();
      expect(service.currentStep()).toBeNull();
      expect(service.dismissed()).toBe(true);
    });

    it('ends an in-progress replay', () => {
      wireContext(service, { totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 1 });
      service.replay();
      expect(service.replaying()).toBe(true);

      service.dismiss();
      expect(service.replaying()).toBe(false);
    });
  });

  describe('replay', () => {
    it('re-enables guidance so cues reappear for the current milestone', () => {
      wireContext(service, { totalWords: 0 });
      service.dismiss();
      expect(service.currentStep()).toBeNull();

      service.replay();
      expect(service.dismissed()).toBe(false);
      expect(service.currentStep()).toBe('add-word');
    });

    it('turns the tour back on for a user who already finished the loop', () => {
      // Loop complete: currentStep is null forever, so the data-derived cues are
      // all off. Replay must still bring the tour back.
      wireContext(service, { totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 1 });
      expect(service.currentStep()).toBeNull();
      expect(service.displayStep()).toBeNull();

      service.replay();
      expect(service.replaying()).toBe(true);
      // The home banner falls back to the welcome recap even though currentStep
      // stays null (the live loop really is complete).
      expect(service.currentStep()).toBeNull();
      expect(service.displayStep()).toBe('add-word');
    });

    it('restarts at the welcome during a replay even when the user is mid-loop', () => {
      // A user who already has words (live step: create-quiz) taps "show
      // getting-started tips". The home banner must restart at the welcome — the
      // same screen a brand-new, zero-word user sees — not drop them at their
      // current milestone.
      wireContext(service, { totalWords: 1, quizzableWords: 1, quizSets: 0 });
      expect(service.currentStep()).toBe('create-quiz');

      service.replay();
      expect(service.displayStep()).toBe('add-word');
    });

    it('restarts at the welcome during a replay for a user with a full dictionary and quizzes', () => {
      // Same guarantee regardless of how far along the user is (quiz built,
      // none completed → live step start-quiz).
      wireContext(service, { totalWords: 20, quizzableWords: 20, quizSets: 2, completedQuizzes: 0 });
      expect(service.currentStep()).toBe('start-quiz');

      service.replay();
      expect(service.displayStep()).toBe('add-word');
    });

    it('advances the replay tour as the user re-performs each action, even with pre-existing data', () => {
      // A user who already finished the loop replays the tour. It starts at the
      // welcome and walks add-word -> create-quiz -> start-quiz -> done as they
      // add a word, build a quiz, and complete it again — not frozen on welcome.
      const counts = wireContext(service, {
        totalWords: 5,
        quizzableWords: 5,
        quizSets: 2,
        completedQuizzes: 3,
      });
      service.replay();
      expect(service.displayStep()).toBe('add-word');

      counts.totalWords.set(6); // added a new word
      expect(service.displayStep()).toBe('create-quiz');

      counts.quizSets.set(3); // built a new quiz
      expect(service.displayStep()).toBe('start-quiz');

      counts.completedQuizzes.set(4); // completed a quiz → tour re-walked end to end
      expect(service.displayStep()).toBeNull();
    });

    it('self-heals a persisted replay that has no baseline (older-build state)', () => {
      // Simulate state saved by a build that persisted replay but not a baseline.
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ dismissed: false, replay: true, replayBaseline: null }),
      );
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const fresh = TestBed.inject(OnboardingService);
      // First context wire (with pre-existing data) anchors the baseline so the
      // tour opens at the welcome and then advances, instead of freezing.
      const counts = wireContext(fresh, { totalWords: 7, quizzableWords: 7, quizSets: 2, completedQuizzes: 4 });
      expect(fresh.displayStep()).toBe('add-word');

      counts.totalWords.set(8);
      expect(fresh.displayStep()).toBe('create-quiz');
    });

    it('endReplay stops the replay', () => {
      wireContext(service, { totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 1 });
      service.replay();
      expect(service.replaying()).toBe(true);

      service.endReplay();
      expect(service.replaying()).toBe(false);
      expect(service.displayStep()).toBeNull();
    });

    it('persists the un-dismissed state', () => {
      service.dismiss();
      service.replay();
      TestBed.flushEffects();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
      expect(stored.dismissed).toBe(false);
    });

    it('persists the replay flag and baseline so a page reload keeps the tour at its stage', () => {
      // Replay with live counts wired, so the baseline reflects the user's real
      // progress at the moment they started the tour.
      wireContext(service, { totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 1 });
      service.replay();
      TestBed.flushEffects();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
      expect(stored.replay).toBe(true);
      expect(stored.replayBaseline).toEqual({ words: 3, quizSets: 1, completed: 1 });

      // A freshly constructed service (simulating a reload) is still replaying
      // and, with the same counts, still sits at the welcome start of the tour.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const fresh = TestBed.inject(OnboardingService);
      wireContext(fresh, { totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 1 });
      expect(fresh.replaying()).toBe(true);
      expect(fresh.displayStep()).toBe('add-word');
    });

    it('endReplay persists, so a reload after finishing the recap stays off', () => {
      service.replay();
      service.endReplay();
      TestBed.flushEffects();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
      expect(stored.replay).toBe(false);
    });
  });

  describe('per-cue visibility', () => {
    it('showCreateQuizCue is on at the create-quiz milestone', () => {
      wireContext(service, { totalWords: 1, quizzableWords: 1, quizSets: 0 });
      expect(service.showCreateQuizCue()).toBe(true);
      expect(service.showStartQuizCue()).toBe(false);
    });

    it('showStartQuizCue is on at the start-quiz milestone', () => {
      wireContext(service, { totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 0 });
      expect(service.showStartQuizCue()).toBe(true);
      expect(service.showCreateQuizCue()).toBe(false);
    });

    it('a replay re-walks the cues one stage at a time, even once the loop is complete', () => {
      const counts = wireContext(service, {
        totalWords: 3,
        quizzableWords: 3,
        quizSets: 1,
        completedQuizzes: 1,
      });
      expect(service.showCreateQuizCue()).toBe(false);
      expect(service.showStartQuizCue()).toBe(false);

      // Replay restarts at the welcome: neither later cue is on yet.
      service.replay();
      expect(service.showCreateQuizCue()).toBe(false);
      expect(service.showStartQuizCue()).toBe(false);

      // Adding a word advances the tour to create-quiz...
      counts.totalWords.set(4);
      expect(service.showCreateQuizCue()).toBe(true);
      expect(service.showStartQuizCue()).toBe(false);

      // ...and building a quiz advances it to start-quiz.
      counts.quizSets.set(2);
      expect(service.showCreateQuizCue()).toBe(false);
      expect(service.showStartQuizCue()).toBe(true);
    });
  });

  describe('showCelebration', () => {
    describe('first run (new user)', () => {
      it('fires the moment the user completes their first quiz, not before', () => {
        const counts = wireContext(service, {
          totalWords: 3,
          quizzableWords: 3,
          quizSets: 1,
          completedQuizzes: 0,
        });
        expect(service.showCelebration()).toBe(false);

        counts.completedQuizzes.set(1); // closed the loop
        expect(service.showCelebration()).toBe(true);
      });

      it('is suppressed if the user dismissed guidance', () => {
        const counts = wireContext(service, { totalWords: 3, quizzableWords: 3, quizSets: 1 });
        service.dismiss();
        counts.completedQuizzes.set(1);
        expect(service.showCelebration()).toBe(false);
      });

      it('fires only once ever: dismissing it persists across a reload', () => {
        const counts = wireContext(service, {
          totalWords: 3,
          quizzableWords: 3,
          quizSets: 1,
          completedQuizzes: 0,
        });
        counts.completedQuizzes.set(1);
        expect(service.showCelebration()).toBe(true);

        service.dismissCelebration();
        expect(service.showCelebration()).toBe(false);
        TestBed.flushEffects();
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string).celebratedFirstRun).toBe(true);

        // A reload (fresh service) with the loop already complete stays quiet.
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({});
        const fresh = TestBed.inject(OnboardingService);
        wireContext(fresh, { totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 1 });
        expect(fresh.showCelebration()).toBe(false);
      });

      it('never fires for a user who had already completed the loop before the feature shipped', () => {
        // First context wire already shows a completion → treated as celebrated.
        wireContext(service, { totalWords: 3, quizzableWords: 3, quizSets: 1, completedQuizzes: 2 });
        expect(service.showCelebration()).toBe(false);
      });
    });

    describe('replay (returning user)', () => {
      it('fires again at the end of a replayed tour, even after the first-run celebration was seen', () => {
        const counts = wireContext(service, {
          totalWords: 5,
          quizzableWords: 5,
          quizSets: 2,
          completedQuizzes: 3,
        });
        // Returning user: pre-existing completion means first-run is already done.
        expect(service.showCelebration()).toBe(false);

        service.replay();
        expect(service.showCelebration()).toBe(false); // tour restarts at the welcome

        counts.totalWords.set(6); // re-add a word
        counts.quizSets.set(3); // re-build a quiz
        expect(service.showCelebration()).toBe(false); // not yet — quiz not completed

        counts.completedQuizzes.set(4); // re-complete the loop
        expect(service.showCelebration()).toBe(true);
      });

      it('dismissing the replay celebration ends the tour', () => {
        const counts = wireContext(service, {
          totalWords: 5,
          quizzableWords: 5,
          quizSets: 2,
          completedQuizzes: 3,
        });
        service.replay();
        counts.completedQuizzes.set(4);
        expect(service.showCelebration()).toBe(true);

        service.dismissCelebration();
        expect(service.replaying()).toBe(false);
        expect(service.showCelebration()).toBe(false);
      });

      it('dismissing a replay celebration does not re-pop the pending first-run one', () => {
        // User completes their first quiz (first-run celebration pending) but
        // replays before ever acknowledging it, then re-completes the loop.
        const counts = wireContext(service, {
          totalWords: 3,
          quizzableWords: 3,
          quizSets: 1,
          completedQuizzes: 0,
        });
        counts.completedQuizzes.set(1);
        expect(service.showCelebration()).toBe(true); // first-run celebration pending

        service.replay();
        counts.totalWords.set(4);
        counts.quizSets.set(2);
        counts.completedQuizzes.set(2);
        expect(service.showCelebration()).toBe(true); // replay celebration

        service.dismissCelebration();
        // Tour ended AND the first-run celebration is marked seen, so it must not
        // immediately re-pop now that the replay is over.
        expect(service.replaying()).toBe(false);
        expect(service.showCelebration()).toBe(false);
      });
    });
  });
});
