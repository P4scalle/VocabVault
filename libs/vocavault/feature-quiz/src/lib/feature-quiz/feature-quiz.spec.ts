import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { FeatureQuiz } from './feature-quiz';
import {
  FolderService,
  ProgressService,
  QuizService,
  QuizSet,
  QuizSetSource,
  SpacedRepetitionService,
  WordService,
  Word,
  makeWord,
} from '@vocavault/data-access';
import { Signal, WritableSignal, signal } from '@angular/core';
import { ToastService } from '@vocavault/ui';

type QuizFilter = 'all' | QuizSetSource;

interface FeatureQuizInternals {
  toast: ToastService;
  searchQuery: WritableSignal<string>;
  activeSort: WritableSignal<string>;
  activeFilter: WritableSignal<QuizFilter>;
  folderFilter: WritableSignal<string>;
  displayedQuizSets: Signal<QuizSet[]>;
  onDeleteQuizSet: (quizSet: QuizSet) => void;
}

const mockQuizSet: QuizSet = {
  id: 'qs1',
  name: 'Test Quiz',
  description: 'A test quiz set.',
  wordIds: ['w1'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockToughSignal = signal<Word[]>([]);

describe('FeatureQuiz', () => {
  let fixture: ComponentFixture<FeatureQuiz>;
  let router: Router;

  const mockQuizSets = signal<QuizSet[]>([]);

  const mockQuizService = {
    quizSets: mockQuizSets.asReadonly(),
    deleteQuizSet: vi.fn().mockReturnValue(true),
    getWordsForQuizSet: vi.fn().mockReturnValue([]),
    createTempQuizSet: vi.fn(),
    restoreQuizSet: vi.fn().mockReturnValue(true),
  };

  const mockWordService = {
    words: signal<Word[]>([]).asReadonly(),
    toughWords: mockToughSignal.asReadonly(),
  };

  const mockFolderService = {
    folders: signal([]).asReadonly(),
    getFolder: vi.fn().mockReturnValue(undefined),
  };

  const mockProgressService = {
    getLatestResult: vi.fn().mockReturnValue(undefined),
  };

  const mockSrService = {
    getDueCount: vi.fn().mockReturnValue(0),
  };

  beforeEach(async () => {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
        })),
      });
    }
    mockQuizSets.set([]);
    mockToughSignal.set([]);
    mockQuizService.deleteQuizSet.mockClear();
    mockQuizService.createTempQuizSet.mockClear();
    await TestBed.configureTestingModule({
      imports: [FeatureQuiz],
      providers: [
        provideRouter([]),
        { provide: QuizService, useValue: mockQuizService },
        { provide: WordService, useValue: mockWordService },
        { provide: FolderService, useValue: mockFolderService },
        { provide: ProgressService, useValue: mockProgressService },
        { provide: SpacedRepetitionService, useValue: mockSrService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FeatureQuiz);
    router = TestBed.inject(Router);
    // Quiz-set cards fire (keydown.enter)="onCardClick()" which bubbles to
    // onSelectQuizSet → router.navigate(['/quiz', 'qs1']). The keyboard-confirm
    // test dispatches a bubbling Enter keydown, so stub navigate here to keep the
    // real provideRouter([]) from firing an un-awaited navigation that rejects
    // with NG04002 as an unhandled rejection under parallel load. Individual
    // tests that assert navigation re-spy as needed.
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
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

  it('renders "Quizzes" heading', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Quizzes');
  });

  it('shows empty state when no quiz sets', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No quiz sets yet');
  });

  it('renders quiz set cards when quiz sets exist', async () => {
    mockQuizSets.set([mockQuizSet]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Test Quiz');
  });

  it('calls deleteQuizSet via hold button keyboard confirm', async () => {
    mockQuizSets.set([mockQuizSet]);
    fixture.detectChanges();
    await fixture.whenStable();
    const holdBtn = fixture.nativeElement.querySelector('lib-hold-button button');
    holdBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    holdBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(mockQuizService.deleteQuizSet).toHaveBeenCalledWith('qs1');
  });

  it('onDeleteQuizSet shows undo toast and undo restores quiz set', async () => {
    mockQuizSets.set([mockQuizSet]);
    fixture.detectChanges();
    await fixture.whenStable();

    let undoCallback: (() => void) | undefined;
    const toastService = (fixture.componentInstance as unknown as FeatureQuizInternals).toast;
    vi.spyOn(toastService, 'showWithAction').mockImplementation(
      (_msg: string, action: { label: string; callback: () => void }) => {
        undoCallback = action.callback;
      },
    );

    (fixture.componentInstance as unknown as FeatureQuizInternals).onDeleteQuizSet(mockQuizSet);

    expect(toastService.showWithAction).toHaveBeenCalledWith(
      'Quiz set deleted',
      expect.objectContaining({ label: 'Undo' }),
      'info',
    );
    expect(undoCallback).toBeDefined();

    if (undoCallback) undoCallback();
    expect(mockQuizService.restoreQuizSet).toHaveBeenCalledWith(mockQuizSet);
  });

  describe('search, sort, and filter', () => {
    const qs1: QuizSet = {
      id: 'qs-alpha',
      name: 'Alpha Quiz',
      description: '',
      wordIds: ['w1'],
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date(),
    };
    const qs2: QuizSet = {
      id: 'qs-beta',
      name: 'Beta Quiz',
      description: '',
      wordIds: ['w2'],
      createdAt: new Date('2025-02-01'),
      updatedAt: new Date(),
    };
    const qs3: QuizSet = {
      id: 'qs-gamma',
      name: 'Gamma Quiz',
      description: '',
      wordIds: ['w3'],
      createdAt: new Date('2025-03-01'),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockQuizSets.set([qs1, qs2, qs3]);
    });

    describe('search', () => {
      it('should filter quiz sets by search query (name match)', () => {
        fixture.detectChanges();
        (fixture.componentInstance as unknown as FeatureQuizInternals).searchQuery.set('alpha');
        fixture.detectChanges();
        const displayed = (fixture.componentInstance as unknown as FeatureQuizInternals).displayedQuizSets();
        expect(displayed.length).toBe(1);
        expect(displayed[0].id).toBe('qs-alpha');
      });

      it('should show all sets when search query is empty', () => {
        fixture.detectChanges();
        (fixture.componentInstance as unknown as FeatureQuizInternals).searchQuery.set('');
        fixture.detectChanges();
        const displayed = (fixture.componentInstance as unknown as FeatureQuizInternals).displayedQuizSets();
        expect(displayed.length).toBe(3);
      });

      it('should show empty results when no sets match search', () => {
        fixture.detectChanges();
        (fixture.componentInstance as unknown as FeatureQuizInternals).searchQuery.set('xyznotexist');
        fixture.detectChanges();
        const displayed = (fixture.componentInstance as unknown as FeatureQuizInternals).displayedQuizSets();
        expect(displayed.length).toBe(0);
      });
    });

    describe('sort', () => {
      it('should sort by newest (createdAt descending) when activeSort is "newest"', () => {
        fixture.detectChanges();
        (fixture.componentInstance as unknown as FeatureQuizInternals).activeSort.set('newest');
        fixture.detectChanges();
        const displayed = (fixture.componentInstance as unknown as FeatureQuizInternals).displayedQuizSets();
        expect(displayed[0].id).toBe('qs-gamma'); // newest createdAt
        expect(displayed[2].id).toBe('qs-alpha'); // oldest createdAt
      });

      it('should sort alphabetically when activeSort is "alpha"', () => {
        fixture.detectChanges();
        (fixture.componentInstance as unknown as FeatureQuizInternals).activeSort.set('alpha');
        fixture.detectChanges();
        const displayed = (fixture.componentInstance as unknown as FeatureQuizInternals).displayedQuizSets();
        expect(displayed[0].name).toBe('Alpha Quiz');
        expect(displayed[1].name).toBe('Beta Quiz');
        expect(displayed[2].name).toBe('Gamma Quiz');
      });

      it('should sort by accuracy (lowest first) when activeSort is "accuracy"', () => {
        // Set up: qs1 has 80% accuracy, qs2 has 40% accuracy, qs3 has no result
        mockProgressService.getLatestResult.mockImplementation((id: string) => {
          if (id === 'qs-alpha') return { accuracy: 80, completedAt: new Date() };
          if (id === 'qs-beta') return { accuracy: 40, completedAt: new Date() };
          return undefined;
        });
        fixture.detectChanges();
        (fixture.componentInstance as unknown as FeatureQuizInternals).activeSort.set('accuracy');
        fixture.detectChanges();
        const displayed = (fixture.componentInstance as unknown as FeatureQuizInternals).displayedQuizSets();
        // Lowest accuracy first: Beta (40), Alpha (80), Gamma (Infinity)
        expect(displayed[0].id).toBe('qs-beta');
        expect(displayed[1].id).toBe('qs-alpha');
        mockProgressService.getLatestResult.mockReturnValue(undefined);
      });
    });

    describe('folder filter', () => {
      it('should filter quiz sets by folder (only sets containing words from that folder)', () => {
        // qs1 has w1 which belongs to folder-1, qs2 has w2 which does not
        const wordsSignal = signal<Word[]>([
          makeWord({ id: 'w1', folderId: 'folder-1' }),
          makeWord({ id: 'w2' }),
          makeWord({ id: 'w3' }),
        ]);
        // Override mockWordService.words for this test
        Object.defineProperty(mockWordService, 'words', {
          value: wordsSignal.asReadonly(),
          configurable: true,
        });

        fixture.detectChanges();
        (fixture.componentInstance as unknown as FeatureQuizInternals).folderFilter.set('folder-1');
        fixture.detectChanges();
        const displayed = (fixture.componentInstance as unknown as FeatureQuizInternals).displayedQuizSets();
        expect(displayed.length).toBe(1);
        expect(displayed[0].id).toBe('qs-alpha');

        // Restore
        Object.defineProperty(mockWordService, 'words', {
          value: signal<Word[]>([]).asReadonly(),
          configurable: true,
        });
      });

      it('should show all sets when folder filter is cleared', () => {
        fixture.detectChanges();
        (fixture.componentInstance as unknown as FeatureQuizInternals).folderFilter.set('');
        fixture.detectChanges();
        const displayed = (fixture.componentInstance as unknown as FeatureQuizInternals).displayedQuizSets();
        expect(displayed.length).toBe(3);
      });
    });

    describe('combined filters', () => {
      it('should apply search + source filter together', () => {
        // Add an imported quiz set named "Alpha" and a manual one
        const qs4: QuizSet = {
          id: 'qs-imported-alpha',
          name: 'Alpha Import',
          description: '',
          wordIds: ['w1'],
          source: 'import',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const qs5: QuizSet = {
          id: 'qs-manual-alpha',
          name: 'Alpha Manual',
          description: '',
          wordIds: ['w1'],
          source: 'manual',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockQuizSets.set([qs4, qs5]);
        fixture.detectChanges();

        // Search for "alpha" with all filter → both found
        (fixture.componentInstance as unknown as FeatureQuizInternals).searchQuery.set('alpha');
        (fixture.componentInstance as unknown as FeatureQuizInternals).activeFilter.set('all');
        fixture.detectChanges();
        const allResults = (fixture.componentInstance as unknown as FeatureQuizInternals).displayedQuizSets();
        expect(allResults.length).toBe(2);

        // Filter to import source only → only qs4
        (fixture.componentInstance as unknown as FeatureQuizInternals).activeFilter.set('import');
        fixture.detectChanges();
        const importedResults = (fixture.componentInstance as unknown as FeatureQuizInternals).displayedQuizSets();
        expect(importedResults.length).toBe(1);
        expect(importedResults[0].id).toBe('qs-imported-alpha');
      });
    });
  });

  describe('tough words banner', () => {
    it('does not show banner when no tough words', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      const banner = fixture.nativeElement.querySelector('[data-testid="tough-words-banner"]');
      expect(banner).toBeFalsy();
    });

    it('shows banner when tough words exist', async () => {
      mockToughSignal.set([makeWord({ id: 'sw1' }), makeWord({ id: 'sw2' }), makeWord({ id: 'sw3' })]);
      fixture.detectChanges();
      await fixture.whenStable();
      const banner: HTMLElement = fixture.nativeElement.querySelector('[data-testid="tough-words-banner"]');
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain('3 tough ones worth another round');
    });

    it('navigates to flashcard play when Practice clicked', async () => {
      mockToughSignal.set([makeWord({ id: 'sw1' }), makeWord({ id: 'sw2' })]);
      fixture.detectChanges();
      await fixture.whenStable();

      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const banner: HTMLElement = fixture.nativeElement.querySelector('[data-testid="tough-words-banner"]');
      const practiceBtn = banner.querySelector('button') as HTMLButtonElement;
      practiceBtn.click();

      expect(mockQuizService.createTempQuizSet).toHaveBeenCalledWith(['sw1', 'sw2'], 'The Tough Ones', '__tough-ones__');
      expect(navigateSpy).toHaveBeenCalledWith(
        ['/quiz', '__tough-ones__', 'play'],
        { queryParams: { mode: 'flashcard', direction: 'definition-to-word' } },
      );
    });
  });
});
