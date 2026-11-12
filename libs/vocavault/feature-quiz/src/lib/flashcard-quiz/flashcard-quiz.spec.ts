import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { Signal, WritableSignal } from '@angular/core';
import { vi } from 'vitest';
import { FlashcardQuiz } from './flashcard-quiz';
import { QuizService, WordService, QuizSet, Word, MasteryLevel, makeWord } from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';

interface FlashcardQuizInternals {
  isFlipped: WritableSignal<boolean>;
  currentIndex: WritableSignal<number>;
  reviewedCount: Signal<number>;
  currentAssessed: Signal<boolean>;
  words: Signal<Word[]>;
  currentWord: Signal<Word | undefined>;
  flipCard: () => void;
  markGotIt: () => void;
  markMissed: () => void;
  prevCard: () => void;
  nextCard: () => void;
  finish: () => void;
}

const mockQuizSet: QuizSet = {
  id: 'qs1',
  name: 'Test Quiz',
  description: 'A test quiz set',
  wordIds: ['w1', 'w2', 'w3'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockWords: Word[] = [
  makeWord({ id: 'w1', word: 'Apple', pronunciation: '/ˈæp.əl/', definition: 'A round fruit', examples: ['I ate an apple'] }),
  makeWord({ id: 'w2', word: 'Banana', pronunciation: '/bəˈnɑː.nə/', definition: 'A yellow fruit', examples: ['The banana is ripe'], masteryLevel: MasteryLevel.Learning }),
  makeWord({ id: 'w3', word: 'Cherry', pronunciation: '/ˈtʃer.i/', definition: 'A small red fruit', examples: ['Cherry on top'], masteryLevel: MasteryLevel.Mastered }),
];

describe('FlashcardQuiz', () => {
  let component: FlashcardQuiz;
  let fixture: ComponentFixture<FlashcardQuiz>;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockQuizService: { getQuizSet: ReturnType<typeof vi.fn>; getWordsForQuizSet: ReturnType<typeof vi.fn> };
  let mockWordService: { getWord: ReturnType<typeof vi.fn> };
  let mockToastService: { show: ReturnType<typeof vi.fn>; showWithAction: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockRouter = { navigate: vi.fn().mockResolvedValue(true) };
    mockQuizService = { getQuizSet: vi.fn().mockReturnValue(mockQuizSet), getWordsForQuizSet: vi.fn().mockReturnValue(mockWords) };
    mockToastService = { show: vi.fn(), showWithAction: vi.fn() };
    mockWordService = {
      getWord: vi.fn().mockImplementation((id: string) =>
        mockWords.find((w) => w.id === id)
      ),
    };

    await TestBed.configureTestingModule({
      imports: [FlashcardQuiz],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: vi.fn().mockReturnValue('qs1'),
              },
            },
            parent: {
              snapshot: {
                paramMap: {
                  get: vi.fn().mockReturnValue('qs1'),
                },
              },
            },
          },
        },
        { provide: QuizService, useValue: mockQuizService },
        { provide: WordService, useValue: mockWordService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockImplementation(mockRouter.navigate);

    fixture = TestBed.createComponent(FlashcardQuiz);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  // Settle pending async work while the component is still attached, then
  // destroy deterministically so no stale real-router navigation can surface in
  // a later test as an unhandled rejection under parallel load.
  afterEach(async () => {
    if (fixture) {
      await fixture.whenStable();
      fixture.destroy();
    }
  });

  it('renders Card 1 of N progress label', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Card 1 of 3');
  });

  it('shows word text on front face', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Apple');
  });

  it('flipCard() toggles isFlipped signal', () => {
    expect((component as unknown as FlashcardQuizInternals).isFlipped()).toBe(false);
    (component as unknown as FlashcardQuizInternals).flipCard();
    expect((component as unknown as FlashcardQuizInternals).isFlipped()).toBe(true);
    (component as unknown as FlashcardQuizInternals).flipCard();
    expect((component as unknown as FlashcardQuizInternals).isFlipped()).toBe(false);
  });

  it('markGotIt() records verdict and advances', () => {
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    expect((component as unknown as FlashcardQuizInternals).reviewedCount()).toBe(1);
    expect((component as unknown as FlashcardQuizInternals).currentIndex()).toBe(1);
    expect((component as unknown as FlashcardQuizInternals).isFlipped()).toBe(false);
    expect((component as unknown as FlashcardQuizInternals).currentAssessed()).toBe(false);
  });

  it('markMissed() records missed verdict and advances', () => {
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markMissed();
    expect((component as unknown as FlashcardQuizInternals).reviewedCount()).toBe(1);
    expect((component as unknown as FlashcardQuizInternals).currentIndex()).toBe(1);
  });

  it('prevCard() decrements currentIndex (min 0)', () => {
    expect((component as unknown as FlashcardQuizInternals).currentIndex()).toBe(0);
    (component as unknown as FlashcardQuizInternals).prevCard();
    expect((component as unknown as FlashcardQuizInternals).currentIndex()).toBe(0);
  });

  it('nextCard() advances to next card after assessment', () => {
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    // markGotIt auto-advances, go back
    (component as unknown as FlashcardQuizInternals).prevCard();
    expect((component as unknown as FlashcardQuizInternals).currentIndex()).toBe(0);
    // Now use nextCard to go forward
    (component as unknown as FlashcardQuizInternals).nextCard();
    expect((component as unknown as FlashcardQuizInternals).currentIndex()).toBe(1);
    expect((component as unknown as FlashcardQuizInternals).isFlipped()).toBe(false);
  });

  it('nextCard() does nothing on last card', () => {
    // Navigate to last card
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    const lastIdx = (component as unknown as FlashcardQuizInternals).currentIndex();
    (component as unknown as FlashcardQuizInternals).nextCard();
    expect((component as unknown as FlashcardQuizInternals).currentIndex()).toBe(lastIdx);
  });

  it('revisiting an already-assessed card does NOT show assessment buttons', () => {
    // Assess card 0
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    // Now on card 1, go back to card 0
    (component as unknown as FlashcardQuizInternals).prevCard();
    expect((component as unknown as FlashcardQuizInternals).currentIndex()).toBe(0);
    // Card 0 was already assessed
    expect((component as unknown as FlashcardQuizInternals).currentAssessed()).toBe(true);
  });

  it('re-assessing a revisited card does NOT double-count', () => {
    // Assess card 0 as correct
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    // Advance to card 1, assess
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    // Go back to card 0
    (component as unknown as FlashcardQuizInternals).prevCard();
    (component as unknown as FlashcardQuizInternals).prevCard();
    expect((component as unknown as FlashcardQuizInternals).currentIndex()).toBe(0);
    // Already assessed, so reviewedCount should still be 2
    expect((component as unknown as FlashcardQuizInternals).reviewedCount()).toBe(2);
  });

  it('finish() sends correct wrong answers in results state', () => {
    const router = TestBed.inject(Router);
    // Miss card 0
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markMissed();
    // Got card 1
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    // Got card 2 (last card, so advance is no-op)
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    (component as unknown as FlashcardQuizInternals).finish();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/quiz', 'qs1', 'results'],
      expect.objectContaining({
        state: expect.objectContaining({
          mode: 'flashcard',
          totalQuestions: 3,
          correctAnswers: 2,
          wrongAnswers: ['w1'],
        }),
      })
    );
  });

  // ── hasUnsavedChanges ──

  it('hasUnsavedChanges is false initially', () => {
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('hasUnsavedChanges becomes true after marking a card', () => {
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  describe('0-word degenerate state', () => {
    it('renders empty state when quiz set has 0 playable words', async () => {
      TestBed.resetTestingModule();
      const emptyQuizService = { getQuizSet: vi.fn().mockReturnValue(mockQuizSet), getWordsForQuizSet: vi.fn().mockReturnValue([]) };
      const emptyWordService = { getWord: vi.fn().mockReturnValue(undefined) };

      await TestBed.configureTestingModule({
        imports: [FlashcardQuiz],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { paramMap: { get: vi.fn().mockReturnValue('qs1') } },
              parent: { snapshot: { paramMap: { get: vi.fn().mockReturnValue('qs1') } } },
            },
          },
          { provide: QuizService, useValue: emptyQuizService },
          { provide: WordService, useValue: emptyWordService },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(FlashcardQuiz);
      f.detectChanges();
      await f.whenStable();

      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('lib-empty-state')).toBeTruthy();
      expect(el.textContent).toContain('No words');
    });

    it('words() returns empty array and currentWord() is undefined with 0 words', async () => {
      TestBed.resetTestingModule();
      const emptyQuizService = { getQuizSet: vi.fn().mockReturnValue(mockQuizSet), getWordsForQuizSet: vi.fn().mockReturnValue([]) };
      const emptyWordService = { getWord: vi.fn().mockReturnValue(undefined) };

      await TestBed.configureTestingModule({
        imports: [FlashcardQuiz],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { paramMap: { get: vi.fn().mockReturnValue('qs1') } },
              parent: { snapshot: { paramMap: { get: vi.fn().mockReturnValue('qs1') } } },
            },
          },
          { provide: QuizService, useValue: emptyQuizService },
          { provide: WordService, useValue: emptyWordService },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(FlashcardQuiz);
      const c = f.componentInstance;
      f.detectChanges();

      expect((c as unknown as FlashcardQuizInternals).words()).toEqual([]);
      expect((c as unknown as FlashcardQuizInternals).currentWord()).toBeUndefined();
    });
  });

  it('changing verdict on revisited card updates the result', () => {
    const router = TestBed.inject(Router);
    // Mark card 0 as missed
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markMissed();
    // Assess cards 1 and 2
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    // Go back to card 0, change verdict to correct
    (component as unknown as FlashcardQuizInternals).prevCard();
    (component as unknown as FlashcardQuizInternals).prevCard();
    (component as unknown as FlashcardQuizInternals).prevCard();
    expect((component as unknown as FlashcardQuizInternals).currentIndex()).toBe(0);
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt(); // overwrite missed → correct
    // Navigate forward to last card
    // card 0 assessed → advance doesn't fire (already at 0 going to 1... wait)
    // Actually markGotIt calls advance(), but card 0 is not last so it goes to 1
    // Then we need to get to last card
    (component as unknown as FlashcardQuizInternals).flipCard(); // card 1 already assessed, but flip works
    // card 1 is already assessed, just navigate forward
    (component as unknown as FlashcardQuizInternals).prevCard(); // hack: just call finish directly
    // Actually let's just finish from wherever we are
    (component as unknown as FlashcardQuizInternals).finish();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/quiz', 'qs1', 'results'],
      expect.objectContaining({
        state: expect.objectContaining({
          correctAnswers: 3,
          wrongAnswers: [],
        }),
      })
    );
  });

  // ── Sticky footer (mobile layout) ──

  it('wraps assessment buttons in a sticky footer after flip', () => {
    (component as unknown as FlashcardQuizInternals).flipCard();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const stickyFooter = el.querySelector('.vv-sticky-footer-inline');
    expect(stickyFooter).toBeTruthy();

    const footerContent = el.querySelector('.vv-sticky-footer-content');
    expect(footerContent).toBeTruthy();
    expect(footerContent?.classList.contains('flex-row')).toBe(true);
    expect(footerContent?.className).not.toContain('!');
  });

  it('wraps navigation buttons in a sticky footer after assessment', () => {
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    (component as unknown as FlashcardQuizInternals).prevCard();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const stickyFooters = el.querySelectorAll('.vv-sticky-footer-inline');
    expect(stickyFooters.length).toBeGreaterThanOrEqual(1);
  });

  it('has bottom padding to prevent content hiding behind fixed footer', () => {
    const el = fixture.nativeElement as HTMLElement;
    const container = el.querySelector('.pb-24');
    expect(container).toBeTruthy();
    expect(container?.classList.contains('md:pb-8')).toBe(true);
  });

  // ── Desktop width alignment (regression) ──
  // The flashcard card, flag banner, and sticky footers must share one width so
  // the action buttons expand to the card width on desktop instead of shrinking
  // to content inside the items-center column.

  it('aligns the flag banner to the shared quiz column width', () => {
    const el = fixture.nativeElement as HTMLElement;
    const flagBanner = el.querySelector('lib-quiz-flag-banner');
    expect(flagBanner).toBeTruthy();
    expect(flagBanner?.classList.contains('vv-quiz-col')).toBe(true);
  });

  it('constrains the assessment footer to the card width on desktop', () => {
    (component as unknown as FlashcardQuizInternals).flipCard();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const footer = el.querySelector('.vv-sticky-footer-inline');
    expect(footer).toBeTruthy();
    // md:max-w-md keeps the Missed it / Got it buttons aligned with the card.
    expect(footer?.classList.contains('md:max-w-md')).toBe(true);
    expect(footer?.classList.contains('md:w-full')).toBe(true);
  });

  it('constrains the navigation footer to the card width on desktop', () => {
    (component as unknown as FlashcardQuizInternals).flipCard();
    (component as unknown as FlashcardQuizInternals).markGotIt();
    (component as unknown as FlashcardQuizInternals).prevCard();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const footer = el.querySelector('.vv-sticky-footer-inline');
    expect(footer).toBeTruthy();
    expect(footer?.classList.contains('md:max-w-md')).toBe(true);
  });

  // ── Orphaned word detection ──

  it('does NOT show orphan toast when all words present', () => {
    expect(mockToastService.showWithAction).not.toHaveBeenCalledWith(
      expect.stringContaining('removed from this set'),
      expect.anything(),
      'info',
    );
  });
});

describe('FlashcardQuiz orphan detection', () => {
  it('shows info toast when words were deleted from quiz set', async () => {
    const orphanQuizSet: QuizSet = {
      ...mockQuizSet,
      wordIds: ['w1', 'w2', 'w3', 'w_deleted', 'w_gone'],
    };
    const orphanToast = { show: vi.fn(), showWithAction: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [FlashcardQuiz],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: vi.fn().mockReturnValue('qs1') } },
            parent: { snapshot: { paramMap: { get: vi.fn().mockReturnValue('qs1') } } },
          },
        },
        {
          provide: QuizService,
          useValue: {
            getQuizSet: vi.fn().mockReturnValue(orphanQuizSet),
            getWordsForQuizSet: vi.fn().mockReturnValue(mockWords),
          },
        },
        { provide: WordService, useValue: { getWord: vi.fn() } },
        { provide: ToastService, useValue: orphanToast },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    TestBed.createComponent(FlashcardQuiz);

    expect(orphanToast.showWithAction).toHaveBeenCalledWith(
      '2 words were removed from this set',
      expect.objectContaining({ label: 'Edit quiz' }),
      'info',
    );
  });
});
