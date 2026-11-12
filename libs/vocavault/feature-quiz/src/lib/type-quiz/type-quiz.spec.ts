import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { TypeQuiz } from './type-quiz';
import { QuizService, WordService, makeWord } from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';

const MOCK_WORDS = [
  makeWord({
    id: 'w1',
    word: 'Ephemeral',
    pronunciation: '/ɪˈfem.ər.əl/',
    definition: 'Lasting for a very short time',
    examples: ['The ephemeral beauty of cherry blossoms'],
  }),
  makeWord({
    id: 'w2',
    word: 'Loquacious',
    pronunciation: '/ləˈkweɪ.ʃəs/',
    definition: 'Tending to talk a great deal',
    examples: ['She was loquacious at the party'],
  }),
];

const MOCK_QUIZ_SET = {
  id: 'qs1',
  name: 'Test Set',
  description: 'A test quiz set',
  wordIds: ['w1', 'w2'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Helper to access protected/private members in tests
type ComponentAny = Record<string, unknown>;

describe('TypeQuiz', () => {
  let component: TypeQuiz;
  let fixture: ComponentFixture<TypeQuiz>;
  let mockToastService: { show: ReturnType<typeof vi.fn>; showWithAction: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.clear();
    mockToastService = { show: vi.fn(), showWithAction: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TypeQuiz],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? 'qs1' : null),
              },
            },
            parent: null,
          },
        },
        {
          provide: QuizService,
          useValue: {
            getQuizSet: vi.fn().mockReturnValue(MOCK_QUIZ_SET), getWordsForQuizSet: vi.fn().mockReturnValue(MOCK_WORDS),
          },
        },
        {
          provide: WordService,
          useValue: {
            getWord: vi.fn().mockImplementation((id: string) =>
              MOCK_WORDS.find((w) => w.id === id)
            ),
          },
        },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TypeQuiz);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  // TypeQuiz registers a window:keydown HostListener that calls finish() →
  // router.navigate(['/quiz', 'qs1', 'results']) on the last word. If the
  // fixture is left mounted, a later test's window keydown dispatch reaches this
  // stale component (whose real provideRouter([]) navigate is not spied) and
  // fires an un-awaited navigation that rejects with NG04002 as an unhandled
  // rejection under parallel load. Settle pending work, then destroy so the
  // listener is torn down before the next test.
  afterEach(async () => {
    if (fixture) {
      await fixture.whenStable();
      fixture.destroy();
    }
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders progress label "Word 1 of N"', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Word 1 of 2');
  });

  it('submit button is disabled when input is empty', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const submitBtn = Array.from(buttons).find(
      (b) => b.textContent?.trim() === 'Submit'
    );
    expect(submitBtn?.disabled).toBe(true);
  });

  it('submit() sets isSubmitted to true', () => {
    const comp = component as unknown as ComponentAny;
    (comp['userInput'] as { set(v: string): void }).set('some answer');
    (comp['submit'] as () => void).call(component);
    fixture.detectChanges();

    expect((comp['isSubmitted'] as () => boolean)()).toBe(true);
  });

  it('isCorrect() returns true when input matches answer for current direction', () => {
    const comp = component as unknown as ComponentAny;
    // Default direction is definition-to-word, so the answer is the word itself
    (comp['userInput'] as { set(v: string): void }).set('EPHEMERAL');
    (comp['submit'] as () => void).call(component);

    expect((comp['isCorrect'] as () => boolean)()).toBe(true);
  });

  it('isCorrect() returns false for wrong answer', () => {
    const comp = component as unknown as ComponentAny;
    (comp['userInput'] as { set(v: string): void }).set('totally wrong answer here');
    (comp['submit'] as () => void).call(component);

    expect((comp['isCorrect'] as () => boolean)()).toBe(false);
  });

  it('correct answer increments correctCount', () => {
    const comp = component as unknown as ComponentAny;
    // Default direction is definition-to-word, so the answer is the word
    (comp['userInput'] as { set(v: string): void }).set('Ephemeral');
    (comp['submit'] as () => void).call(component);

    expect((comp['correctCount'] as () => number)()).toBe(1);
  });

  it('wrong answer adds word id to wrongWordIds', () => {
    const comp = component as unknown as ComponentAny;
    (comp['userInput'] as { set(v: string): void }).set('wrong answer');
    (comp['submit'] as () => void).call(component);

    expect((comp['wrongWordIds'] as () => string[])()).toContain('w1');
  });

  it('next() resets userInput and isSubmitted', () => {
    const comp = component as unknown as ComponentAny;
    (comp['userInput'] as { set(v: string): void }).set('something');
    (comp['isSubmitted'] as { set(v: boolean): void }).set(true);
    (comp['next'] as () => void).call(component);

    expect((comp['userInput'] as () => string)()).toBe('');
    expect((comp['isSubmitted'] as () => boolean)()).toBe(false);
  });

  // ── Keyboard: Enter advances after submission ──

  it('Enter key calls next() after submission on non-last word', () => {
    const comp = component as unknown as ComponentAny;
    (comp['userInput'] as { set(v: string): void }).set('wrong answer');
    (comp['submit'] as () => void).call(component);
    expect((comp['currentIndex'] as () => number)()).toBe(0);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect((comp['currentIndex'] as () => number)()).toBe(1);
    expect((comp['isSubmitted'] as () => boolean)()).toBe(false);
  });

  it('Enter key does nothing before submission', () => {
    const comp = component as unknown as ComponentAny;
    (comp['userInput'] as { set(v: string): void }).set('something');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    // Should still be on word 0 (Enter is handled by textarea, not the HostListener)
    expect((comp['currentIndex'] as () => number)()).toBe(0);
  });

  // ── hasUnsavedChanges ──

  it('hasUnsavedChanges is false initially', () => {
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('hasUnsavedChanges becomes true after typing input', () => {
    const comp = component as unknown as ComponentAny;
    (comp['userInput'] as { set(v: string): void }).set('some answer');
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('hasUnsavedChanges becomes true after a correct submission', () => {
    const comp = component as unknown as ComponentAny;
    // Default direction is definition-to-word, so the answer is the word
    (comp['userInput'] as { set(v: string): void }).set('Ephemeral');
    (comp['submit'] as () => void).call(component);
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  describe('0-word degenerate state', () => {
    it('renders empty state when quiz set has 0 words', async () => {
      TestBed.resetTestingModule();
      const emptyQuizService = {
        getQuizSet: vi.fn().mockReturnValue(MOCK_QUIZ_SET),
        getWordsForQuizSet: vi.fn().mockReturnValue([]),
      };
      const emptyWordService = { getWord: vi.fn().mockReturnValue(undefined) };

      await TestBed.configureTestingModule({
        imports: [TypeQuiz],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { paramMap: { get: (key: string) => (key === 'id' ? 'qs1' : null) } },
              parent: null,
            },
          },
          { provide: QuizService, useValue: emptyQuizService },
          { provide: WordService, useValue: emptyWordService },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(TypeQuiz);
      f.detectChanges();
      await f.whenStable();

      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('lib-empty-state')).toBeTruthy();
      expect(el.textContent).toContain('No words');
    });

    it('words() empty and currentWord() undefined, submit() is a no-op', async () => {
      TestBed.resetTestingModule();
      const emptyQuizService = {
        getQuizSet: vi.fn().mockReturnValue(MOCK_QUIZ_SET),
        getWordsForQuizSet: vi.fn().mockReturnValue([]),
      };
      const emptyWordService = { getWord: vi.fn().mockReturnValue(undefined) };

      await TestBed.configureTestingModule({
        imports: [TypeQuiz],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { paramMap: { get: (key: string) => (key === 'id' ? 'qs1' : null) } },
              parent: null,
            },
          },
          { provide: QuizService, useValue: emptyQuizService },
          { provide: WordService, useValue: emptyWordService },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(TypeQuiz);
      const c = f.componentInstance;
      f.detectChanges();

      const comp = c as unknown as ComponentAny;
      expect((comp['words'] as () => unknown[])()).toEqual([]);
      expect((comp['currentWord'] as () => unknown)()).toBeUndefined();
      // submit with input should be no-op (guard: if (!w) return)
      (comp['userInput'] as { set(v: string): void }).set('some answer');
      (comp['submit'] as () => void).call(c);
      expect((comp['isSubmitted'] as () => boolean)()).toBe(false);
    });
  });

  it('finish() navigates to results with correct state', () => {
    const comp = component as unknown as ComponentAny;
    const nav = vi.fn().mockResolvedValue(true);
    Object.defineProperty(component, 'router', { value: { navigate: nav }, writable: true });

    (comp['correctCount'] as { set(v: number): void }).set(1);
    (comp['wrongWordIds'] as { set(v: string[]): void }).set(['w2']);
    (comp['finish'] as () => void).call(component);

    expect(nav).toHaveBeenCalledWith(
      ['/quiz', 'qs1', 'results'],
      expect.objectContaining({
        state: expect.objectContaining({
          score: 1,
          totalQuestions: 2,
          mode: 'type',
        }),
      })
    );
  });

  it('does NOT show orphan toast when all words present', () => {
    expect(mockToastService.showWithAction).not.toHaveBeenCalledWith(
      expect.stringContaining('removed from this set'),
      expect.anything(),
      'info',
    );
  });

  // ── Sticky footer (mobile layout) ──

  it('wraps Next/Finish button in a sticky footer after submit', async () => {
    const comp = component as ComponentAny;
    (comp['userInput'] as ReturnType<typeof import('@angular/core').signal<string>>).set('test answer');
    fixture.detectChanges();
    (comp['submit'] as () => void).call(component);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement as HTMLElement;
    const stickyFooter = el.querySelector('.vv-sticky-footer-inline');
    expect(stickyFooter).toBeTruthy();

    const footerContent = el.querySelector('.vv-sticky-footer-content');
    expect(footerContent).toBeTruthy();
    expect(footerContent?.classList.contains('flex-row')).toBe(true);
    expect(footerContent?.className).not.toContain('!');
  });

  it('has bottom padding to prevent content hiding behind fixed footer', () => {
    const el = fixture.nativeElement as HTMLElement;
    const container = el.querySelector('.pb-24');
    expect(container).toBeTruthy();
    expect(container?.classList.contains('md:pb-8')).toBe(true);
  });
});

describe('TypeQuiz orphan detection', () => {
  it('shows info toast when words were deleted from quiz set', async () => {
    const orphanQuizSet = {
      ...MOCK_QUIZ_SET,
      wordIds: ['w1', 'w2', 'w_deleted'],
    };
    const orphanToast = { show: vi.fn(), showWithAction: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TypeQuiz],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => (key === 'id' ? 'qs1' : null) } },
            parent: null,
          },
        },
        {
          provide: QuizService,
          useValue: {
            getQuizSet: vi.fn().mockReturnValue(orphanQuizSet),
            getWordsForQuizSet: vi.fn().mockReturnValue(MOCK_WORDS),
          },
        },
        { provide: WordService, useValue: { getWord: vi.fn() } },
        { provide: ToastService, useValue: orphanToast },
      ],
    }).compileComponents();

    TestBed.createComponent(TypeQuiz);

    expect(orphanToast.showWithAction).toHaveBeenCalledWith(
      '1 word was removed from this set',
      expect.objectContaining({ label: 'Edit quiz' }),
      'info',
    );
  });
});
