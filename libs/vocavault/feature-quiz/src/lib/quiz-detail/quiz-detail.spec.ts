import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { QuizDetail } from './quiz-detail';
import { QuizService, WordService, QuizSet, Word, MasteryLevel, makeWord } from '@vocavault/data-access';
import { OnboardingService } from '@vocavault/util';

const mockQuizSet: QuizSet = {
  id: 'qs1',
  name: 'Test Quiz',
  description: 'A test quiz set',
  wordIds: ['w1', 'w2'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockWords: Word[] = [
  makeWord({ id: 'w1', word: 'Apple', pronunciation: '/\u02C8\u00E6p.\u0259l/', definition: 'A round fruit', examples: ['I ate an apple'] }),
  makeWord({ id: 'w2', word: 'Banana', pronunciation: '/b\u0259\u02C8n\u0251\u02D0.n\u0259/', definition: 'A yellow fruit', examples: ['The banana is ripe'], masteryLevel: MasteryLevel.Learning }),
];

describe('QuizDetail', () => {
  let fixture: ComponentFixture<QuizDetail>;

  const setupWithQuizSet = async (
    quizSetId: string,
    quizSetData: QuizSet | undefined,
    words: Word[] = mockWords,
  ) => {
    localStorage.clear();
    const mockQuizService = {
      getQuizSet: vi.fn().mockReturnValue(quizSetData),
      getWordsForQuizSet: vi.fn().mockReturnValue(words),
      getSessionInfo: vi.fn().mockReturnValue({ totalWords: words.length, practicedWords: 0, totalSessions: 1, needsChunking: false }),
      getSessionWords: vi.fn().mockReturnValue(words.map((w) => w.id)),
      createTempQuizSet: vi.fn(),
    };
    const mockWordService = {
      words: vi.fn().mockReturnValue(words),
      getWord: vi.fn().mockImplementation((id: string) =>
        words.find((w) => w.id === id)
      ),
    };

    await TestBed.configureTestingModule({
      imports: [QuizDetail],
      providers: [
        provideRouter([]),
        { provide: QuizService, useValue: mockQuizService },
        { provide: WordService, useValue: mockWordService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuizDetail);
    fixture.componentRef.setInput('id', quizSetId);
    fixture.detectChanges();
  };

  // Settle pending async work while the component is still attached, then
  // destroy deterministically so no stale real-router navigation can surface in
  // a later test as an unhandled rejection under parallel load.
  afterEach(async () => {
    if (fixture) {
      await fixture.whenStable();
      fixture.destroy();
    }
  });

  it('renders quiz set name when found', async () => {
    await setupWithQuizSet('qs1', mockQuizSet);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Test Quiz');
  });

  it('shows quiz set not found when quizSet returns undefined', async () => {
    await setupWithQuizSet('nonexistent', undefined);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Quiz set not found');
  });

  it('renders word count', async () => {
    await setupWithQuizSet('qs1', mockQuizSet);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('2 word');
  });

  it('has four mode start buttons', async () => {
    await setupWithQuizSet('qs1', mockQuizSet);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Flashcard');
    expect(compiled.textContent).toContain('Multiple Choice');
    expect(compiled.textContent).toContain('Type');
    expect(compiled.textContent).toContain('Match');
  });

  it('shows the mode teaching hint at the start-quiz milestone', async () => {
    await setupWithQuizSet('qs1', mockQuizSet);
    TestBed.inject(OnboardingService).setContext({
      totalWords: signal(1),
      quizzableWords: signal(1),
      quizSets: signal(1),
      completedQuizzes: signal(0),
    });
    fixture.detectChanges();
    const hint = fixture.nativeElement.querySelector('[data-testid="mode-hint"]');
    expect(hint).toBeTruthy();
    expect(hint.textContent).toContain('Each mode drills the same words');
  });

  it('hides the mode teaching hint outside first-run', async () => {
    await setupWithQuizSet('qs1', mockQuizSet);
    // Default onboarding context resolves to add-word, not start-quiz.
    expect(fixture.nativeElement.querySelector('[data-testid="mode-hint"]')).toBeFalsy();
  });

  it('renders direction picker', async () => {
    await setupWithQuizSet('qs1', mockQuizSet);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Quiz direction');
  });

  describe('mode gating by word set', () => {
    interface Internals {
      isModeDisabled: (mode: string) => boolean;
      directionOptions: () => string[];
      startMode: (mode: string) => void;
    }
    const internals = () => fixture.componentInstance as unknown as Internals;
    const words = (n: number, withExamples = false): Word[] =>
      Array.from({ length: n }, (_, i) =>
        makeWord({ id: `g${i}`, word: `w${i}`, definition: `d${i}`, examples: withExamples ? [`ex${i}`] : [] }),
      );
    const setOf = (ids: string[]): QuizSet => ({ ...mockQuizSet, wordIds: ids });

    it('disables match and multiple-choice for a small set, and shows the hint', async () => {
      await setupWithQuizSet('qs1', setOf(['g0', 'g1']), words(2));
      expect(internals().isModeDisabled('match')).toBe(true);
      expect(internals().isModeDisabled('multiple-choice')).toBe(true);
      expect(internals().isModeDisabled('flashcard')).toBe(false);
      expect(internals().isModeDisabled('type')).toBe(false);
      expect(fixture.nativeElement.querySelector('[data-testid="locked-modes-hint"]')).toBeTruthy();
    });

    it('enables every mode and hides the hint once there are enough words', async () => {
      await setupWithQuizSet('qs1', setOf(['g0', 'g1', 'g2', 'g3']), words(4));
      expect(internals().isModeDisabled('match')).toBe(false);
      expect(internals().isModeDisabled('multiple-choice')).toBe(false);
      expect(fixture.nativeElement.querySelector('[data-testid="locked-modes-hint"]')).toBeFalsy();
    });

    it('hides example-to-definition until enough words have examples', async () => {
      await setupWithQuizSet('qs1', setOf(['g0', 'g1']), words(2, true)); // 2 with examples (< 3)
      expect(internals().directionOptions()).not.toContain('example-to-definition');
    });

    it('offers example-to-definition when enough words have examples', async () => {
      await setupWithQuizSet('qs1', setOf(['g0', 'g1', 'g2']), words(3, true)); // 3 with examples
      expect(internals().directionOptions()).toContain('example-to-definition');
    });

    it('startMode does not navigate for a locked mode', async () => {
      await setupWithQuizSet('qs1', setOf(['g0', 'g1']), words(2));
      const navSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      internals().startMode('match');
      expect(navSpy).not.toHaveBeenCalled();
    });

    it('clamps selectedDirection off example-to-definition when its example words are removed', async () => {
      localStorage.clear();
      const wordsSig = signal(words(3, true)); // 3 words, all with examples
      const quizSetData = setOf(['g0', 'g1', 'g2']);
      await TestBed.configureTestingModule({
        imports: [QuizDetail],
        providers: [
          provideRouter([]),
          {
            provide: QuizService,
            useValue: {
              getQuizSet: () => quizSetData,
              getWordsForQuizSet: () => wordsSig(),
              getSessionInfo: () => ({ totalWords: wordsSig().length, practicedWords: 0, totalSessions: 1, needsChunking: false }),
              getSessionWords: () => wordsSig().map((w) => w.id),
              createTempQuizSet: vi.fn(),
            },
          },
          {
            provide: WordService,
            useValue: { words: () => wordsSig(), getWord: (id: string) => wordsSig().find((w) => w.id === id) },
          },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(QuizDetail);
      fixture.componentRef.setInput('id', 'qs1');
      fixture.detectChanges();

      const comp = fixture.componentInstance as unknown as Internals & {
        selectDirection: (d: string) => void;
        selectedDirection: () => string;
      };
      expect(comp.directionOptions()).toContain('example-to-definition');
      comp.selectDirection('example-to-definition');
      expect(comp.selectedDirection()).toBe('example-to-definition');

      // Remove every example; example-to-definition is no longer offered.
      wordsSig.set(words(3, false));
      fixture.detectChanges();

      expect(comp.directionOptions()).not.toContain('example-to-definition');
      // The stale selection must be clamped back to a still-valid direction.
      expect(comp.selectedDirection()).not.toBe('example-to-definition');
      expect(comp.directionOptions()).toContain(comp.selectedDirection());
    });
  });
});
