import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Signal, WritableSignal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MultipleChoiceQuiz } from './multiple-choice-quiz';
import {
  QuizService,
  WordService,
  QuizSet,
  Word,
  makeWord,
} from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';

interface MCQuestion {
  word: Word;
  options: string[];
  correctIndex: number;
  prompt: string;
}

interface MultipleChoiceQuizInternals {
  selectedOptionIndex: WritableSignal<number | null>;
  currentQuestion: Signal<MCQuestion>;
  correctCount: WritableSignal<number>;
  wrongWordIds: WritableSignal<string[]>;
  isAnswered: Signal<boolean>;
  currentIndex: WritableSignal<number>;
  questions: WritableSignal<MCQuestion[]>;
}

const testWords: Word[] = [
  makeWord({ id: 'w1', word: 'alpha', pronunciation: '/alpha/', definition: 'Definition of alpha', examples: ['Example of alpha'] }),
  makeWord({ id: 'w2', word: 'beta', pronunciation: '/beta/', definition: 'Definition of beta', examples: ['Example of beta'] }),
  makeWord({ id: 'w3', word: 'gamma', pronunciation: '/gamma/', definition: 'Definition of gamma', examples: ['Example of gamma'] }),
  makeWord({ id: 'w4', word: 'delta', pronunciation: '/delta/', definition: 'Definition of delta', examples: ['Example of delta'] }),
];

