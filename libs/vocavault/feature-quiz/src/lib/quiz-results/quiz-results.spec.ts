import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  MasteryLevel,
  MASTERY_REGRESSION,
  QuizService,
  WordService,
  ProgressService,
  SpacedRepetitionService,
} from '@vocavault/data-access';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChromeService } from '@vocavault/util';
import { QuizResults } from './quiz-results';

const mockState = {
  score: 3,
  totalQuestions: 5,
  correctAnswers: 3,
  wrongAnswers: ['word-2', 'word-4'],
  mode: 'multiple-choice' as const,
};

const mockWords = [
  {
    id: 'word-1',
    word: 'Ephemeral',
    pronunciation: '/\u026A\u02C8fem.\u0259r.\u0259l/',
    definition: 'Lasting for a very short time',
    examples: [],
    masteryLevel: MasteryLevel.New,
    createdAt: new Date(),
    updatedAt: new Date(),
    interval: 0,
    easeFactor: 2.5,
    reviewCount: 0,
  },
  {
    id: 'word-2',
    word: 'Ubiquitous',
    pronunciation: '/ju\u02D0\u02C8b\u026Ak.w\u026A.t\u0259s/',
    definition: 'Present everywhere',
    examples: [],
    masteryLevel: MasteryLevel.Learning,
    createdAt: new Date(),
    updatedAt: new Date(),
    interval: 0,
    easeFactor: 2.5,
    reviewCount: 0,
  },
  {
    id: 'word-3',
    word: 'Serendipity',
    pronunciation: '/\u02CCser.\u0259n\u02C8d\u026Ap.\u026A.ti/',
    definition: 'Happy accident',
    examples: [],
    masteryLevel: MasteryLevel.Review,
    createdAt: new Date(),
    updatedAt: new Date(),
    interval: 0,
    easeFactor: 2.5,
    reviewCount: 0,
  },
  {
    id: 'word-4',
    word: 'Melancholy',
    pronunciation: '/\u02C8mel.\u0259n\u02CCk\u0252l.i/',
    definition: 'Deep sadness',
    examples: [],
    masteryLevel: MasteryLevel.Mastered,
    createdAt: new Date(),
    updatedAt: new Date(),
    interval: 0,
    easeFactor: 2.5,
    reviewCount: 0,
  },
];

