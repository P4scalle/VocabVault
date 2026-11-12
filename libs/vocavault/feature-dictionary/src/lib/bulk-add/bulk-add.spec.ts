// @vitest-environment jsdom
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { BulkAdd } from './bulk-add';
import {
  BulkImportService,
  QuizService,
  WordService,
  FolderService,
  StorageService,
  LocalStorageService,
  Word,
  ParsedRow,
  DetectedDelimiter,
} from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';

type MockFn = ReturnType<typeof vi.fn>;

interface MockBulkService {
  rows: WritableSignal<ParsedRow[]>;
  importableCount: WritableSignal<number>;
  lastInputText: WritableSignal<string>;
  detectedDelimiter: WritableSignal<DetectedDelimiter | null>;
  mixedSeparators: WritableSignal<DetectedDelimiter[]>;
  detectedWordsOnly: WritableSignal<boolean>;
  wordsOnlyMode: WritableSignal<boolean>;
  lookupProgress: WritableSignal<{ current: number; total: number }>;
  currentLookupWord: WritableSignal<string>;
  readyCount: WritableSignal<number>;
  amberCount: WritableSignal<number>;
  redCount: WritableSignal<number>;
  restoreDraft: MockFn;
  getImportableWords: MockFn;
  clearDraft: MockFn;
  saveDraft: MockFn;
  reset: MockFn;
  parseText: MockFn;
  toggleWordsOnlyMode: MockFn;
  parseFile: MockFn;
  lookupAll: MockFn;
  updateRow: MockFn;
  updateRowStatus: MockFn;
}

interface MockWordService {
  words: ReturnType<typeof signal<Word[]>>;
  addWords: MockFn;
  updateWord: MockFn;
  deleteWords: MockFn;
  getWord: MockFn;
}

interface MockToast {
  show: MockFn;
  showWithAction: MockFn;
}

interface MockQuizService {
  createTempQuizSet: MockFn;
  addQuizSet: MockFn;
}

interface MockRouter {
  navigate: MockFn;
}

interface BulkAddInternals {
  onImport(): void;
  onGoToIncomplete(): void;
  onBackToDictionary(): void;
  onDoneNoImport(): void;
  onQuizImported(): void;
  onAddMore(): void;
  importComplete: WritableSignal<boolean>;
  importedCount: WritableSignal<number>;
  incompleteImportedCount: WritableSignal<number>;
  showCount: WritableSignal<number>;
  importedWordIds: WritableSignal<string[]>;
  selectedFolderId: WritableSignal<string | null>;
  step: WritableSignal<'input' | 'preview'>;
}