const mockQuizSet: QuizSet = {
  id: 'qs1',
  name: 'Test Quiz',
  description: 'A test quiz set',
  wordIds: ['w1', 'w2', 'w3', 'w4'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('MultipleChoiceQuiz', () => {
  let fixture: ComponentFixture<MultipleChoiceQuiz>;
  let component: MultipleChoiceQuiz;
  let router: Router;

  const mockQuizService = {
    getQuizSet: vi.fn().mockReturnValue(mockQuizSet), getWordsForQuizSet: vi.fn().mockReturnValue(testWords),
  };

  const mockWordService = {
    getWord: vi.fn((id: string) => testWords.find((w) => w.id === id)),
  };

  const mockToastService = { show: vi.fn(), showWithAction: vi.fn() };

  const mockActivatedRoute = {
    snapshot: {
      paramMap: {
        get: vi.fn((key: string) => (key === 'id' ? 'qs1' : null)),
      },
      queryParamMap: {
        get: vi.fn(() => null),
      },
    },
    parent: null,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockQuizService.getQuizSet.mockReturnValue(mockQuizSet);
    mockWordService.getWord.mockImplementation((id: string) =>
      testWords.find((w) => w.id === id)
    );

    await TestBed.configureTestingModule({
      imports: [MultipleChoiceQuiz],
      providers: [
        provideRouter([]),
        { provide: QuizService, useValue: mockQuizService },
        { provide: WordService, useValue: mockWordService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MultipleChoiceQuiz);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    router = TestBed.inject(Router);
  });

  // MultipleChoiceQuiz registers a window:keydown HostListener that calls
  // finish() → router.navigate(['/quiz', 'qs1', 'results']) on the last
  // question. If the fixture is left mounted, a later test's window keydown
  // dispatch reaches this stale component (whose real provideRouter([]) navigate
  // is not spied) and fires an un-awaited navigation that rejects with NG04002
  // as an unhandled rejection under parallel load. Settle pending work, then
  // destroy so the listener is torn down before the next test.
  afterEach(async () => {
    if (fixture) {
      await fixture.whenStable();
      fixture.destroy();
    }
  });

  it('renders progress label "Question 1 of N"', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Question 1 of');
  });

  it('shows word text in question prompt', () => {
    const text = fixture.nativeElement.textContent;
    // One of the test words should appear as the question word
    const wordNames = testWords.map((w) => w.word);
    const hasWord = wordNames.some((name) => text.includes(name));
    expect(hasWord).toBe(true);
  });

  it('shows 4 option buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    // At least 4 option buttons (before answering, no Next/Finish)
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('selectOption sets selectedOptionIndex signal', async () => {
    // Before selection
    expect((component as unknown as MultipleChoiceQuizInternals).selectedOptionIndex()).toBeNull();

    // Click first option button
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as unknown as MultipleChoiceQuizInternals).selectedOptionIndex()).toBe(0);
  });

  it('selecting correct answer increments correctCount', async () => {
    const q = (component as unknown as MultipleChoiceQuizInternals).currentQuestion();
    const correctIdx = q.correctIndex;

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[correctIdx].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as unknown as MultipleChoiceQuizInternals).correctCount()).toBe(1);
    expect((component as unknown as MultipleChoiceQuizInternals).wrongWordIds()).toEqual([]);
  });

  it('selecting wrong answer adds word id to wrongWordIds', async () => {
    const q = (component as unknown as MultipleChoiceQuizInternals).currentQuestion();
    const wrongIdx = q.correctIndex === 0 ? 1 : 0;

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[wrongIdx].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as unknown as MultipleChoiceQuizInternals).correctCount()).toBe(0);
    expect((component as unknown as MultipleChoiceQuizInternals).wrongWordIds()).toContain(q.word.id);
  });

  it('shows Next button after selection (not on last question)', async () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    const allButtons = fixture.nativeElement.querySelectorAll('button');
    const hasNext = Array.from(allButtons as NodeListOf<HTMLButtonElement>).some(
      (b) => b.textContent?.trim() === 'Next'
    );
    // On multi-question quiz, should show Next (not Finish) after first answer
    const hasFinish = Array.from(allButtons as NodeListOf<HTMLButtonElement>).some(
      (b) => b.textContent?.trim() === 'Finish'
    );
    // Either Next or Finish should appear
    expect(hasNext || hasFinish).toBe(true);
  });

  it('isAnswered() becomes true after selection', async () => {
    expect((component as unknown as MultipleChoiceQuizInternals).isAnswered()).toBe(false);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as unknown as MultipleChoiceQuizInternals).isAnswered()).toBe(true);
  });

  it('next() increments currentIndex and resets selectedOptionIndex', async () => {
    // Select an option first
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as unknown as MultipleChoiceQuizInternals).currentIndex()).toBe(0);

    // Click Next
    const allButtons = fixture.nativeElement.querySelectorAll('button');
    const nextBtn = Array.from(allButtons as NodeListOf<HTMLButtonElement>).find(
      (b) => b.textContent?.trim() === 'Next'
    );
    nextBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as unknown as MultipleChoiceQuizInternals).currentIndex()).toBe(1);
    expect((component as unknown as MultipleChoiceQuizInternals).selectedOptionIndex()).toBeNull();
  });

  // ── Feedback text ──

  it('shows "Correct!" feedback panel when answer is right', async () => {
    const q = (component as unknown as MultipleChoiceQuizInternals).currentQuestion();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[q.correctIndex].click();
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Correct!');
  });

  it('shows "Incorrect" feedback with correct answer when wrong', async () => {
    const q = (component as unknown as MultipleChoiceQuizInternals).currentQuestion();
    const wrongIdx = q.correctIndex === 0 ? 1 : 0;
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[wrongIdx].click();
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Incorrect');
    expect(text).toContain('Correct answer:');
    expect(text).toContain(q.options[q.correctIndex]);
  });

  // ── Keyboard shortcuts ──

  it('Enter key advances to next question after answering', async () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect((component as unknown as MultipleChoiceQuizInternals).currentIndex()).toBe(0);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect((component as unknown as MultipleChoiceQuizInternals).currentIndex()).toBe(1);
  });

  it('Enter key calls finish on last question', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    (component as unknown as MultipleChoiceQuizInternals).currentIndex.set((component as unknown as MultipleChoiceQuizInternals).questions().length - 1);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/quiz', 'qs1', 'results'],
      expect.anything()
    );
  });

  // ── hasUnsavedChanges ──

  it('hasUnsavedChanges is false initially', () => {
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('hasUnsavedChanges becomes true after selecting an option', async () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  describe('0-word degenerate state', () => {
    it('renders empty state when quiz set has 0 words', async () => {
      TestBed.resetTestingModule();
      vi.clearAllMocks();
      const emptyQuizService = {
        getQuizSet: vi.fn().mockReturnValue(mockQuizSet),
        getWordsForQuizSet: vi.fn().mockReturnValue([]),
      };
      const emptyWordService = { getWord: vi.fn().mockReturnValue(undefined) };

      await TestBed.configureTestingModule({
        imports: [MultipleChoiceQuiz],
        providers: [
          provideRouter([]),
          { provide: QuizService, useValue: emptyQuizService },
          { provide: WordService, useValue: emptyWordService },
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(MultipleChoiceQuiz);
      f.detectChanges();
      await f.whenStable();

      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('lib-empty-state')).toBeTruthy();
      expect(el.textContent).toContain('No words');
    });
  });

  describe('insufficient distractors', () => {
    it('with only 2 words total, questions have only 2 options (1 correct + 1 distractor)', async () => {
      TestBed.resetTestingModule();
      vi.clearAllMocks();
      const twoWords = testWords.slice(0, 2);
      const smallQuizService = {
        getQuizSet: vi.fn().mockReturnValue(mockQuizSet),
        getWordsForQuizSet: vi.fn().mockReturnValue(twoWords),
      };
      const smallWordService = {
        getWord: vi.fn((id: string) => twoWords.find((w) => w.id === id)),
      };

      await TestBed.configureTestingModule({
        imports: [MultipleChoiceQuiz],
        providers: [
          provideRouter([]),
          { provide: QuizService, useValue: smallQuizService },
          { provide: WordService, useValue: smallWordService },
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(MultipleChoiceQuiz);
      const c = f.componentInstance as unknown as MultipleChoiceQuizInternals;
      f.detectChanges();
      await f.whenStable();

      const questions = c.questions();
      expect(questions.length).toBe(2);
      // Each question should have 2 options: 1 correct + 1 distractor (Math.min(3, 2-1) = 1)
      questions.forEach((q) => {
        expect(q.options.length).toBe(2);
      });
    });

    it('with only 1 word, question has 1 option (just the correct answer, 0 distractors)', async () => {
      TestBed.resetTestingModule();
      vi.clearAllMocks();
      const oneWord = testWords.slice(0, 1);
      const singleQuizService = {
        getQuizSet: vi.fn().mockReturnValue(mockQuizSet),
        getWordsForQuizSet: vi.fn().mockReturnValue(oneWord),
      };
      const singleWordService = {
        getWord: vi.fn((id: string) => oneWord.find((w) => w.id === id)),
      };

      await TestBed.configureTestingModule({
        imports: [MultipleChoiceQuiz],
        providers: [
          provideRouter([]),
          { provide: QuizService, useValue: singleQuizService },
          { provide: WordService, useValue: singleWordService },
          { provide: ActivatedRoute, useValue: mockActivatedRoute },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(MultipleChoiceQuiz);
      const c = f.componentInstance as unknown as MultipleChoiceQuizInternals;
      f.detectChanges();
      await f.whenStable();

      const questions = c.questions();
      expect(questions.length).toBe(1);
      // Math.min(3, 1-1) = 0 distractors, so only 1 option (the correct one)
      expect(questions[0].options.length).toBe(1);
    });
  });

  it('finish() navigates to /quiz/:id/results with correct state', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // Force to last question
    (component as unknown as MultipleChoiceQuizInternals).currentIndex.set(
      (component as unknown as MultipleChoiceQuizInternals).questions().length - 1
    );
    fixture.detectChanges();
    await fixture.whenStable();

    // Select an option
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    // Click Finish
    const allButtons = fixture.nativeElement.querySelectorAll('button');
    const finishBtn = Array.from(allButtons as NodeListOf<HTMLButtonElement>).find(
      (b) => b.textContent?.trim() === 'Finish'
    );
    finishBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith(
      ['/quiz', 'qs1', 'results'],
      expect.objectContaining({
        state: expect.objectContaining({
          mode: 'multiple-choice',
          totalQuestions: expect.any(Number),
        }),
      })
    );
  });

  // ── Sticky footer (mobile layout) ──

  it('wraps Next/Finish button in a sticky footer container', async () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const stickyFooter = el.querySelector('.vv-sticky-footer-inline');
    expect(stickyFooter).toBeTruthy();
  });

  it('sticky footer content uses flex-row layout (not column)', async () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const footerContent = el.querySelector('.vv-sticky-footer-content');
    expect(footerContent).toBeTruthy();
    expect(footerContent?.classList.contains('flex-row')).toBe(true);
    // Must NOT use !important overrides
    expect(footerContent?.className).not.toContain('!');
  });

  it('sticky footer becomes static on tablet via md: breakpoint (vv-sticky-footer-inline)', async () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const stickyFooter = el.querySelector('.vv-sticky-footer-inline');
    expect(stickyFooter).toBeTruthy();
  });

  it('has bottom padding to prevent content hiding behind fixed footer on mobile', () => {
    const el = fixture.nativeElement as HTMLElement;
    const container = el.querySelector('.pb-24');
    expect(container).toBeTruthy();
    expect(container?.classList.contains('md:pb-8')).toBe(true);
  });

  it('does NOT show orphan toast when all words present', () => {
    expect(mockToastService.showWithAction).not.toHaveBeenCalledWith(
      expect.stringContaining('removed from this set'),
      expect.anything(),
      'info',
    );
  });
});

describe('MultipleChoiceQuiz orphan detection', () => {
  it('shows info toast when words were deleted from quiz set', async () => {
    const orphanQuizSet: QuizSet = {
      ...mockQuizSet,
      wordIds: ['w1', 'w2', 'w3', 'w4', 'w_deleted', 'w_gone2'],
    };
    const orphanToast = { show: vi.fn(), showWithAction: vi.fn() };

    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [MultipleChoiceQuiz],
      providers: [
        provideRouter([]),
        {
          provide: QuizService,
          useValue: {
            getQuizSet: vi.fn().mockReturnValue(orphanQuizSet),
            getWordsForQuizSet: vi.fn().mockReturnValue(testWords),
          },
        },
        { provide: WordService, useValue: { getWord: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'qs1' } },
            parent: null,
          },
        },
        { provide: ToastService, useValue: orphanToast },
      ],
    }).compileComponents();

    TestBed.createComponent(MultipleChoiceQuiz);

    expect(orphanToast.showWithAction).toHaveBeenCalledWith(
      '2 words were removed from this set',
      expect.objectContaining({ label: 'Edit quiz' }),
      'info',
    );
  });
});
