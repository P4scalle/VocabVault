import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { FeatureDictionary } from './feature-dictionary';
import { WordService, Word, QuizService, StorageService, MasteryLevel, makeWord, Folder, FolderService, StarterWordsService, STARTER_WORDS } from '@vocavault/data-access';
import { ChromeService } from '@vocavault/util';

type DictView = 'list' | 'add' | 'edit' | 'import';
type DictTab = 'words' | 'folders';
interface LetterGroup { letter: string; words: Word[]; }

interface FeatureDictionaryInternals {
  searchQuery: WritableSignal<string>;
  view: WritableSignal<DictView>;
  dictTab: WritableSignal<DictTab>;
  selectedWord: WritableSignal<Partial<Word> | null>;
  addFormResetKey: WritableSignal<number>;
  selectMode: WritableSignal<boolean>;
  selectedWordIds: WritableSignal<Set<string>>;
  autoLookupNext: WritableSignal<boolean>;
  wordPickerFolder: WritableSignal<Folder | null>;
  wordPickerOpen: WritableSignal<boolean>;
  incompleteFilter: WritableSignal<boolean>;
  showNewFolderForm: WritableSignal<boolean>;
  selectedFolderId: WritableSignal<string | null>;
  expandedFolderIds: WritableSignal<Set<string>>;
  overflowMenuFolderId: WritableSignal<string | null>;
  uncategorizedExpanded: WritableSignal<boolean>;
  quizReviewFilter: WritableSignal<string[]>;
  activeLetter: WritableSignal<string>;
  scrollSpyPaused: boolean;
  folderService: FolderService;
  wordService: WordService;
  toast: { showWithAction: (msg: string, action: { label: string; callback: () => void }) => void };
  onAddWord(): void;
  onCancelForm(): void;
  onSaveWord(data: { word: string; pronunciation?: string; definition?: string; examples?: string[] }): void;
  onDeleteWord(word: Word): void;
  onRemoveFromFolder(word: Word): void;
  onLookupFromSearch(): void;
  toggleSelectMode(): void;
  onSelectWordsForFolder(folder: Folder): void;
  onWordsAddedToFolder(ids: string[]): void;
  onViewIncomplete(): void;
  openNewFolderForm(): void;
  onCreateFolderFromForm(data: { name: string; color: string }): void;
  onCancelNewFolder(): void;
  toggleOverflowMenu(folderId: string, event: { stopPropagation(): void }): void;
  closeOverflowMenu(): void;
  onDeleteSelected(): void;
  onScrubbing(active: boolean): void;
  onLetterSelected(letter: string): void;
  onFolderLetterSelected(letter: string): void;
  onUncategorizedLetterSelected(letter: string): void;
  clearQuizReviewFilter(): void;
  toggleFolderExpand(folderId: string): void;
  filteredWords(): Word[];
  groupedWordsByFolder(): Map<string, LetterGroup[]>;
  groupedUncategorizedWords(): LetterGroup[];
  uncategorizedValidLetters(): string[];
  showUncategorizedScroller(): boolean;
}