describe('BulkAdd', () => {
  let fixture: ComponentFixture<BulkAdd>;
  let component: BulkAdd;
  let mockBulkService: MockBulkService;
  let mockWordService: MockWordService;
  let mockToast: MockToast;
  let mockQuizService: MockQuizService;
  let mockRouter: MockRouter;

  beforeEach(async () => {
    mockBulkService = {
      rows: signal([]),
      importableCount: signal(0),
      lastInputText: signal(''),
      detectedDelimiter: signal(null),
      mixedSeparators: signal([]),
      detectedWordsOnly: signal(false),
      wordsOnlyMode: signal(false),
      lookupProgress: signal({ current: 0, total: 0 }),
      currentLookupWord: signal(''),
      readyCount: signal(0),
      amberCount: signal(0),
      redCount: signal(0),
      restoreDraft: vi.fn().mockReturnValue(false),
      getImportableWords: vi.fn().mockReturnValue({ newWords: [], mergeWords: [] }),
      clearDraft: vi.fn(),
      saveDraft: vi.fn(),
      reset: vi.fn(),
      parseText: vi.fn(),
      toggleWordsOnlyMode: vi.fn(),
      parseFile: vi.fn(),
      lookupAll: vi.fn(),
      updateRow: vi.fn(),
      updateRowStatus: vi.fn(),
    };

    mockWordService = {
      words: signal<Word[]>([]).asReadonly(),
      addWords: vi.fn().mockReturnValue({ words: [], ok: true }),
      updateWord: vi.fn().mockReturnValue(true),
      deleteWords: vi.fn(),
      getWord: vi.fn().mockImplementation((id: string) => ({ id, word: id, definition: `def-${id}`, incomplete: false })),
    };

    mockToast = {
      show: vi.fn(),
      showWithAction: vi.fn(),
    };

    const mockFolderService = {
      folders: signal([]),
      folderWordCounts: signal(new Map()),
    };

    mockQuizService = {
      createTempQuizSet: vi.fn(),
      addQuizSet: vi.fn().mockReturnValue({ quizSet: {}, ok: true }),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [BulkAdd],
      providers: [
        { provide: StorageService, useClass: LocalStorageService },
        { provide: BulkImportService, useValue: mockBulkService },
        { provide: WordService, useValue: mockWordService },
        { provide: FolderService, useValue: mockFolderService },
        { provide: ToastService, useValue: mockToast },
        { provide: QuizService, useValue: mockQuizService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BulkAdd);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('import with incomplete words', () => {
    it('tracks incompleteImportedCount after import', () => {
      mockBulkService.getImportableWords.mockReturnValue({
        newWords: [
          { word: 'Apple', definition: 'A fruit', pronunciation: '', examples: [] },
          { word: 'Banana', definition: '', pronunciation: '', examples: [], incomplete: true },
          { word: 'Cherry', definition: '', pronunciation: '', examples: [], incomplete: true },
        ],
        mergeWords: [],
      });
      mockWordService.addWords.mockReturnValue({
        words: [
          { id: 'w1', word: 'Apple' },
          { id: 'w2', word: 'Banana' },
          { id: 'w3', word: 'Cherry' },
        ],
        ok: true,
      });

      fixture.detectChanges();
      (component as unknown as BulkAddInternals).onImport();

      expect((component as unknown as BulkAddInternals).importComplete()).toBe(true);
      expect((component as unknown as BulkAddInternals).importedCount()).toBe(3);
      expect((component as unknown as BulkAddInternals).incompleteImportedCount()).toBe(2);
    });

    it('sets incompleteImportedCount to 0 when all words have definitions', () => {
      mockBulkService.getImportableWords.mockReturnValue({
        newWords: [
          { word: 'Apple', definition: 'A fruit', pronunciation: '', examples: [] },
        ],
        mergeWords: [],
      });
      mockWordService.addWords.mockReturnValue({
        words: [{ id: 'w1', word: 'Apple' }],
        ok: true,
      });

      fixture.detectChanges();
      (component as unknown as BulkAddInternals).onImport();

      expect((component as unknown as BulkAddInternals).incompleteImportedCount()).toBe(0);
    });

    it('shows "needs attention" button when incomplete words exist', () => {
      fixture.detectChanges();
      (component as unknown as BulkAddInternals).importComplete.set(true);
      (component as unknown as BulkAddInternals).importedCount.set(3);
      (component as unknown as BulkAddInternals).incompleteImportedCount.set(2);
      (component as unknown as BulkAddInternals).showCount.set(3);
      fixture.detectChanges();

      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      );
      const needsAttentionBtn = buttons.find((b: HTMLButtonElement) =>
        b.textContent?.includes('Fix them now'),
      );
      expect(needsAttentionBtn).toBeTruthy();
    });

    it('does not show "needs attention" button when no incomplete words', () => {
      fixture.detectChanges();
      (component as unknown as BulkAddInternals).importComplete.set(true);
      (component as unknown as BulkAddInternals).importedCount.set(2);
      (component as unknown as BulkAddInternals).incompleteImportedCount.set(0);
      (component as unknown as BulkAddInternals).showCount.set(2);
      fixture.detectChanges();

      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      );
      const needsAttentionBtn = buttons.find((b: HTMLButtonElement) =>
        b.textContent?.includes('Fix them now'),
      );
      expect(needsAttentionBtn).toBeFalsy();
    });

    it('shows explanation text about needing definitions', () => {
      fixture.detectChanges();
      (component as unknown as BulkAddInternals).importComplete.set(true);
      (component as unknown as BulkAddInternals).importedCount.set(3);
      (component as unknown as BulkAddInternals).incompleteImportedCount.set(2);
      (component as unknown as BulkAddInternals).showCount.set(3);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('2 words still need definitions before they appear in quizzes');
    });

    it('uses singular grammar for 1 incomplete word', () => {
      fixture.detectChanges();
      (component as unknown as BulkAddInternals).importComplete.set(true);
      (component as unknown as BulkAddInternals).importedCount.set(2);
      (component as unknown as BulkAddInternals).incompleteImportedCount.set(1);
      (component as unknown as BulkAddInternals).showCount.set(2);
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('1 word still needs a definition before it appears in quizzes');
    });
  });

  describe('onGoToIncomplete', () => {
    it('emits viewIncomplete and resets bulk service', () => {
      let emitted = false;
      component.viewIncomplete.subscribe(() => (emitted = true));
      fixture.detectChanges();
      (component as unknown as BulkAddInternals).onGoToIncomplete();
      expect(emitted).toBe(true);
      expect(mockBulkService.reset).toHaveBeenCalled();
    });
  });

  describe('onBackToDictionary', () => {
    it('emits imported count and resets bulk service', () => {
      let emittedCount = -1;
      component.imported.subscribe((n) => (emittedCount = n));
      fixture.detectChanges();
      (component as unknown as BulkAddInternals).importedCount.set(5);
      (component as unknown as BulkAddInternals).onBackToDictionary();
      expect(emittedCount).toBe(5);
      expect(mockBulkService.reset).toHaveBeenCalled();
    });
  });

  describe('onDoneNoImport', () => {
    it('resets bulk service and emits cancelled when nothing to import', () => {
      let emitted = false;
      component.cancelled.subscribe(() => (emitted = true));
      fixture.detectChanges();
      (component as unknown as BulkAddInternals).onDoneNoImport();
      expect(emitted).toBe(true);
      expect(mockBulkService.reset).toHaveBeenCalled();
    });
  });

  describe('onQuizImported', () => {
    it('persists a full quiz set and creates a capped temp set for immediate play', () => {
      fixture.detectChanges();
      (component as unknown as BulkAddInternals).importedWordIds.set(['w1', 'w2', 'w3']);

      (component as unknown as BulkAddInternals).onQuizImported();

      // Persists the full import as a real quiz set
      expect(mockQuizService.addQuizSet).toHaveBeenCalledWith(
        expect.objectContaining({
          wordIds: ['w1', 'w2', 'w3'],
          source: 'import',
        }),
      );

      // Creates a capped temp set for immediate play (3 words < 20 limit, so all included)
      expect(mockQuizService.createTempQuizSet).toHaveBeenCalledWith(
        expect.arrayContaining(['w1', 'w2', 'w3']),
        'Imported Words',
        '__bulk_import__',
      );
      expect(mockBulkService.reset).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/quiz', '__bulk_import__', 'play'],
        { queryParams: { mode: 'flashcard', direction: 'definition-to-word' } },
      );
    });

    it('caps immediate quiz at 20 words', () => {
      fixture.detectChanges();
      const manyIds = Array.from({ length: 50 }, (_, i) => `w${i}`);
      (component as unknown as BulkAddInternals).importedWordIds.set(manyIds);

      (component as unknown as BulkAddInternals).onQuizImported();

      // Full set persisted with all 50
      expect(mockQuizService.addQuizSet).toHaveBeenCalledWith(
        expect.objectContaining({ wordIds: manyIds }),
      );

      // Temp set capped at 20
      const tempCall = mockQuizService.createTempQuizSet.mock.calls[0];
      expect(tempCall[0].length).toBe(20);
    });

    it('does nothing when importedWordIds is empty', () => {
      fixture.detectChanges();
      (component as unknown as BulkAddInternals).importedWordIds.set([]);

      (component as unknown as BulkAddInternals).onQuizImported();

      expect(mockQuizService.addQuizSet).not.toHaveBeenCalled();
      expect(mockQuizService.createTempQuizSet).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('emits imported before navigating so the unsaved-changes guard does not fire', () => {
      let emittedCount = -1;
      component.imported.subscribe((n) => (emittedCount = n));
      fixture.detectChanges();
      (component as unknown as BulkAddInternals).importedCount.set(3);
      (component as unknown as BulkAddInternals).importedWordIds.set(['w1', 'w2', 'w3']);

      (component as unknown as BulkAddInternals).onQuizImported();

      expect(emittedCount).toBe(3);
    });

    it('navigates to quiz list and emits imported when all words are incomplete', () => {
      let emittedCount = -1;
      component.imported.subscribe((n) => (emittedCount = n));
      mockWordService.getWord.mockImplementation((id: string) => ({ id, word: id, definition: '', incomplete: true }));
      fixture.detectChanges();
      (component as unknown as BulkAddInternals).importedCount.set(2);
      (component as unknown as BulkAddInternals).importedWordIds.set(['w1', 'w2']);

      (component as unknown as BulkAddInternals).onQuizImported();

      expect(mockQuizService.createTempQuizSet).not.toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/quiz']);
      expect(emittedCount).toBe(2);
      expect(mockBulkService.reset).toHaveBeenCalled();
    });
  });

  describe('onAddMore', () => {
    it('resets all state for a fresh import', () => {
      fixture.detectChanges();
      (component as unknown as BulkAddInternals).importComplete.set(true);
      (component as unknown as BulkAddInternals).importedCount.set(5);
      (component as unknown as BulkAddInternals).incompleteImportedCount.set(2);
      (component as unknown as BulkAddInternals).showCount.set(5);
      (component as unknown as BulkAddInternals).selectedFolderId.set('f1');

      (component as unknown as BulkAddInternals).onAddMore();

      expect((component as unknown as BulkAddInternals).importComplete()).toBe(false);
      expect((component as unknown as BulkAddInternals).importedCount()).toBe(0);
      expect((component as unknown as BulkAddInternals).showCount()).toBe(0);
      expect((component as unknown as BulkAddInternals).selectedFolderId()).toBeNull();
      expect((component as unknown as BulkAddInternals).step()).toBe('input');
      expect(mockBulkService.reset).toHaveBeenCalled();
    });
  });
});
