import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OnboardingService } from './onboarding.service';

const STORAGE_KEY = 'vv_onboarding';

describe('OnboardingService', () => {
  let service: OnboardingService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(OnboardingService);
  });

  describe('currentStep', () => {
    it('returns add-word when word count is 0', () => {
      service.setWordCount(signal(0));
      expect(service.currentStep()).toBe('add-word');
    });

    it('returns try-quiz when words exist but no quiz done', () => {
      service.setWordCount(signal(5));
      expect(service.currentStep()).toBe('try-quiz');
    });

    it('returns null when words exist and quiz done', () => {
      service.setWordCount(signal(5));
      service.markQuizDone();
      expect(service.currentStep()).toBeNull();
    });

    it('returns null when dismissed regardless of state', () => {
      service.setWordCount(signal(0));
      service.dismiss();
      expect(service.currentStep()).toBeNull();
    });

    it('reacts to word count changes', () => {
      const wordCount = signal(0);
      service.setWordCount(wordCount);
      expect(service.currentStep()).toBe('add-word');

      wordCount.set(3);
      expect(service.currentStep()).toBe('try-quiz');
    });

    it('shows add-word again if all words are deleted', () => {
      const wordCount = signal(5);
      service.setWordCount(wordCount);
      expect(service.currentStep()).toBe('try-quiz');

      wordCount.set(0);
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

    it('persists firstQuizDone to localStorage', () => {
      service.markQuizDone();
      TestBed.flushEffects();
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const stored = JSON.parse(raw as string);
      expect(stored.firstQuizDone).toBe(true);
    });

    it('loads persisted state on creation', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissed: false, firstQuizDone: true }));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const fresh = TestBed.inject(OnboardingService);
      fresh.setWordCount(signal(5));
      expect(fresh.currentStep()).toBeNull();
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const fresh = TestBed.inject(OnboardingService);
      fresh.setWordCount(signal(0));
      expect(fresh.currentStep()).toBe('add-word');
    });

    it('handles missing localStorage gracefully', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const fresh = TestBed.inject(OnboardingService);
      fresh.setWordCount(signal(0));
      expect(fresh.currentStep()).toBe('add-word');
    });
  });

  describe('markQuizDone', () => {
    it('advances past try-quiz step', () => {
      service.setWordCount(signal(5));
      expect(service.currentStep()).toBe('try-quiz');
      service.markQuizDone();
      expect(service.currentStep()).toBeNull();
    });

    it('is idempotent', () => {
      service.markQuizDone();
      service.markQuizDone();
      TestBed.flushEffects();
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const stored = JSON.parse(raw as string);
      expect(stored.firstQuizDone).toBe(true);
    });
  });

  describe('dismiss', () => {
    it('hides all steps', () => {
      service.setWordCount(signal(0));
      expect(service.currentStep()).toBe('add-word');
      service.dismiss();
      expect(service.currentStep()).toBeNull();
    });
  });
});