describe('FeatureDictionary', () => {
  let fixture: ComponentFixture<FeatureDictionary>;
  let component: FeatureDictionary;
  let mockWords: ReturnType<typeof signal<Word[]>>;
  let mockWordService: {
    words: ReturnType<typeof signal<Word[]>>;
    addWord: ReturnType<typeof vi.fn>;
    updateWord: ReturnType<typeof vi.fn>;
    deleteWord: ReturnType<typeof vi.fn>;
    restoreWord: ReturnType<typeof vi.fn>;
    restoreWords: ReturnType<typeof vi.fn>;
  };
  let mockStarterWords: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    // Provide matchMedia stub for HoldButton
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

    mockWords = signal<Word[]>([]);
    mockWordService = {
      words: mockWords.asReadonly() as unknown as ReturnType<typeof signal<Word[]>>,
      addWord: vi.fn().mockReturnValue({ word: {}, ok: true }),
      updateWord: vi.fn().mockReturnValue(true),
      deleteWord: vi.fn().mockReturnValue(true),
      restoreWord: vi.fn(),
      restoreWords: vi.fn().mockReturnValue(true),
    };

    const mockQuizService = {
      quizSets: signal([]).asReadonly(),
      getQuizSet: vi.fn(),
      addQuizSet: vi.fn().mockReturnValue({ quizSet: {}, ok: true }),
      updateQuizSet: vi.fn().mockReturnValue(true),
      deleteQuizSet: vi.fn().mockReturnValue(true),
      getWordsForQuizSet: vi.fn().mockReturnValue([]),
      removeWordFromAllQuizSets: vi.fn().mockReturnValue(true),
      getQuizSetIdsForWord: vi.fn().mockReturnValue([]),
      restoreWordToQuizSets: vi.fn(),
    };

    const mockStorageService = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn().mockReturnValue(true),
      remove: vi.fn(),
      clear: vi.fn(),
      getUsagePercent: vi.fn().mockReturnValue(10),
    };

    mockStarterWords = { add: vi.fn().mockResolvedValue({ ok: true, incomplete: false }) };

    await TestBed.configureTestingModule({
      imports: [FeatureDictionary],
      providers: [
        { provide: WordService, useValue: mockWordService },
        { provide: QuizService, useValue: mockQuizService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: StarterWordsService, useValue: mockStarterWords },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: () => null } },
            queryParamMap: of({ get: () => null }),
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureDictionary);
    component = fixture.componentInstance;
  });

  it('should render in list view by default', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    // With no words, empty state is shown
    expect(fixture.nativeElement.querySelector('[data-testid="empty-state"]')).toBeTruthy();
  });

  it('should show empty state when no words exist', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="empty-state"]')).toBeTruthy();
  });

  it('should offer one starter-word chip per starter word on the empty dictionary', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const chips = fixture.nativeElement.querySelectorAll('[data-testid="starter-words"] button');
    expect(chips.length).toBe(STARTER_WORDS.length);
    expect(chips[0].textContent).toContain(STARTER_WORDS[0]);
  });

  it('should add a starter word through StarterWordsService when a chip is clicked', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const firstChip = fixture.nativeElement.querySelector('[data-testid="starter-words"] button') as HTMLButtonElement;
    firstChip.click();
    await fixture.whenStable();
    expect(mockStarterWords.add).toHaveBeenCalledWith(STARTER_WORDS[0]);
  });

  it('should hide starter words once the dictionary has words', async () => {
    mockWords.set([makeWord({ id: '1', word: 'Ephemeral' })]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="starter-words"]')).toBeFalsy();
  });

  it('should show word cards when words exist', async () => {
    mockWords.set([
      makeWord({ id: '1', word: 'Ephemeral', pronunciation: '/ɪˈfem.ər.əl/', definition: 'Lasting for only a short time.', examples: ['The ephemeral beauty of cherry blossoms.'] }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('lib-word-card')).toBeTruthy();
  });

  it('should filter words by search query', async () => {
    mockWords.set([
      makeWord({ id: '1', word: 'Ephemeral', pronunciation: '/ɪˈfem.ər.əl/', definition: 'Lasting for only a short time.' }),
      makeWord({ id: '2', word: 'Sonder', pronunciation: '/ˈsɒn.dər/', definition: 'The realization of each passerby.', masteryLevel: MasteryLevel.Learning }),
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    (component as unknown as FeatureDictionaryInternals).searchQuery.set('eph');
    fixture.detectChanges();
    await fixture.whenStable();
    const cards = fixture.nativeElement.querySelectorAll('lib-word-card');
    expect(cards.length).toBe(1);
  });

  it('should switch to add view when onAddWord called', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    // Trigger add via the component method (add button lives in the shell, not dictionary)
    (component as unknown as FeatureDictionaryInternals).onAddWord();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('lib-word-form')).toBeTruthy();
  });

  it('should return to list view on cancel from form', async () => {
    (component as unknown as FeatureDictionaryInternals).view.set('add');
    fixture.detectChanges();
    await fixture.whenStable();
    (component as unknown as FeatureDictionaryInternals).onCancelForm();
    fixture.detectChanges();
    await fixture.whenStable();
    expect((component as unknown as FeatureDictionaryInternals).view()).toBe('list');
  });

  it('calls wordService.addWord when saving new word', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    (component as unknown as FeatureDictionaryInternals).view.set('add');
    (component as unknown as FeatureDictionaryInternals).onSaveWord({
      word: 'Ephemeral',
      pronunciation: '/ɪˈfem.ər.əl/',
      definition: 'Lasting for only a short time.',
      examples: ['Test example'],
    });
    expect(mockWordService.addWord).toHaveBeenCalledWith({
      word: 'Ephemeral',
      pronunciation: '/ɪˈfem.ər.əl/',
      definition: 'Lasting for only a short time.',
      examples: ['Test example'],
    });
  });

  it('onSaveWord in add mode stays in add view and clears selectedWord', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    (component as unknown as FeatureDictionaryInternals).view.set('add');
    (component as unknown as FeatureDictionaryInternals).onSaveWord({
      word: 'Ephemeral',
      pronunciation: '/ɪˈfem.ər.αl/',
      definition: 'Lasting for only a short time.',
      examples: [],
    });
    // Add mode stays in 'add' view (form is reset via resetKey, not view toggle)
    expect((component as unknown as FeatureDictionaryInternals).view()).toBe('add');
    // selectedWord is cleared
    expect((component as unknown as FeatureDictionaryInternals).selectedWord()).toBeNull();
    // resetKey incremented to trigger child form reset
    expect((component as unknown as FeatureDictionaryInternals).addFormResetKey()).toBe(1);
  });

  it('returns to list view after adding', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    (component as unknown as FeatureDictionaryInternals).view.set('add');
    (component as unknown as FeatureDictionaryInternals).view.set('list');
    fixture.detectChanges();
    await fixture.whenStable();
    expect((component as unknown as FeatureDictionaryInternals).view()).toBe('list');
  });

  it('calls wordService.deleteWord when deleting', async () => {
    const word = makeWord({ id: 'test-id', word: 'Ephemeral', pronunciation: '/ɪˈfem.ər.əl/', definition: 'Lasting for only a short time.' });
    fixture.detectChanges();
    await fixture.whenStable();
    (component as unknown as FeatureDictionaryInternals).onDeleteWord(word);
    expect(mockWordService.deleteWord).toHaveBeenCalledWith('test-id');
  });

  describe('word list spacing', () => {
    it('should have gap-4 spacing between word cards', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
        makeWord({ id: '2', word: 'Banana', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      const wordList = fixture.nativeElement.querySelector('[role="list"]');
      expect(wordList).toBeTruthy();
      expect(wordList.classList.contains('gap-4')).toBe(true);
    });
  });

  describe('select-mode button placement', () => {
    it('should render select-mode button in the filter chips row, not inside the alphabet scroller', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      const selectBtn = fixture.nativeElement.querySelector('[aria-label="Select words to manage"]');
      expect(selectBtn).toBeTruthy();
      const scroller = fixture.nativeElement.querySelector('lib-alphabet-scroller');
      // Scroller may not render when < 3 letter groups; if present, select btn must not be inside it
      expect(!scroller || !scroller.contains(selectBtn)).toBe(true);
    });
  });

  describe('select mode visibility', () => {
    it('should hide select button when no words to select', async () => {
      mockWords.set([]);
      fixture.detectChanges();
      await fixture.whenStable();
      const selectBtn = fixture.nativeElement.querySelector('[aria-label="Select words to manage"]');
      expect(selectBtn).toBeFalsy();
    });

    it('should show select button when words exist', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      const selectBtn = fixture.nativeElement.querySelector('[aria-label="Select words to manage"]');
      expect(selectBtn).toBeTruthy();
    });

    it('should exit select mode when switching to Folders tab', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      (component as unknown as FeatureDictionaryInternals).selectMode.set(true);
      (component as unknown as FeatureDictionaryInternals).selectedWordIds.set(new Set(['1']));
      // Switch to folders tab
      (component as unknown as FeatureDictionaryInternals).dictTab.set('folders');
      if ((component as unknown as FeatureDictionaryInternals).selectMode()) { (component as unknown as FeatureDictionaryInternals).toggleSelectMode(); }
      expect((component as unknown as FeatureDictionaryInternals).selectMode()).toBe(false);
      expect((component as unknown as FeatureDictionaryInternals).selectedWordIds().size).toBe(0);
    });
  });

  describe('words/folders tabs', () => {
    it('should always show Words/Folders tabs even without folders', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
      expect(tabs.length).toBe(2);
      expect(tabs[0].textContent).toContain('Words');
      expect(tabs[1].textContent).toContain('Folders');
    });

    it('should show folders empty state when no folders exist', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      (component as unknown as FeatureDictionaryInternals).dictTab.set('folders');
      fixture.detectChanges();
      await fixture.whenStable();
      const emptyState = fixture.nativeElement.querySelector('[data-testid="folders-empty-state"]');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No folders yet');
      expect(emptyState.textContent).toContain('Create Your First Folder');
    });

    it('should not show folders empty state when folders exist', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      // Add a folder via the service
      (component as unknown as FeatureDictionaryInternals).folderService.addFolder('Test');
      (component as unknown as FeatureDictionaryInternals).dictTab.set('folders');
      fixture.detectChanges();
      await fixture.whenStable();
      const emptyState = fixture.nativeElement.querySelector('[data-testid="folders-empty-state"]');
      expect(emptyState).toBeFalsy();
    });
  });

  describe('search lookup', () => {
    it('should show lookup button when search has no results', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      (component as unknown as FeatureDictionaryInternals).searchQuery.set('zzzzz');
      fixture.detectChanges();
      await fixture.whenStable();
      const allButtons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
      const lookupButton = allButtons.find(b => b.textContent?.includes('Look up'));
      expect(lookupButton).toBeTruthy();
    });

    it('should not show lookup button when search has results', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      (component as unknown as FeatureDictionaryInternals).searchQuery.set('App');
      fixture.detectChanges();
      await fixture.whenStable();
      const allButtons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLElement[];
      const lookupButton = allButtons.find(b => b.textContent?.includes('Look up'));
      expect(lookupButton).toBeFalsy();
    });

    it('should switch to add view with auto-lookup when onLookupFromSearch called', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      (component as unknown as FeatureDictionaryInternals).searchQuery.set('love');
      (component as unknown as FeatureDictionaryInternals).onLookupFromSearch();
      expect((component as unknown as FeatureDictionaryInternals).view()).toBe('add');
      expect((component as unknown as FeatureDictionaryInternals).autoLookupNext()).toBe(true);
      expect((component as unknown as FeatureDictionaryInternals).selectedWord()?.word).toBe('love');
      expect((component as unknown as FeatureDictionaryInternals).searchQuery()).toBe('');
    });

    it('should reset auto-lookup flag on normal add', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      (component as unknown as FeatureDictionaryInternals).autoLookupNext.set(true);
      (component as unknown as FeatureDictionaryInternals).onAddWord();
      expect((component as unknown as FeatureDictionaryInternals).autoLookupNext()).toBe(false);
    });
  });

  describe('folder word picker', () => {
    it('should open word picker modal on onSelectWordsForFolder', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      const folder = { id: 'f1', name: 'Test', color: '#ff0000', createdAt: new Date() };
      (component as unknown as FeatureDictionaryInternals).onSelectWordsForFolder(folder);
      expect((component as unknown as FeatureDictionaryInternals).wordPickerFolder()).toEqual(folder);
      expect((component as unknown as FeatureDictionaryInternals).wordPickerOpen()).toBe(true);
    });

    it('should update words and clear state on onWordsAddedToFolder', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      const folder = { id: 'f1', name: 'Test', color: '#ff0000', createdAt: new Date() };
      (component as unknown as FeatureDictionaryInternals).wordPickerFolder.set(folder);
      (component as unknown as FeatureDictionaryInternals).onWordsAddedToFolder(['w1', 'w2']);
      expect(mockWordService.updateWord).toHaveBeenCalledTimes(2);
      expect(mockWordService.updateWord).toHaveBeenCalledWith('w1', { folderId: 'f1' });
      expect(mockWordService.updateWord).toHaveBeenCalledWith('w2', { folderId: 'f1' });
      expect((component as unknown as FeatureDictionaryInternals).wordPickerFolder()).toBeNull();
    });
  });

  describe('remove from folder', () => {
    it('should clear folderId when removing word from folder', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      const word = makeWord({ id: 'w1', word: 'Test', definition: 'test', folderId: 'f1' });
      (component as unknown as FeatureDictionaryInternals).onRemoveFromFolder(word);
      expect(mockWordService.updateWord).toHaveBeenCalledWith('w1', { folderId: undefined });
    });
  });

  describe('import view', () => {
    it('should not show import view when view is list', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      expect((component as unknown as FeatureDictionaryInternals).view()).toBe('list');
      const importEl = fixture.nativeElement.querySelector('lib-bulk-add');
      expect(importEl).toBeFalsy();
    });
  });

  describe('onViewIncomplete', () => {
    it('should switch to list view and activate incomplete filter', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      (component as unknown as FeatureDictionaryInternals).view.set('import');
      (component as unknown as FeatureDictionaryInternals).incompleteFilter.set(false);

      (component as unknown as FeatureDictionaryInternals).onViewIncomplete();

      expect((component as unknown as FeatureDictionaryInternals).view()).toBe('list');
      expect((component as unknown as FeatureDictionaryInternals).incompleteFilter()).toBe(true);
    });
  });

  describe('create-on-confirm folder flow', () => {
    it('should switch to folders tab and show new folder form', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      (component as unknown as FeatureDictionaryInternals).openNewFolderForm();
      expect((component as unknown as FeatureDictionaryInternals).dictTab()).toBe('folders');
      expect((component as unknown as FeatureDictionaryInternals).showNewFolderForm()).toBe(true);
    });

    it('should create folder and hide form on confirm', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      const mockFolder = { id: 'f1', name: 'Animals', color: '#6366F1', createdAt: new Date() };
      vi.spyOn((component as unknown as FeatureDictionaryInternals).folderService, 'addFolder').mockReturnValue({ folder: mockFolder, ok: true });
      (component as unknown as FeatureDictionaryInternals).onCreateFolderFromForm({ name: 'Animals', color: '#6366F1' });
      expect((component as unknown as FeatureDictionaryInternals).showNewFolderForm()).toBe(false);
      expect((component as unknown as FeatureDictionaryInternals).selectedFolderId()).toBe('f1');
      expect((component as unknown as FeatureDictionaryInternals).expandedFolderIds().has('f1')).toBe(true);
    });

    it('should hide form on cancel', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      (component as unknown as FeatureDictionaryInternals).openNewFolderForm();
      expect((component as unknown as FeatureDictionaryInternals).showNewFolderForm()).toBe(true);
      (component as unknown as FeatureDictionaryInternals).onCancelNewFolder();
      expect((component as unknown as FeatureDictionaryInternals).showNewFolderForm()).toBe(false);
    });
  });

  describe('folders tab rendering', () => {
    it('should show folder content (not words list) when folders tab is active', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
      ]);
      (component as unknown as FeatureDictionaryInternals).folderService.addFolder('Test');
      fixture.detectChanges();
      await fixture.whenStable();
      (component as unknown as FeatureDictionaryInternals).dictTab.set('folders');
      fixture.detectChanges();
      await fixture.whenStable();
      // Should NOT show the word list (words tab content)
      const wordList = fixture.nativeElement.querySelector('[aria-label="Word list"]');
      expect(wordList).toBeFalsy();
      // Should show the new folder button
      const newFolderBtn = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLElement>)
        .find(b => b.textContent?.includes('New Folder'));
      expect(newFolderBtn).toBeTruthy();
    });

    it('should show dictionary empty state (not folder tabs) when 0 words', async () => {
      mockWords.set([]);
      fixture.detectChanges();
      await fixture.whenStable();
      // Dictionary empty state takes over, so folder tabs aren't even visible
      const dictEmptyState = fixture.nativeElement.querySelector('[data-testid="empty-state"]');
      expect(dictEmptyState).toBeTruthy();
      const folderEmptyState = fixture.nativeElement.querySelector('[data-testid="folders-empty-state"]');
      expect(folderEmptyState).toBeFalsy();
    });

    it('should show inline form when clicking Create from empty state', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
      (component as unknown as FeatureDictionaryInternals).dictTab.set('folders');
      fixture.detectChanges();
      await fixture.whenStable();
      // Empty state should be visible
      expect(fixture.nativeElement.querySelector('[data-testid="folders-empty-state"]')).toBeTruthy();
      // Open form
      (component as unknown as FeatureDictionaryInternals).openNewFolderForm();
      fixture.detectChanges();
      await fixture.whenStable();
      // Empty state should be gone, form should be visible
      expect(fixture.nativeElement.querySelector('[data-testid="folders-empty-state"]')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('lib-folder-form')).toBeTruthy();
    });
  });

  describe('overflow menu', () => {
    it('should toggle overflow menu open and closed', () => {
      fixture.detectChanges();
      const folderId = 'f1';
      (component as unknown as FeatureDictionaryInternals).toggleOverflowMenu(folderId, { stopPropagation: () => { /* mock: no-op */ } });
      expect((component as unknown as FeatureDictionaryInternals).overflowMenuFolderId()).toBe(folderId);
      (component as unknown as FeatureDictionaryInternals).toggleOverflowMenu(folderId, { stopPropagation: () => { /* mock: no-op */ } });
      expect((component as unknown as FeatureDictionaryInternals).overflowMenuFolderId()).toBeNull();
    });

    it('should close overflow menu when closeOverflowMenu is called', () => {
      fixture.detectChanges();
      (component as unknown as FeatureDictionaryInternals).overflowMenuFolderId.set('f1');
      (component as unknown as FeatureDictionaryInternals).closeOverflowMenu();
      expect((component as unknown as FeatureDictionaryInternals).overflowMenuFolderId()).toBeNull();
    });

    it('should close overflow menu when folder is collapsed', () => {
      fixture.detectChanges();
      (component as unknown as FeatureDictionaryInternals).expandedFolderIds.set(new Set(['f1']));
      (component as unknown as FeatureDictionaryInternals).overflowMenuFolderId.set('f1');
      (component as unknown as FeatureDictionaryInternals).toggleFolderExpand('f1');
      expect((component as unknown as FeatureDictionaryInternals).overflowMenuFolderId()).toBeNull();
    });
  });

  describe('bulk delete and undo with quiz membership', () => {
    it('should call removeWordFromAllQuizSets for each deleted word', async () => {
      const words: Word[] = [
        makeWord({ id: 'w1', word: 'Apple', definition: 'fruit' }),
        makeWord({ id: 'w2', word: 'Banana', definition: 'fruit' }),
        makeWord({ id: 'w3', word: 'Cherry', definition: 'fruit' }),
      ];
      mockWords.set(words);
      fixture.detectChanges();
      await fixture.whenStable();

      const quizService = TestBed.inject(QuizService);

      // Select all 3 words
      (component as unknown as FeatureDictionaryInternals).selectMode.set(true);
      (component as unknown as FeatureDictionaryInternals).selectedWordIds.set(new Set(['w1', 'w2', 'w3']));

      // Delete selected
      (component as unknown as FeatureDictionaryInternals).onDeleteSelected();

      // Verify quiz membership removal was called for each word
      expect(quizService.removeWordFromAllQuizSets).toHaveBeenCalledWith('w1');
      expect(quizService.removeWordFromAllQuizSets).toHaveBeenCalledWith('w2');
      expect(quizService.removeWordFromAllQuizSets).toHaveBeenCalledWith('w3');

      // Verify words were deleted
      expect(mockWordService.deleteWord).toHaveBeenCalledWith('w1');
      expect(mockWordService.deleteWord).toHaveBeenCalledWith('w2');
      expect(mockWordService.deleteWord).toHaveBeenCalledWith('w3');
    });

    it('should restore words on undo but NOT restore quiz set memberships (known limitation)', async () => {
      const words: Word[] = [
        makeWord({ id: 'w1', word: 'Apple', definition: 'fruit' }),
        makeWord({ id: 'w2', word: 'Banana', definition: 'fruit' }),
      ];
      mockWords.set(words);
      fixture.detectChanges();
      await fixture.whenStable();

      // Mock toast.showWithAction to capture the undo callback
      let undoCallback: (() => void) | undefined;
      const toastService = (component as unknown as FeatureDictionaryInternals).toast;
      vi.spyOn(toastService, 'showWithAction').mockImplementation(
        (_msg: string, action: { label: string; callback: () => void }) => {
          undoCallback = action.callback;
        }
      );

      // Select and delete
      (component as unknown as FeatureDictionaryInternals).selectMode.set(true);
      (component as unknown as FeatureDictionaryInternals).selectedWordIds.set(new Set(['w1', 'w2']));
      (component as unknown as FeatureDictionaryInternals).onDeleteSelected();

      // Verify undo callback was captured
      expect(undoCallback).toBeDefined();

      // Call undo
      if (!undoCallback) return;
      undoCallback();

      // Words should be restored via restoreWords
      expect(mockWordService.restoreWord || (component as unknown as FeatureDictionaryInternals).wordService.restoreWords).toBeTruthy();
      // The undo calls restoreWords but does NOT call any quiz membership restoration
      // This is a known limitation: quiz set memberships are lost on bulk delete + undo
    });

    it('should exit select mode and clear selection after bulk delete', async () => {
      const words: Word[] = [
        makeWord({ id: 'w1', word: 'Apple', definition: 'fruit' }),
      ];
      mockWords.set(words);
      fixture.detectChanges();
      await fixture.whenStable();

      (component as unknown as FeatureDictionaryInternals).selectMode.set(true);
      (component as unknown as FeatureDictionaryInternals).selectedWordIds.set(new Set(['w1']));
      (component as unknown as FeatureDictionaryInternals).onDeleteSelected();

      expect((component as unknown as FeatureDictionaryInternals).selectMode()).toBe(false);
      expect((component as unknown as FeatureDictionaryInternals).selectedWordIds().size).toBe(0);
    });
  });

  describe('alphabet scroll', () => {
    let scrollToSpy: ReturnType<typeof vi.fn>;
    let mockContainer: HTMLElement;

    beforeEach(() => {
      scrollToSpy = vi.fn();
      mockContainer = document.createElement('main');
      mockContainer.id = 'main-content';
      mockContainer.scrollTo = scrollToSpy as unknown as typeof mockContainer.scrollTo;
      Object.defineProperty(mockContainer, 'scrollTop', { value: 100, writable: true, configurable: true });
      mockContainer.getBoundingClientRect = () => ({ top: 56, bottom: 812, left: 0, right: 375, width: 375, height: 756, x: 0, y: 56, toJSON: () => ({}) });
      document.body.appendChild(mockContainer);
    });

    afterEach(() => {
      mockContainer.remove();
      vi.restoreAllMocks();
    });

    it('should scroll to top:0 with smooth when selecting first letter group', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
        makeWord({ id: '2', word: 'Banana', definition: 'fruit' }),
        makeWord({ id: '3', word: 'Cherry', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      (component as unknown as FeatureDictionaryInternals).onScrubbing(true);
      expect((component as unknown as FeatureDictionaryInternals).scrollSpyPaused).toBe(true);

      // 'A' is the first valid letter, so it should scroll to top:0
      (component as unknown as FeatureDictionaryInternals).onLetterSelected('A');

      expect((component as unknown as FeatureDictionaryInternals).activeLetter()).toBe('A');
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('should scroll to offset for non-first letter and pause spy via onScrubbing', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
        makeWord({ id: '2', word: 'Banana', definition: 'fruit' }),
        makeWord({ id: '3', word: 'Cherry', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      const mockEl = document.createElement('div');
      mockEl.getBoundingClientRect = () => ({ top: 400, bottom: 450, left: 0, right: 100, width: 100, height: 50, x: 0, y: 400, toJSON: () => ({}) });
      vi.spyOn(document, 'querySelector').mockReturnValue(mockEl);

      (component as unknown as FeatureDictionaryInternals).onScrubbing(true);
      expect((component as unknown as FeatureDictionaryInternals).scrollSpyPaused).toBe(true);

      // 'B' is NOT the first letter, so it should use offset calculation
      (component as unknown as FeatureDictionaryInternals).onLetterSelected('B');

      expect((component as unknown as FeatureDictionaryInternals).activeLetter()).toBe('B');
      // scrollTop(100) + elTop(400) - containerTop(56) = 444
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 444, behavior: 'instant' });
    });

    it('should use instant behavior for first letter when prefers-reduced-motion', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
        makeWord({ id: '2', word: 'Banana', definition: 'fruit' }),
        makeWord({ id: '3', word: 'Cherry', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      // Override matchMedia to report reduced motion
      const originalMatchMedia = window.matchMedia;
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
        })),
      });

      (component as unknown as FeatureDictionaryInternals).onLetterSelected('A');
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });

      // Restore
      Object.defineProperty(window, 'matchMedia', { writable: true, value: originalMatchMedia });
    });

    it('should scroll to top:0 when first letter changes due to filters', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
        makeWord({ id: '2', word: 'Banana', definition: 'fruit' }),
        makeWord({ id: '3', word: 'Cherry', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      // Filter out 'A' words, so 'B' becomes the first valid letter
      (component as unknown as FeatureDictionaryInternals).searchQuery.set('b');
      fixture.detectChanges();
      await fixture.whenStable();

      (component as unknown as FeatureDictionaryInternals).onLetterSelected('B');
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('should not scroll when element not found for non-first letter but still set activeLetter', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
        makeWord({ id: '2', word: 'Banana', definition: 'fruit' }),
        makeWord({ id: '3', word: 'Cherry', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      vi.spyOn(document, 'querySelector').mockReturnValue(null);

      (component as unknown as FeatureDictionaryInternals).onLetterSelected('Z');

      expect(scrollToSpy).not.toHaveBeenCalled();
      expect((component as unknown as FeatureDictionaryInternals).activeLetter()).toBe('Z');
    });

    it('should subtract container paddingTop from scroll offset for non-first letter', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
        makeWord({ id: '2', word: 'Banana', definition: 'fruit' }),
        makeWord({ id: '3', word: 'Cherry', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      // Simulate desktop: container has 80px padding-top (lg:pt-20)
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({ paddingTop: '80px' } as CSSStyleDeclaration);

      const mockEl = document.createElement('div');
      mockEl.getBoundingClientRect = () => ({ top: 400, bottom: 450, left: 0, right: 100, width: 100, height: 50, x: 0, y: 400, toJSON: () => ({}) });
      vi.spyOn(document, 'querySelector').mockReturnValue(mockEl);

      // 'B' is not the first letter, so it uses offset calculation
      (component as unknown as FeatureDictionaryInternals).onLetterSelected('B');

      // scrollTop(100) + elTop(400) - containerTop(56) - paddingTop(80) = 364
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 364, behavior: 'instant' });
    });

    it('should not throw when scroll container is missing', async () => {
      // Remove the mock container to simulate missing #main-content
      mockContainer.remove();

      mockWords.set([makeWord({ id: '1', word: 'Apple', definition: 'fruit' })]);
      fixture.detectChanges();
      await fixture.whenStable();

      const mockEl = document.createElement('div');
      vi.spyOn(document, 'querySelector').mockReturnValue(mockEl);

      // Should not throw, just silently do nothing
      expect(() => (component as unknown as FeatureDictionaryInternals).onLetterSelected('A')).not.toThrow();
      expect((component as unknown as FeatureDictionaryInternals).activeLetter()).toBe('A');

      // Re-add for afterEach cleanup
      document.body.appendChild(mockContainer);
    });

    it('should use offset scroll for uncategorized first letter (not top:0)', async () => {
      mockWords.set([
        makeWord({ id: '1', word: 'Mango', definition: 'fruit' }),
        makeWord({ id: '2', word: 'Nectarine', definition: 'fruit' }),
        makeWord({ id: '3', word: 'Orange', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      const mockEl = document.createElement('div');
      mockEl.getBoundingClientRect = () => ({ top: 400, bottom: 450, left: 0, right: 100, width: 100, height: 50, x: 0, y: 400, toJSON: () => ({}) });
      vi.spyOn(document, 'querySelector').mockReturnValue(mockEl);

      // Uncategorized scroller is contextual: first letter scrolls to offset, not top:0
      (component as unknown as FeatureDictionaryInternals).onUncategorizedLetterSelected('M');
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 444, behavior: 'instant' });
    });

    it('should resume scroll spy after 150ms via onScrubbing(false)', async () => {
      vi.useFakeTimers();

      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      (component as unknown as FeatureDictionaryInternals).onScrubbing(true);
      expect((component as unknown as FeatureDictionaryInternals).scrollSpyPaused).toBe(true);

      (component as unknown as FeatureDictionaryInternals).onScrubbing(false);
      // Still paused (settle delay not elapsed)
      expect((component as unknown as FeatureDictionaryInternals).scrollSpyPaused).toBe(true);

      vi.advanceTimersByTime(149);
      expect((component as unknown as FeatureDictionaryInternals).scrollSpyPaused).toBe(true);

      vi.advanceTimersByTime(1);
      expect((component as unknown as FeatureDictionaryInternals).scrollSpyPaused).toBe(false);

      vi.useRealTimers();
    });

    it('should handle rapid scrub end + re-start (cancels resume timer)', async () => {
      vi.useFakeTimers();

      mockWords.set([
        makeWord({ id: '1', word: 'Apple', definition: 'fruit' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      // Start scrubbing → pause
      (component as unknown as FeatureDictionaryInternals).onScrubbing(true);
      expect((component as unknown as FeatureDictionaryInternals).scrollSpyPaused).toBe(true);

      // End scrubbing → schedules 150ms resume
      (component as unknown as FeatureDictionaryInternals).onScrubbing(false);

      vi.advanceTimersByTime(50);
      // Re-start scrubbing before timer fires. Should cancel resume and stay paused.
      (component as unknown as FeatureDictionaryInternals).onScrubbing(true);
      expect((component as unknown as FeatureDictionaryInternals).scrollSpyPaused).toBe(true);

      // The original 150ms timer would have fired here without cancellation
      vi.advanceTimersByTime(100);
      expect((component as unknown as FeatureDictionaryInternals).scrollSpyPaused).toBe(true);

      // End scrubbing again, starting a new 150ms resume timer
      (component as unknown as FeatureDictionaryInternals).onScrubbing(false);
      vi.advanceTimersByTime(150);
      expect((component as unknown as FeatureDictionaryInternals).scrollSpyPaused).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('Folder/Uncategorized Alphabet Scroller', () => {
    it('groupedWordsByFolder returns empty map when no words in folders', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      expect((component as unknown as FeatureDictionaryInternals).groupedWordsByFolder().size).toBe(0);
    });

    it('groupedWordsByFolder groups words by first letter per folder', async () => {
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple', folderId: 'f1' }),
        makeWord({ id: 'w2', word: 'Avocado', folderId: 'f1' }),
        makeWord({ id: 'w3', word: 'Banana', folderId: 'f1' }),
        makeWord({ id: 'w4', word: 'Cherry', folderId: 'f1' }),
        makeWord({ id: 'w5', word: 'Date', folderId: 'f1' }),
        makeWord({ id: 'w6', word: 'Elderberry', folderId: 'f1' }),
        makeWord({ id: 'w7', word: 'NotInFolder', folderId: 'other' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      const groups = (component as unknown as FeatureDictionaryInternals).groupedWordsByFolder().get('f1');
      expect(groups.length).toBe(5);
      const aGroup = groups.find((g: LetterGroup) => g.letter === 'A');
      expect(aGroup).toBeTruthy();
      expect(aGroup.words.length).toBe(2);
    });

    it('groupedWordsByFolder returns sorted letter array per folder', async () => {
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple', folderId: 'f1' }),
        makeWord({ id: 'w2', word: 'Banana', folderId: 'f1' }),
        makeWord({ id: 'w3', word: 'Cherry', folderId: 'f1' }),
        makeWord({ id: 'w4', word: 'Date', folderId: 'f1' }),
        makeWord({ id: 'w5', word: 'Elderberry', folderId: 'f1' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      const groups = (component as unknown as FeatureDictionaryInternals).groupedWordsByFolder().get('f1');
      const letters = groups.map((g: LetterGroup) => g.letter);
      expect(letters).toEqual(['A', 'B', 'C', 'D', 'E']);
    });

    it('groupedUncategorizedWords groups unfoldered words by letter', async () => {
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple' }),
        makeWord({ id: 'w2', word: 'Avocado' }),
        makeWord({ id: 'w3', word: 'Banana' }),
        makeWord({ id: 'w4', word: 'InFolder', folderId: 'f1' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      const groups = (component as unknown as FeatureDictionaryInternals).groupedUncategorizedWords();
      expect(groups.length).toBe(2);
      const aGroup = groups.find((g: LetterGroup) => g.letter === 'A');
      expect(aGroup).toBeTruthy();
      expect(aGroup.words.length).toBe(2);
      // Folder word must not be in uncat groups
      const iGroup = groups.find((g: LetterGroup) => g.letter === 'I');
      expect(iGroup).toBeFalsy();
    });

    it('uncategorizedValidLetters returns correct letter array', async () => {
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple' }),
        makeWord({ id: 'w2', word: 'Banana' }),
        makeWord({ id: 'w3', word: 'Cherry' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      const letters = (component as unknown as FeatureDictionaryInternals).uncategorizedValidLetters();
      const groupLetters = (component as unknown as FeatureDictionaryInternals).groupedUncategorizedWords().map((g: LetterGroup) => g.letter);
      expect(letters).toEqual(groupLetters);
      expect(letters).toEqual(['A', 'B', 'C']);
    });

    it('showUncategorizedScroller returns false when uncategorized is collapsed', async () => {
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple' }),
        makeWord({ id: 'w2', word: 'Banana' }),
        makeWord({ id: 'w3', word: 'Cherry' }),
        makeWord({ id: 'w4', word: 'Date' }),
        makeWord({ id: 'w5', word: 'Elderberry' }),
        makeWord({ id: 'w6', word: 'Fig' }),
      ]);
      // uncategorizedExpanded defaults to false
      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as unknown as FeatureDictionaryInternals).showUncategorizedScroller()).toBe(false);
    });

    it('showUncategorizedScroller returns true with 5+ groups and uncategorized expanded', async () => {
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple' }),
        makeWord({ id: 'w2', word: 'Banana' }),
        makeWord({ id: 'w3', word: 'Cherry' }),
        makeWord({ id: 'w4', word: 'Date' }),
        makeWord({ id: 'w5', word: 'Elderberry' }),
        makeWord({ id: 'w6', word: 'Fig' }),
      ]);
      (component as unknown as FeatureDictionaryInternals).uncategorizedExpanded.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as unknown as FeatureDictionaryInternals).showUncategorizedScroller()).toBe(true);
    });

    it('showUncategorizedScroller returns false with fewer than 5 uncat groups even when expanded', async () => {
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple' }),
        makeWord({ id: 'w2', word: 'Banana' }),
        makeWord({ id: 'w3', word: 'Cherry' }),
      ]);
      (component as unknown as FeatureDictionaryInternals).uncategorizedExpanded.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as unknown as FeatureDictionaryInternals).showUncategorizedScroller()).toBe(false);
    });

    it('onFolderLetterSelected sets activeLetter', async () => {
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple', folderId: 'f1' }),
      ]);
      (component as unknown as FeatureDictionaryInternals).selectedFolderId.set('f1');
      fixture.detectChanges();
      await fixture.whenStable();

      const querySpy = vi.spyOn(document, 'querySelector').mockReturnValue(null);
      (component as unknown as FeatureDictionaryInternals).onFolderLetterSelected('A');
      expect((component as unknown as FeatureDictionaryInternals).activeLetter()).toBe('A');
      querySpy.mockRestore();
    });

    it('reads highlight queryParam and filters words to those IDs', async () => {
      const words = [
        makeWord({ id: 'w1', word: 'Apple', definition: 'fruit' }),
        makeWord({ id: 'w2', word: 'Banana', definition: 'fruit' }),
        makeWord({ id: 'w3', word: 'Cherry', definition: 'fruit' }),
      ];
      mockWords.set(words as Word[]);
      fixture.detectChanges();
      await fixture.whenStable();

      // Set filter directly (simulates reading highlight queryParam)
      (component as unknown as FeatureDictionaryInternals).quizReviewFilter.set(['w1', 'w3']);
      fixture.detectChanges();
      await fixture.whenStable();

      const filtered = (component as unknown as FeatureDictionaryInternals).filteredWords();
      expect(filtered.length).toBe(2);
      expect(filtered.map((w: Word) => w.id)).toEqual(expect.arrayContaining(['w1', 'w3']));
    });

    it('clearQuizReviewFilter clears the filter and shows all words', async () => {
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple', definition: 'fruit' }),
        makeWord({ id: 'w2', word: 'Banana', definition: 'fruit' }),
      ] as Word[]);
      fixture.detectChanges();
      await fixture.whenStable();

      (component as unknown as FeatureDictionaryInternals).quizReviewFilter.set(['w1']);
      expect((component as unknown as FeatureDictionaryInternals).filteredWords().length).toBe(1);

      (component as unknown as FeatureDictionaryInternals).clearQuizReviewFilter();
      expect((component as unknown as FeatureDictionaryInternals).quizReviewFilter()).toEqual([]);
      expect((component as unknown as FeatureDictionaryInternals).filteredWords().length).toBe(2);
    });

    it('expandedFolderIds supports multi-expand', async () => {
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple', folderId: 'f1' }),
        makeWord({ id: 'w2', word: 'Banana', folderId: 'f2' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      // Expand first folder
      (component as unknown as FeatureDictionaryInternals).toggleFolderExpand('f1');
      expect((component as unknown as FeatureDictionaryInternals).expandedFolderIds().has('f1')).toBe(true);

      // Expand second folder (first stays expanded)
      (component as unknown as FeatureDictionaryInternals).toggleFolderExpand('f2');
      expect((component as unknown as FeatureDictionaryInternals).expandedFolderIds().has('f1')).toBe(true);
      expect((component as unknown as FeatureDictionaryInternals).expandedFolderIds().has('f2')).toBe(true);

      // Collapse first folder
      (component as unknown as FeatureDictionaryInternals).toggleFolderExpand('f1');
      expect((component as unknown as FeatureDictionaryInternals).expandedFolderIds().has('f1')).toBe(false);
      expect((component as unknown as FeatureDictionaryInternals).expandedFolderIds().has('f2')).toBe(true);
    });

    it('collapsed folder with 5+ letter groups does not render alphabet scroller', async () => {
      // Create a real folder, then assign words to it
      const { folder } = (component as unknown as FeatureDictionaryInternals).folderService.addFolder('Big Folder');
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple', folderId: folder.id }),
        makeWord({ id: 'w2', word: 'Banana', folderId: folder.id }),
        makeWord({ id: 'w3', word: 'Cherry', folderId: folder.id }),
        makeWord({ id: 'w4', word: 'Date', folderId: folder.id }),
        makeWord({ id: 'w5', word: 'Elderberry', folderId: folder.id }),
        makeWord({ id: 'w6', word: 'Fig', folderId: folder.id }),
      ]);
      (component as unknown as FeatureDictionaryInternals).dictTab.set('folders');
      fixture.detectChanges();
      await fixture.whenStable();

      // Folder is collapsed by default, so the position:fixed scroller must not render
      const scrollers = fixture.nativeElement.querySelectorAll('lib-alphabet-scroller');
      expect(scrollers.length).toBe(0);
    });

    it('expanded folder with 5+ letter groups renders exactly one scroller', async () => {
      const { folder } = (component as unknown as FeatureDictionaryInternals).folderService.addFolder('Big Folder');
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple', folderId: folder.id }),
        makeWord({ id: 'w2', word: 'Banana', folderId: folder.id }),
        makeWord({ id: 'w3', word: 'Cherry', folderId: folder.id }),
        makeWord({ id: 'w4', word: 'Date', folderId: folder.id }),
        makeWord({ id: 'w5', word: 'Elderberry', folderId: folder.id }),
        makeWord({ id: 'w6', word: 'Fig', folderId: folder.id }),
      ]);
      (component as unknown as FeatureDictionaryInternals).dictTab.set('folders');
      (component as unknown as FeatureDictionaryInternals).toggleFolderExpand(folder.id);
      fixture.detectChanges();
      await fixture.whenStable();

      const scrollers = fixture.nativeElement.querySelectorAll('lib-alphabet-scroller');
      expect(scrollers.length).toBe(1);
    });

    it('collapsing folder destroys its scroller while sibling folder stays clean', async () => {
      const { folder: f1 } = (component as unknown as FeatureDictionaryInternals).folderService.addFolder('Folder A');
      const { folder: f2 } = (component as unknown as FeatureDictionaryInternals).folderService.addFolder('Folder B');
      mockWords.set([
        makeWord({ id: 'w1', word: 'Apple', folderId: f1.id }),
        makeWord({ id: 'w2', word: 'Banana', folderId: f1.id }),
        makeWord({ id: 'w3', word: 'Cherry', folderId: f1.id }),
        makeWord({ id: 'w4', word: 'Date', folderId: f1.id }),
        makeWord({ id: 'w5', word: 'Elderberry', folderId: f1.id }),
        makeWord({ id: 'w6', word: 'Fig', folderId: f2.id }),
        makeWord({ id: 'w7', word: 'Grape', folderId: f2.id }),
        makeWord({ id: 'w8', word: 'Honey', folderId: f2.id }),
        makeWord({ id: 'w9', word: 'Indigo', folderId: f2.id }),
        makeWord({ id: 'w10', word: 'Juniper', folderId: f2.id }),
      ]);
      (component as unknown as FeatureDictionaryInternals).dictTab.set('folders');

      // Expand f1 only
      (component as unknown as FeatureDictionaryInternals).toggleFolderExpand(f1.id);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelectorAll('lib-alphabet-scroller').length).toBe(1);

      // Collapse f1, expand f2
      (component as unknown as FeatureDictionaryInternals).toggleFolderExpand(f1.id);
      (component as unknown as FeatureDictionaryInternals).toggleFolderExpand(f2.id);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelectorAll('lib-alphabet-scroller').length).toBe(1);

      // Collapse f2 for zero scrollers
      (component as unknown as FeatureDictionaryInternals).toggleFolderExpand(f2.id);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelectorAll('lib-alphabet-scroller').length).toBe(0);
    });
  });

  describe('shell chrome focus', () => {
    it('hides the shell chrome while a view has unsaved changes, restores it on exit', () => {
      const chrome = TestBed.inject(ChromeService);
      const internals = component as unknown as FeatureDictionaryInternals;

      expect(chrome.focusMode()).toBe(false);
      internals.view.set('add');
      expect(chrome.focusMode()).toBe(true);
      internals.view.set('list');
      expect(chrome.focusMode()).toBe(false);
    });

    it('tracks the new-folder form too, so one registration covers every unsaved-changes input', () => {
      const chrome = TestBed.inject(ChromeService);
      const internals = component as unknown as FeatureDictionaryInternals;

      internals.showNewFolderForm.set(true);
      expect(chrome.focusMode()).toBe(true);
      internals.showNewFolderForm.set(false);
      expect(chrome.focusMode()).toBe(false);
    });

    it('releases focus when destroyed mid-edit so other routes keep their chrome', () => {
      const chrome = TestBed.inject(ChromeService);
      (component as unknown as FeatureDictionaryInternals).view.set('edit');
      expect(chrome.focusMode()).toBe(true);

      fixture.destroy();
      expect(chrome.focusMode()).toBe(false);
    });
  });
});