const mockQuizSet = {
  id: 'quiz-1',
  name: 'Test Quiz',
  description: '',
  wordIds: ['word-1', 'word-2', 'word-3', 'word-4'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('QuizResults', () => {
  let fixture: ComponentFixture<QuizResults>;
  let component: QuizResults;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let wordService: {
    getWord: ReturnType<typeof vi.fn>;
    updateWord: ReturnType<typeof vi.fn>;
  };
  let quizService: { getQuizSet: ReturnType<typeof vi.fn> };
  let progressService: { addResult: ReturnType<typeof vi.fn>; eloquenceScore: ReturnType<typeof vi.fn>; getLatestResult: ReturnType<typeof vi.fn> };
  let srService: { calculateNextReview: ReturnType<typeof vi.fn> };
  let mockChrome: { enterFocus: ReturnType<typeof vi.fn>; leaveFocus: ReturnType<typeof vi.fn> };

  function setupWithState(state: Partial<typeof mockState> | null, quizSetId = 'quiz-1') {
    if (state !== null) {
      Object.defineProperty(window, 'history', {
        value: { state: { ...state } },
        writable: true,
        configurable: true,
      });
    } else {
      Object.defineProperty(window, 'history', {
        value: { state: {} },
        writable: true,
        configurable: true,
      });
    }

    router = { navigate: vi.fn().mockResolvedValue(true) };
    wordService = {
      getWord: vi.fn((id: string) => mockWords.find((w) => w.id === id)),
      updateWord: vi.fn(),
    };
    quizService = {
      getQuizSet: vi.fn().mockReturnValue(mockQuizSet), getWordsForQuizSet: vi.fn().mockReturnValue(mockWords),
    };
    let eloquenceCallCount = 0;
    progressService = {
      addResult: vi.fn(),
      getLatestResult: vi.fn().mockReturnValue(undefined),
      eloquenceScore: vi.fn().mockImplementation(() => {
        return eloquenceCallCount++ === 0 ? 50 : 53;
      }),
    };
    srService = {
      calculateNextReview: vi.fn().mockReturnValue({
        lastReviewedAt: new Date(),
        nextReviewDate: new Date(),
        interval: 1,
        easeFactor: 2.5,
        reviewCount: 1,
      }),
    };
    mockChrome = { enterFocus: vi.fn(), leaveFocus: vi.fn() };

    TestBed.configureTestingModule({
      imports: [QuizResults],
      providers: [
        { provide: Router, useValue: router },
        { provide: WordService, useValue: wordService },
        { provide: QuizService, useValue: quizService },
        { provide: ProgressService, useValue: progressService },
        { provide: SpacedRepetitionService, useValue: srService },
        { provide: ChromeService, useValue: mockChrome },
      ],
    });

    fixture = TestBed.createComponent(QuizResults);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', quizSetId);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('redirects to /quiz/:id when no navigation state present', async () => {
    setupWithState(null);
    component.ngOnInit();
    expect(router.navigate).toHaveBeenCalledWith(['/quiz', 'quiz-1']);
  });

  it('renders accuracy percentage computed from state', () => {
    setupWithState(mockState);
    expect(component['accuracy']()).toBe(60);
  });

  it('renders X / Y correct text', () => {
    setupWithState(mockState);
    expect(component['correctAnswers']()).toBe(3);
    expect(component['totalQuestions']()).toBe(5);
  });

  it('isPerfect() is true when wrongAnswers is empty', () => {
    setupWithState({ ...mockState, wrongAnswers: [], correctAnswers: 5, score: 5 });
    expect(component['isPerfect']()).toBe(true);
  });

  it('isPerfect() is false when wrongAnswers has entries', () => {
    setupWithState(mockState);
    expect(component['isPerfect']()).toBe(false);
  });

  it('shows wrong words list from wrongAnswerIds', () => {
    setupWithState(mockState);
    const wrongWords = component['wrongWords']();
    expect(wrongWords.length).toBe(2);
    expect(wrongWords[0].word.id).toBe('word-2');
    expect(wrongWords[1].word.id).toBe('word-4');
  });

  it('shows modeLabel from mode string', () => {
    setupWithState(mockState);
    expect(component['modeLabel']()).toBe('Multiple Choice');
  });

  it('tryAgain() navigates to /quiz/:id/play with mode and direction queryParams', async () => {
    setupWithState(mockState);
    await component['tryAgain']();
    expect(router.navigate).toHaveBeenCalledWith(['/quiz', 'quiz-1', 'play'], {
      queryParams: { mode: 'multiple-choice', direction: 'definition-to-word' },
    });
  });

  it('tryAgain() for smart review navigates to /quiz/__smart_review__/play', async () => {
    Object.defineProperty(window, 'history', {
      value: { state: { ...mockState, mode: 'flashcard' } },
      writable: true,
      configurable: true,
    });
    router = { navigate: vi.fn().mockResolvedValue(true) };
    wordService = { getWord: vi.fn(), updateWord: vi.fn() };
    quizService = { getQuizSet: vi.fn().mockReturnValue(null), getWordsForQuizSet: vi.fn().mockReturnValue([]) };
    progressService = {
      addResult: vi.fn(),
      getLatestResult: vi.fn().mockReturnValue(undefined),
      eloquenceScore: vi.fn().mockReturnValue(50),
    };
    srService = { calculateNextReview: vi.fn().mockReturnValue({ lastReviewedAt: new Date(), nextReviewDate: new Date(), interval: 1, easeFactor: 2.5, reviewCount: 1 }) };
    mockChrome = { enterFocus: vi.fn(), leaveFocus: vi.fn() };

    TestBed.configureTestingModule({
      imports: [QuizResults],
      providers: [
        { provide: Router, useValue: router },
        { provide: WordService, useValue: wordService },
        { provide: QuizService, useValue: quizService },
        { provide: ProgressService, useValue: progressService },
        { provide: SpacedRepetitionService, useValue: srService },
        { provide: ChromeService, useValue: mockChrome },
      ],
    });
    fixture = TestBed.createComponent(QuizResults);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', '__smart_review__');
    fixture.detectChanges();

    router.navigate.mockClear();
    await component['tryAgain']();
    expect(router.navigate).toHaveBeenCalledWith(['/quiz', '__smart_review__', 'play'], {
      queryParams: { mode: 'flashcard', direction: 'definition-to-word' },
    });
  });

  it('backToQuizzes() navigates to /quiz', async () => {
    setupWithState(mockState);
    await component['backToQuizzes']();
    expect(router.navigate).toHaveBeenCalledWith(['/quiz']);
  });

  it('seeProgress() navigates to /progress', async () => {
    setupWithState(mockState);
    await component['seeProgress']();
    expect(router.navigate).toHaveBeenCalledWith(['/progress']);
  });

  it('reviewInDictionary() passes wrong word IDs as highlight queryParam', async () => {
    setupWithState(mockState);
    await component['reviewInDictionary']();
    expect(router.navigate).toHaveBeenCalledWith(['/dictionary'], {
      queryParams: { highlight: 'word-2,word-4' },
    });
  });

  it('eloquenceDelta signal is set after save', () => {
    setupWithState(mockState);
    expect(component['eloquenceDelta']()).toBe(3);
  });

  it('ngOnInit calls progressService.addResult', () => {
    setupWithState(mockState);
    component.ngOnInit();
    expect(progressService.addResult).toHaveBeenCalled();
  });

  it('ngOnInit calls wordService.updateWord once per word with merged mastery + SR data', () => {
    setupWithState(mockState);

    expect(wordService.updateWord).toHaveBeenCalledTimes(4);

    expect(wordService.updateWord).toHaveBeenCalledWith('word-1', expect.objectContaining({
      masteryLevel: MasteryLevel.Learning,
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 1,
    }));
    expect(wordService.updateWord).toHaveBeenCalledWith('word-3', expect.objectContaining({
      masteryLevel: MasteryLevel.Mastered,
      interval: 1,
    }));
    // word-2 is Learning + WRONG: MASTERY_REGRESSION[Learning] = Learning (no change), so masteryLevel NOT included
    const word2Calls = (wordService.updateWord as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === 'word-2'
    );
    expect(word2Calls.length).toBe(1);
    const word2Update = word2Calls[0][1] as { masteryLevel?: unknown };
    expect(word2Update.masteryLevel).toBeUndefined();
    expect(wordService.updateWord).toHaveBeenCalledWith('word-4', expect.objectContaining({
      masteryLevel: MasteryLevel.Review,
      interval: 1,
    }));
  });

  it('enters focus mode on init', () => {
    setupWithState(mockState);
    expect(mockChrome.enterFocus).toHaveBeenCalled();
  });

  describe('mastery level floor', () => {
    it('MASTERY_REGRESSION floors at MasteryLevel.Learning', () => {
      expect(MASTERY_REGRESSION[MasteryLevel.New]).toBe(MasteryLevel.Learning);
    });

    it('word at MasteryLevel.New answered wrong becomes MasteryLevel.Learning', () => {
      const newWords = [
        { ...mockWords[0], id: 'new-w1', masteryLevel: MasteryLevel.New },
        { ...mockWords[1], id: 'new-w2', masteryLevel: MasteryLevel.New },
      ];
      const newQuizSet = {
        ...mockQuizSet,
        wordIds: ['new-w1', 'new-w2'],
      };
      const allWrongState = {
        score: 0,
        totalQuestions: 2,
        correctAnswers: 0,
        wrongAnswers: ['new-w1', 'new-w2'],
        mode: 'flashcard' as const,
      };

      Object.defineProperty(window, 'history', {
        value: { state: { ...allWrongState } },
        writable: true,
        configurable: true,
      });

      const localRouter = { navigate: vi.fn().mockResolvedValue(true) };
      const localWordService = {
        getWord: vi.fn((id: string) => newWords.find((w) => w.id === id)),
        updateWord: vi.fn(),
      };
      const localQuizService = {
        getQuizSet: vi.fn().mockReturnValue(newQuizSet),
        getWordsForQuizSet: vi.fn().mockReturnValue(newWords),
      };
      const localProgressService = { addResult: vi.fn(), getLatestResult: vi.fn().mockReturnValue(undefined), eloquenceScore: vi.fn().mockReturnValue(0) };
      const localSrService = {
        calculateNextReview: vi.fn().mockReturnValue({
          lastReviewedAt: new Date(),
          nextReviewDate: new Date(),
          interval: 1,
          easeFactor: 2.5,
          reviewCount: 1,
        }),
      };
      const localChrome = { enterFocus: vi.fn(), leaveFocus: vi.fn() };

      TestBed.configureTestingModule({
        imports: [QuizResults],
        providers: [
          { provide: Router, useValue: localRouter },
          { provide: WordService, useValue: localWordService },
          { provide: QuizService, useValue: localQuizService },
          { provide: ProgressService, useValue: localProgressService },
          { provide: SpacedRepetitionService, useValue: localSrService },
          { provide: ChromeService, useValue: localChrome },
        ],
      });

      const f = TestBed.createComponent(QuizResults);
      f.componentRef.setInput('id', 'quiz-1');
      f.detectChanges();

      expect(localWordService.updateWord).toHaveBeenCalledTimes(2);
      const calls = localWordService.updateWord.mock.calls;
      calls.forEach((call: unknown[]) => {
        const changes = call[1] as { masteryLevel?: unknown };
        // New + WRONG → MASTERY_REGRESSION[New] = Learning (different level), so masteryLevel is set
        expect(changes.masteryLevel).toBe(MasteryLevel.Learning);
      });
    });
  });

  it('recovers results from ProgressService when history.state is missing', () => {
    const savedResult = {
      id: 'r1',
      quizSetId: 'quiz-1',
      score: 4,
      totalQuestions: 5,
      accuracy: 80,
      wordResults: [
        { wordId: 'word-1', correct: true },
        { wordId: 'word-2', correct: false },
        { wordId: 'word-3', correct: true },
        { wordId: 'word-4', correct: true },
      ],
      completedAt: new Date(),
    };

    Object.defineProperty(window, 'history', {
      value: { state: {} },
      writable: true,
      configurable: true,
    });

    router = { navigate: vi.fn().mockResolvedValue(true) };
    wordService = {
      getWord: vi.fn((id: string) => mockWords.find((w) => w.id === id)),
      updateWord: vi.fn(),
    };
    quizService = {
      getQuizSet: vi.fn().mockReturnValue(mockQuizSet), getWordsForQuizSet: vi.fn().mockReturnValue(mockWords),
    };
    progressService = { addResult: vi.fn(), getLatestResult: vi.fn().mockReturnValue(savedResult), eloquenceScore: vi.fn().mockReturnValue(50) };
    srService = {
      calculateNextReview: vi.fn().mockReturnValue({
        lastReviewedAt: new Date(),
        nextReviewDate: new Date(),
        interval: 1,
        easeFactor: 2.5,
        reviewCount: 1,
      }),
    };
    mockChrome = { enterFocus: vi.fn(), leaveFocus: vi.fn() };

    TestBed.configureTestingModule({
      imports: [QuizResults],
      providers: [
        { provide: Router, useValue: router },
        { provide: WordService, useValue: wordService },
        { provide: QuizService, useValue: quizService },
        { provide: ProgressService, useValue: progressService },
        { provide: SpacedRepetitionService, useValue: srService },
        { provide: ChromeService, useValue: mockChrome },
      ],
    });

    fixture = TestBed.createComponent(QuizResults);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('id', 'quiz-1');
    fixture.detectChanges();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component['score']()).toBe(4);
    expect(component['totalQuestions']()).toBe(5);
    expect(component['correctAnswers']()).toBe(4);
    expect(component['wrongAnswerIds']()).toEqual(['word-2']);
    expect(progressService.addResult).not.toHaveBeenCalled();
  });
});
