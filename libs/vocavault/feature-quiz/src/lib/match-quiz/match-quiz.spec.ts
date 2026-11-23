import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { MatchQuiz } from './match-quiz';
import { QuizService, WordService, Word, makeWord } from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';

const TEST_WORDS: Word[] = [
  makeWord({ id: 'w1', word: 'apple', definition: 'A fruit' }),
  makeWord({ id: 'w2', word: 'book', definition: 'A written work' }),
  makeWord({ id: 'w3', word: 'car', definition: 'A vehicle' }),
  makeWord({ id: 'w4', word: 'door', definition: 'An entrance' }),
];

const TEST_QUIZ_SET = {
  id: 'qs1',
  name: 'Test Set',
  description: 'Test',
  wordIds: ['w1', 'w2', 'w3', 'w4'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('MatchQuiz', () => {
  let component: MatchQuiz;
  let fixture: ComponentFixture<MatchQuiz>;
  let mockQuizService: Partial<QuizService>;
  let mockWordService: Partial<WordService>;
  let mockToastService: { show: ReturnType<typeof vi.fn>; showWithAction: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.clear();
    mockQuizService = {
      getQuizSet: vi.fn().mockReturnValue(TEST_QUIZ_SET), getWordsForQuizSet: vi.fn().mockReturnValue(TEST_WORDS),
    } as Partial<QuizService>;

    mockWordService = {
      getWord: vi.fn((id: string) => TEST_WORDS.find((w) => w.id === id)),
    } as Partial<WordService>;

    mockToastService = { show: vi.fn(), showWithAction: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MatchQuiz],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'qs1' },
            },
            parent: null,
          },
        },
        { provide: QuizService, useValue: mockQuizService },
        { provide: WordService, useValue: mockWordService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MatchQuiz);
    component = fixture.componentInstance;
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders words and definitions columns', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('button');
    // 4 word tiles + 4 definition tiles = 8 buttons minimum
    expect(buttons.length).toBeGreaterThanOrEqual(8);
  });

  // ── Left-first selection (word → def) ──

  it('select(id, word) sets selectedWordId', () => {
    component['select']('w1', 'word');
    expect(component['selectedWordId']()).toBe('w1');
    expect(component['selectedDefId']()).toBeNull();
  });

  it('tapping selected word again deselects it', () => {
    component['select']('w1', 'word');
    component['select']('w1', 'word');
    expect(component['selectedWordId']()).toBeNull();
  });

  it('does not select already-matched word', () => {
    component['matchedPairIds'].set(['w1']);
    component['select']('w1', 'word');
    expect(component['selectedWordId']()).toBeNull();
  });

  it('left then right correct match adds to matchedPairIds', () => {
    component['select']('w2', 'word');
    component['select']('w2', 'def');
    expect(component['matchedPairIds']()).toContain('w2');
    expect(component['selectedWordId']()).toBeNull();
    expect(component['selectedDefId']()).toBeNull();
  });

  it('left then right wrong match tracks mistake and flashes', async () => {
    vi.useFakeTimers();
    component['select']('w1', 'word');
    component['select']('w2', 'def');
    expect(component['mistakeWordIds']()).toContain('w1');
    expect(component['wrongFlashWordId']()).toBe('w1');

    await vi.runAllTimersAsync();
    expect(component['wrongFlashWordId']()).toBeNull();
    expect(component['selectedWordId']()).toBeNull();
    expect(component['selectedDefId']()).toBeNull();
    vi.useRealTimers();
  });

  // ── Right-first selection (def → word) ──

  it('select(id, def) sets selectedDefId', () => {
    component['select']('w3', 'def');
    expect(component['selectedDefId']()).toBe('w3');
    expect(component['selectedWordId']()).toBeNull();
  });

  it('tapping selected def again deselects it', () => {
    component['select']('w3', 'def');
    component['select']('w3', 'def');
    expect(component['selectedDefId']()).toBeNull();
  });

  it('does not select already-matched def', () => {
    component['matchedPairIds'].set(['w3']);
    component['select']('w3', 'def');
    expect(component['selectedDefId']()).toBeNull();
  });

  it('right then left correct match adds to matchedPairIds', () => {
    component['select']('w3', 'def');
    component['select']('w3', 'word');
    expect(component['matchedPairIds']()).toContain('w3');
    expect(component['selectedWordId']()).toBeNull();
    expect(component['selectedDefId']()).toBeNull();
  });

  it('right then left wrong match tracks mistake and flashes', async () => {
    vi.useFakeTimers();
    component['select']('w3', 'def');
    component['select']('w1', 'word');
    expect(component['mistakeWordIds']()).toContain('w3');
    expect(component['wrongFlashWordId']()).toBe('w3');

    await vi.runAllTimersAsync();
    expect(component['wrongFlashWordId']()).toBeNull();
    expect(component['selectedWordId']()).toBeNull();
    expect(component['selectedDefId']()).toBeNull();
    vi.useRealTimers();
  });

  // ── Selection switching ──

  it('selecting a new word replaces the previous word selection', () => {
    component['select']('w1', 'word');
    component['select']('w2', 'word');
    expect(component['selectedWordId']()).toBe('w2');
  });

  it('selecting a new def replaces the previous def selection', () => {
    component['select']('w1', 'def');
    component['select']('w2', 'def');
    expect(component['selectedDefId']()).toBe('w2');
  });

  // ── Mistake deduplication ──

  it('does not add duplicate to mistakeWordIds on repeated wrong attempts', async () => {
    vi.useFakeTimers();
    component['select']('w1', 'word');
    component['select']('w2', 'def');
    await vi.runAllTimersAsync();

    component['select']('w1', 'word');
    component['select']('w3', 'def');
    await vi.runAllTimersAsync();

    const mistakes = component['mistakeWordIds']();
    const w1Count = mistakes.filter((id) => id === 'w1').length;
    expect(w1Count).toBe(1);
    vi.useRealTimers();
  });

  // ── Completion ──

  it('isComplete() is true when matchedPairIds.length === words.length', () => {
    expect(component['isComplete']()).toBe(false);
    component['matchedPairIds'].set(['w1', 'w2', 'w3', 'w4']);
    expect(component['isComplete']()).toBe(true);
  });

  // ── Unified tileClass ──

  it('tileClass returns ring class when word is selected', () => {
    component['selectedWordId'].set('w1');
    expect(component['tileClass']('w1', 'word')).toContain('ring-2');
  });

  it('tileClass returns ring class when def is selected', () => {
    component['selectedDefId'].set('w3');
    expect(component['tileClass']('w3', 'def')).toContain('ring-2');
  });

  it('tileClass returns green class when matched', () => {
    component['matchedPairIds'].set(['w1']);
    expect(component['tileClass']('w1', 'word')).toContain('green');
    expect(component['tileClass']('w1', 'def')).toContain('green');
  });

  it('tileClass returns red shake class during wrong flash', () => {
    component['wrongFlashWordId'].set('w2');
    expect(component['tileClass']('w2', 'word')).toContain('animate-shake');
    expect(component['tileClass']('w2', 'def')).toContain('animate-shake');
  });

  it('tileClass returns default hover class when unselected', () => {
    expect(component['tileClass']('w1', 'word')).toContain('hover:border-vv-brand');
    expect(component['tileClass']('w1', 'def')).toContain('hover:border-vv-brand');
  });

  // ── finish ──

  it('finish() navigates to results with correct state', () => {
    component['matchedPairIds'].set(['w1', 'w2', 'w3', 'w4']);
    component['mistakeWordIds'].set(['w1']);

    const navigateSpy = vi.spyOn(component['router'], 'navigate');
    component['finish']();

    expect(navigateSpy).toHaveBeenCalledWith(['/quiz', 'qs1', 'results'], {
      state: expect.objectContaining({
        score: 4,
        totalQuestions: 4,
        correctAnswers: 4,
        wrongAnswers: ['w1'],
        mode: 'match',
        direction: 'definition-to-word',
      }),
    });
  });

  // ── hasUnsavedChanges ──

  it('hasUnsavedChanges is false initially', () => {
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('hasUnsavedChanges becomes true when a word is selected', () => {
    component['select']('w1', 'word');
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('hasUnsavedChanges becomes true when a def is selected', () => {
    component['select']('w1', 'def');
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('hasUnsavedChanges becomes true when a pair is matched', () => {
    component['select']('w2', 'word');
    component['select']('w2', 'def');
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  // ── Misc ──

  it('caps words at MAX_MATCH_WORDS (8)', () => {
    expect(component['words']().length).toBeLessThanOrEqual(8);
    expect(component['words']().length).toBe(4);
  });

  it('does NOT show orphan toast when all words present', () => {
    expect(mockToastService.showWithAction).not.toHaveBeenCalledWith(
      expect.stringContaining('removed from this set'),
      expect.anything(),
      'info',
    );
  });

  // ── Matched-pairs reinforcement strip ──

  const strip = () =>
    (fixture.nativeElement as HTMLElement).querySelector('section[aria-label="Matched pairs"]');
  const stripRows = () =>
    (fixture.nativeElement as HTMLElement).querySelectorAll(
      'section[aria-label="Matched pairs"] li',
    );

  it('strip: hidden when no pairs are matched', () => {
    expect(strip()).toBeNull();
  });

  it('strip: shows one row reuniting term + definition for a matched pair', () => {
    component['matchedPairIds'].set(['w1']);
    fixture.detectChanges();
    const rows = stripRows();
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('apple');
    expect(rows[0].textContent).toContain('A fruit');
  });

  it('strip: row count tracks matchedPairIds length', () => {
    component['matchedPairIds'].set(['w1', 'w2', 'w3']);
    fixture.detectChanges();
    expect(stripRows().length).toBe(3);
  });

  it('strip: term + definition are direction-independent', () => {
    // Pin a non-default direction; the strip must still read word → definition.
    fixture.componentRef.setInput('direction', 'word-to-definition');
    fixture.detectChanges();
    const w = component['getWord']('w1')!;
    expect(component['pairTerm'](w)).toBe('apple');
    expect(component['pairMeaning'](w)).toBe('A fruit');
  });

  it('strip: clears when matchedPairIds resets at a round boundary', () => {
    component['matchedPairIds'].set(['w1', 'w2']);
    fixture.detectChanges();
    expect(stripRows().length).toBe(2);

    component['matchedPairIds'].set([]);
    fixture.detectChanges();
    expect(strip()).toBeNull();
  });

  it('strip: definition uses line-clamp so long text cannot grow the row', () => {
    component['matchedPairIds'].set(['w1']);
    fixture.detectChanges();
    const meaning = stripRows()[0].querySelector('.line-clamp-2');
    expect(meaning).not.toBeNull();
    expect(meaning?.textContent).toContain('A fruit');
    // `line-clamp-2` sets `display:-webkit-box`; a `block` utility on the same
    // element silently overrides it and defeats the clamp. Guard against that
    // regression (class presence alone does not prove the clamp works).
    expect(meaning?.classList.contains('block')).toBe(false);
  });

  it('strip: skips an id with no current-round word without throwing', () => {
    component['matchedPairIds'].set(['does-not-exist']);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(stripRows().length).toBe(0);
  });

  it('strip: hidden once the round completes (completion card takes over)', () => {
    component['matchedPairIds'].set(['w1', 'w2', 'w3', 'w4']);
    fixture.detectChanges();
    expect(component['isComplete']()).toBe(true);
    expect(strip()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('All matched');
  });

});

describe('MatchQuiz null/empty definition safety', () => {
  it('renders tiles without throwing when words have null definitions', async () => {
    const nullDefWords: Word[] = [
      makeWord({ id: 'n1', word: 'alpha', definition: null as unknown as string }),
      makeWord({ id: 'n2', word: 'beta', definition: null as unknown as string }),
      makeWord({ id: 'n3', word: 'gamma', definition: '' }),
      makeWord({ id: 'n4', word: 'delta', definition: '' }),
    ];
    const nullDefSet = { ...TEST_QUIZ_SET, wordIds: ['n1', 'n2', 'n3', 'n4'] };

    await TestBed.configureTestingModule({
      imports: [MatchQuiz],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'qs1' } }, parent: null },
        },
        {
          provide: QuizService,
          useValue: {
            getQuizSet: vi.fn().mockReturnValue(nullDefSet),
            getWordsForQuizSet: vi.fn().mockReturnValue(nullDefWords),
          },
        },
        { provide: WordService, useValue: { getWord: vi.fn() } },
        { provide: ToastService, useValue: { show: vi.fn(), showWithAction: vi.fn() } },
      ],
    }).compileComponents();

    expect(() => {
      const f = TestBed.createComponent(MatchQuiz);
      f.detectChanges();
    }).not.toThrow();
  });
});

describe('MatchQuiz direction-input safety (regression)', () => {
  // Reproduces the Quick Quiz crash: routing to match mode without a `direction`
  // query param makes Angular's component-input-binding set `direction` to
  // `undefined`. That previously made columnLabels() return undefined and the
  // template throw on `.left`, blanking the whole grid. The normalizing input
  // transform must coerce it back to the default so the grid still renders.
  it('renders tiles without throwing when direction is set to undefined', async () => {
    await TestBed.configureTestingModule({
      imports: [MatchQuiz],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'qs1' } }, parent: null },
        },
        {
          provide: QuizService,
          useValue: {
            getQuizSet: vi.fn().mockReturnValue(TEST_QUIZ_SET),
            getWordsForQuizSet: vi.fn().mockReturnValue(TEST_WORDS),
          },
        },
        {
          provide: WordService,
          useValue: { getWord: vi.fn((id: string) => TEST_WORDS.find((w) => w.id === id)) },
        },
        { provide: ToastService, useValue: { show: vi.fn(), showWithAction: vi.fn() } },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(MatchQuiz);
    // Exactly what withComponentInputBinding() does when ?direction is absent.
    f.componentRef.setInput('direction', undefined);

    expect(() => f.detectChanges()).not.toThrow();

    const buttons = (f.nativeElement as HTMLElement).querySelectorAll('button');
    // 4 word tiles + 4 definition tiles = 8.
    expect(buttons.length).toBeGreaterThanOrEqual(8);

    const comp = f.componentInstance as unknown as {
      roundDirection: () => string;
      columnLabels: () => { left: string; right: string };
    };
    expect(comp.roundDirection()).toBe('definition-to-word');
    expect(comp.columnLabels()).toEqual({ left: 'Definitions', right: 'Words' });

    await f.whenStable();
    f.destroy();
  });
});

describe('MatchQuiz orphan detection', () => {
  it('shows info toast when words were deleted from quiz set', async () => {
    const orphanQuizSet = {
      ...TEST_QUIZ_SET,
      wordIds: ['w1', 'w2', 'w3', 'w4', 'w_deleted'],
    };
    const orphanToast = { show: vi.fn(), showWithAction: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MatchQuiz],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'qs1' } },
            parent: null,
          },
        },
        {
          provide: QuizService,
          useValue: {
            getQuizSet: vi.fn().mockReturnValue(orphanQuizSet),
            getWordsForQuizSet: vi.fn().mockReturnValue(TEST_WORDS),
          },
        },
        { provide: WordService, useValue: { getWord: vi.fn() } },
        { provide: ToastService, useValue: orphanToast },
      ],
    }).compileComponents();

    TestBed.createComponent(MatchQuiz);

    expect(orphanToast.showWithAction).toHaveBeenCalledWith(
      '1 word was removed from this set',
      expect.objectContaining({ label: 'Edit quiz' }),
      'info',
    );
  });
});
