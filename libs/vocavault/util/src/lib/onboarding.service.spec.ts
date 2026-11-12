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
  });
});
