import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EffectRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { WordService, Word, QuizService, FolderService, Folder, FOLDER_COLORS, HasUnsavedChanges, StorageWarningService, DataExportService, StarterWordsService, STARTER_WORDS } from '@vocavault/data-access';
import { AlphabetScroller, Button, EmptyState, HoldButton, InfoButton, InfoDrawer, ToastService } from '@vocavault/ui';
import { ChromeService, getScrollContainer, hexToHue, hslToHex, wordStartsWith } from '@vocavault/util';
import { A11yModule } from '@angular/cdk/a11y';
import { WordCard } from '../word-card/word-card';
import { WordForm, WordFormData } from '../word-form/word-form';
import { FolderPicker } from '../folder-picker/folder-picker';
import { FolderForm } from '../folder-form/folder-form';
import { FolderWordPicker } from '../folder-word-picker/folder-word-picker';
import { FolderWordItem } from '../folder-word-item/folder-word-item';
import { BulkAdd } from '../bulk-add/bulk-add';
type DictView = 'list' | 'add' | 'edit' | 'import';
type DictTab = 'words' | 'folders';

const SAVE_ERROR = 'Could not save. Storage may be full.';

function matchesSearch(word: Word, query: string): boolean {
  return wordStartsWith(word.word, query);
}

interface LetterGroup {
  letter: string;
  words: Word[];
}

function groupByLetter(words: Word[]): LetterGroup[] {
  const groups = new Map<string, Word[]>();
  for (const w of words) {
    const letter = w.word.charAt(0).toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter)?.push(w);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, words]) => ({ letter, words }));
}

@Component({
  selector: 'lib-feature-dictionary',
  imports: [A11yModule, Button, EmptyState, HoldButton, InfoButton, InfoDrawer, WordCard, WordForm, AlphabetScroller, FolderPicker, FolderForm, FolderWordPicker, FolderWordItem, BulkAdd],
  templateUrl: './feature-dictionary.html',
  styleUrl: './feature-dictionary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex-1 flex flex-col' },
})
export class FeatureDictionary implements HasUnsavedChanges {
  private readonly wordService = inject(WordService);
  private readonly quizService = inject(QuizService);
  protected readonly folderService = inject(FolderService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly chrome = inject(ChromeService);
  private readonly storageWarning = inject(StorageWarningService);
  private readonly dataExport = inject(DataExportService);
  private readonly starter = inject(StarterWordsService);

  /** One-tap sample words offered on the empty dictionary, with the term being added (if any). */
  protected readonly starterWords = STARTER_WORDS;
  protected readonly addingStarter = signal<string | null>(null);

  protected readonly words = this.wordService.words;
  protected readonly folders = this.folderService.folders;

  protected readonly view = signal<DictView>('list');
  protected readonly dictTab = signal<DictTab>('words');
  protected readonly infoTopic = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly selectedWord = signal<Partial<Word> | null>(null);
  protected readonly autoLookupNext = signal(false);
  protected readonly activeLetter = signal('');
  protected readonly selectedFolderId = signal<string | null>(null);
  protected readonly quizReviewFilter = signal<string[]>([]);
  protected readonly editingFolderId = signal<string | null>(null);
  protected readonly showNewFolderForm = signal(false);

  protected readonly overflowMenuFolderId = signal<string | null>(null);

  protected readonly expandedFolderIds = signal<Set<string>>(new Set());
  protected readonly uncategorizedExpanded = signal(false);

  protected readonly selectMode = signal(false);
  protected readonly selectedWordIds = signal<Set<string>>(new Set());

  protected readonly wordPickerFolder = signal<Folder | null>(null);
  protected readonly wordPickerOpen = signal(false);

  protected readonly addFormResetKey = signal(0);

  protected readonly nextFolderColor = computed(() => {
    const used = this.folders().length;
    return FOLDER_COLORS[used % FOLDER_COLORS.length];
  });

  protected readonly selectAllLabel = computed(() =>
    this.selectedWordCount() === this.filteredWords().length && this.selectedWordCount() > 0
      ? 'Deselect All'
      : 'Select All'
  );

  protected readonly bulkMoveTitle = computed(() => {
    const c = this.selectedWordCount();
    return `Move ${c} word${c !== 1 ? 's' : ''}`;
  });

  protected readonly deleteConfirmTitle = computed(() => {
    const c = this.selectedWordCount();
    return `Delete ${c} word${c !== 1 ? 's' : ''}?`;
  });

  protected readonly deleteQuizImpact = computed(() => {
    const ids = this.selectedWordIds();
    let affectedCount = 0;
    for (const id of ids) {
      if (this.quizService.getQuizSetIdsForWord(id).length > 0) affectedCount++;
    }
    return affectedCount;
  });

  protected readonly wordFolderMap = computed(() => {
    const map = new Map<string, Folder>();
    for (const w of this.words()) {
      if (w.folderId) {
        const folder = this.folderService.getFolder(w.folderId);
        if (folder) map.set(w.id, folder);
      }
    }
    return map;
  });

  protected readonly selectedFolder = computed(() => {
    const fid = this.selectedFolderId();
    return fid ? this.folderService.getFolder(fid) ?? null : null;
  });

  protected readonly wordsByFolder = computed(() => {
    const map = new Map<string, Word[]>();
    const q = this.searchQuery().toLowerCase().trim();
    for (const w of this.words()) {
      if (!w.folderId) continue;
      if (q && !matchesSearch(w, q)) continue;
      if (!map.has(w.folderId)) map.set(w.folderId, []);
      map.get(w.folderId)?.push(w);
    }
    return map;
  });

  protected readonly unfolderedWords = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    return this.words().filter(w => {
      if (w.folderId) return false;
      return !q || matchesSearch(w, q);
    });
  });

  readonly hasUnsavedChanges = computed(() => {
    const v = this.view();
    return v === 'add' || v === 'edit' || v === 'import' || this.editingFolderId() !== null || this.showNewFolderForm();
  });

  private setView(v: DictView): void {
    this.view.set(v);
  }

  private setEditingFolder(id: string | null): void {
    this.editingFolderId.set(id);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  // Overflow menu is intentionally a plain button popover (not role="menu") to
  // avoid an unmet roving-focus keyboard contract. These scoped listeners replace
  // the former page-root (click)/(keydown.escape) handlers.
  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.overflowMenuFolderId() !== null) {
      this.closeOverflowMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onDocumentEscape(): void {
    if (this.overflowMenuFolderId() !== null) {
      this.closeOverflowMenu();
    }
  }

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => {
        if (params.get('addWord') === 'true') {
          this.setView('add');
        }
        if (params.get('addFolder') === 'true') {
          this.openNewFolderForm();
        }
        if (params.get('importWords') === 'true') {
          this.setView('import');
        }
        if (params.get('filter') === 'flagged') {
          this.flagFilter.set(true);
        }
        const highlight = params.get('highlight');
        if (highlight) {
          this.quizReviewFilter.set(highlight.split(',').filter(Boolean));
          this.router.navigate([], { queryParams: {}, replaceUrl: true });
        }
        const wordId = params.get('wordId');
        if (wordId) {
          const word = this.wordService.getWord(wordId);
          if (word) {
            this.onSelectWord(word);
          }
          this.router.navigate([], { queryParams: {}, replaceUrl: true });
        }
      });

    afterNextRender(() => {
      this.setupScrollSpy();
    });

    // Hide the shell chrome whenever this view has unsaved changes. Registering the
    // computed (not pushing per-setter) means no state mutation can forget to sync.
    this.destroyRef.onDestroy(this.chrome.registerFocusWhile(this.hasUnsavedChanges));
  }

  protected readonly folderWordCounts = this.folderService.folderWordCounts;

  protected readonly incompleteFilter = signal(false);

  protected readonly incompleteCount = computed(() =>
    this.words().filter((w) => w.incomplete).length,
  );

  protected readonly flagFilter = signal(false);

  protected readonly flaggedCount = computed(() =>
    this.words().filter((w) => w.flag != null).length,
  );

  protected readonly filteredWords = computed(() => {
    let words = this.words();
    const reviewIds = this.quizReviewFilter();
    if (reviewIds.length > 0) {
      const idSet = new Set(reviewIds);
      return words.filter((w) => idSet.has(w.id));
    }
    const folderId = this.selectedFolderId();
    if (folderId) {
      words = words.filter((w) => w.folderId === folderId);
    }
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      words = words.filter((w) => matchesSearch(w, q));
    }
    if (this.incompleteFilter()) {
      words = words.filter((w) => w.incomplete);
    }
    if (this.flagFilter()) {
      words = words.filter((w) => w.flag != null);
    }
    return words;
  });

  protected clearQuizReviewFilter(): void {
    this.quizReviewFilter.set([]);
  }

  protected toggleIncompleteFilter(): void {
    this.incompleteFilter.update((v) => !v);
  }

  protected toggleFlagFilter(): void {
    this.flagFilter.update((v) => !v);
  }

  protected onFlagToggle(word: Word): void {
    if (word.flag) {
      this.wordService.unflagWord(word.id);
    } else {
      this.wordService.flagWord(word.id);
    }
  }

  protected readonly groupedWords = computed(() => groupByLetter(this.filteredWords()));

  protected readonly validLetters = computed(() =>
    this.groupedWords().map((g) => g.letter),
  );

  /** Hide the alphabet scroller when there are fewer than 3 letter groups (it's useless for 1-2 groups) */
  protected readonly showScroller = computed(() => this.groupedWords().length >= 3);

  protected readonly groupedWordsByFolder = computed(() => {
    const result = new Map<string, LetterGroup[]>();
    for (const [folderId, words] of this.wordsByFolder()) {
      result.set(folderId, groupByLetter(words));
    }
    return result;
  });

  protected toggleOverflowMenu(folderId: string, event: Event): void {
    event.stopPropagation();
    this.overflowMenuFolderId.update(current => current === folderId ? null : folderId);
  }

  protected closeOverflowMenu(): void {
    this.overflowMenuFolderId.set(null);
  }

  protected toggleFolderExpand(folderId: string): void {
    this.expandedFolderIds.update(ids => {
      const next = new Set(ids);
      if (next.has(folderId)) {
        next.delete(folderId);
        this.closeOverflowMenu();
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  protected readonly groupedUncategorizedWords = computed(() => groupByLetter(this.unfolderedWords()));

  protected readonly uncategorizedValidLetters = computed(() =>
    this.groupedUncategorizedWords().map((g) => g.letter),
  );

  protected readonly showUncategorizedScroller = computed(
    () => this.groupedUncategorizedWords().length >= 5 && this.uncategorizedExpanded(),
  );

  protected folderLetters(groups: { letter: string }[]): string[] {
    return groups.map((g) => g.letter);
  }

  protected toggleUncategorizedExpanded(): void {
    this.uncategorizedExpanded.update((v) => !v);
  }

  protected readonly selectedWordCount = computed(() => this.selectedWordIds().size);

  private scrollSpyPaused = false;
  private scrollSpyTimer = 0;
  private scrollObserver: IntersectionObserver | null = null;
  private scrollSpyRefreshEffect: EffectRef | null = null;
  private observedHeaders: HTMLElement[] = [];

  private scrollToSelector(selector: string, isFirstGroup: boolean): void {
    const container = getScrollContainer();
    if (!container) return;

    // First group = scroll to absolute top, revealing the page header
    if (isFirstGroup) {
      const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
      container.scrollTo({ top: 0, behavior });
      return;
    }

    const el = document.querySelector(selector);
    if (!el) return;

    const paddingTop = parseFloat(getComputedStyle(container).paddingTop) || 0;
    const elTop = el.getBoundingClientRect().top;
    const containerTop = container.getBoundingClientRect().top;
    container.scrollTo({ top: container.scrollTop + elTop - containerTop - paddingTop, behavior: 'instant' });
  }

  protected onLetterSelected(letter: string): void {
    this.activeLetter.set(letter);
    this.scrollToSelector(`[data-letter="${letter}"]`, letter === this.validLetters()[0]);
  }

  protected onFolderLetterSelected(letter: string): void {
    this.activeLetter.set(letter);
    // Folder scrollers are contextual, so never scroll to absolute top (would leave the folder section)
    this.scrollToSelector(`[data-folder-letter="${letter}"]`, false);
  }

  protected onUncategorizedLetterSelected(letter: string): void {
    this.activeLetter.set(letter);
    // Uncategorized scroller is contextual, so never scroll to absolute top
    this.scrollToSelector(`[data-uncat-letter="${letter}"]`, false);
  }

  protected onScrubbing(active: boolean): void {
    if (active) {
      this.scrollSpyPaused = true;
      clearTimeout(this.scrollSpyTimer);
    } else {
      // Settle delay: let final scroll complete before resuming spy
      clearTimeout(this.scrollSpyTimer);
      this.scrollSpyTimer = window.setTimeout(() => {
        this.scrollSpyPaused = false;
      }, 150);
    }
  }

  private setupScrollSpy(): void {
    const visibleLetters = new Set<string>();

    const container = getScrollContainer();
    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        if (this.scrollSpyPaused) return;

        for (const entry of entries) {
          const ds = (entry.target as HTMLElement).dataset;
          const letter = ds['letter'] ?? ds['folderLetter'] ?? ds['uncatLetter'];
          if (!letter) continue;
          if (entry.isIntersecting) {
            visibleLetters.add(letter);
          } else {
            visibleLetters.delete(letter);
          }
        }

        if (visibleLetters.size > 0) {
          const sorted = [...visibleLetters].sort();
          this.activeLetter.set(sorted[0]);
        }
      },
      { root: container, threshold: 0 },
    );

    this.observeHeaders();

    // Re-observe when the word list changes (filters, adds, deletes, folder expand/collapse)
    this.scrollSpyRefreshEffect = effect((onCleanup) => {
      this.groupedWords(); // track dependency
      this.groupedWordsByFolder(); // track folder words
      this.groupedUncategorizedWords(); // track uncategorized words
      const rafId = requestAnimationFrame(() => this.observeHeaders());
      onCleanup(() => cancelAnimationFrame(rafId));
    }, { injector: this.injector });

    this.destroyRef.onDestroy(() => {
      this.scrollObserver?.disconnect();
      clearTimeout(this.scrollSpyTimer);
      visibleLetters.clear();
    });
  }

  private observeHeaders(): void {
    if (!this.scrollObserver) return;

    const headers = document.querySelectorAll<HTMLElement>('[data-letter],[data-folder-letter],[data-uncat-letter]');
    const nextHeaders = Array.from(headers);
    const prevSet = new Set(this.observedHeaders);
    const nextSet = new Set(nextHeaders);

    // Unobserve removed headers
    for (const el of this.observedHeaders) {
      if (!nextSet.has(el)) this.scrollObserver.unobserve(el);
    }

    // Observe newly added headers
    for (const el of nextHeaders) {
      if (!prevSet.has(el)) this.scrollObserver.observe(el);
    }

    this.observedHeaders = nextHeaders;
  }

  private checkStorageWarning(): void {
    const { warning } = this.storageWarning.checkAndWarn();
    if (warning) {
      this.toast.showWithAction(
        'Your dictionary is getting large. Export a backup to keep your data safe.',
        { label: 'Export now', callback: () => this.dataExport.exportAll() },
        'info',
        8000,
      );
    }
  }

  protected onAddWord(): void {
    this.selectedWord.set(null);
    this.autoLookupNext.set(false);
    this.setView('add');
  }

  /** Add a one-tap starter word; its definition is fetched automatically. */
  protected async onAddStarterWord(term: string): Promise<void> {
    if (this.addingStarter()) return;
    this.addingStarter.set(term);
    try {
      const { ok, incomplete } = await this.starter.add(term);
      if (!ok) {
        this.toast.show(SAVE_ERROR, 'error');
      } else if (incomplete) {
        this.toast.show(`Added "${term}". Add a definition when you're ready.`, 'info');
      } else {
        this.toast.show(`Added "${term}"`, 'success');
      }
    } finally {
      this.addingStarter.set(null);
    }
  }

  protected onLookupFromSearch(): void {
    const term = this.searchQuery().trim();
    if (!term) return;
    this.selectedWord.set({ word: term });
    this.searchQuery.set('');
    this.autoLookupNext.set(true);
    this.setView('add');
  }

  protected switchToFoldersTab(): void {
    this.dictTab.set('folders');
    if (this.selectMode()) this.toggleSelectMode();
  }

  protected onSelectWord(word: Word): void {
    this.selectedWord.set(word);
    this.setView('edit');
  }

  protected onRemoveFromFolder(word: Word): void {
    const prevFolderId = word.folderId;
    if (this.wordService.updateWord(word.id, { folderId: undefined })) {
      this.toast.showWithAction(`Removed from folder`, {
        label: 'Undo',
        callback: () => {
          this.wordService.updateWord(word.id, { folderId: prevFolderId });
        },
      });
    } else {
      this.toast.show(SAVE_ERROR, 'error');
    }
  }

  protected onDeleteWord(word: Word): void {
    const quizSetIds = this.quizService.getQuizSetIdsForWord(word.id);
    this.quizService.removeWordFromAllQuizSets(word.id);
    if (this.wordService.deleteWord(word.id)) {
      this.toast.showWithAction('Term deleted', {
        label: 'Undo',
        callback: () => {
          this.wordService.restoreWord(word);
          this.quizService.restoreWordToQuizSets(word.id, quizSetIds);
        },
      }, 'info');
    } else {
      this.toast.show(SAVE_ERROR, 'error');
    }
  }

  protected onSaveWord(data: WordFormData): void {
    if (this.view() === 'edit' && this.selectedWord()) {
      const word = this.selectedWord();
      const ok = this.wordService.updateWord(word?.id ?? '', data);
      if (ok) this.toast.show('Term updated!');
      if (!ok) {
        this.toast.show(SAVE_ERROR, 'error');
        return;
      }
      this.setView('list');
      this.selectedWord.set(null);
      this.autoLookupNext.set(false);
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    } else {
      const result = this.wordService.addWord(data);
      if (!result.ok) {
        this.toast.show(SAVE_ERROR, 'error');
        return;
      }
      this.toast.show('Term added!');
      this.selectedWord.set(null);
      this.autoLookupNext.set(false);
      this.addFormResetKey.update((k) => k + 1);
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
    this.checkStorageWarning();
  }

  protected onDoneAdding(): void {
    this.setView('list');
    this.selectedWord.set(null);
    this.autoLookupNext.set(false);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected onCancelForm(): void {
    this.setView('list');
    this.selectedWord.set(null);
    this.autoLookupNext.set(false);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected onAddWordToFolder(folder: Folder): void {
    this.wordPickerFolder.set(null);
    this.selectedFolderId.set(folder.id);
    this.selectedWord.set(null);
    this.autoLookupNext.set(false);
    this.setView('add');
  }

  protected onBulkImportToFolder(folder: Folder): void {
    this.wordPickerFolder.set(null);
    this.selectedFolderId.set(folder.id);
    this.setView('import');
  }

  protected onBulkImport(): void {
    this.setView('import');
  }

  protected onBulkCancel(): void {
    this.setView('list');
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected onBulkImported(): void {
    this.checkStorageWarning();
    this.setView('list');
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected onViewIncomplete(): void {
    this.setView('list');
    this.incompleteFilter.set(true);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected openNewFolderForm(): void {
    this.dictTab.set('folders');
    this.showNewFolderForm.set(true);
  }

  protected onCreateFolderFromForm(data: { name: string; color: string }): void {
    const { folder, ok } = this.folderService.addFolder(data.name, data.color);
    if (ok) {
      this.showNewFolderForm.set(false);
      this.selectedFolderId.set(folder.id);
      this.expandedFolderIds.update(ids => new Set(ids).add(folder.id));
      this.toast.show('Folder created!');
    } else {
      this.toast.show(SAVE_ERROR, 'error');
    }
  }

  protected onCancelNewFolder(): void {
    this.showNewFolderForm.set(false);
  }

  protected onInlineNameUpdate(event: Event): void {
    const name = (event.target as HTMLInputElement).value.trim();
    const fid = this.selectedFolderId();
    if (!fid || !name) return;
    this.folderService.updateFolder(fid, { name });
  }

  protected onInlineColorUpdate(color: string): void {
    const fid = this.selectedFolderId();
    if (!fid) return;
    this.folderService.updateFolder(fid, { color });
  }

  protected onInlineHueUpdate(hue: number): void {
    this.onInlineColorUpdate(hslToHex(hue));
  }

  protected hexToHue = hexToHue;

  protected onEditFolder(folder: Folder): void {
    this.setEditingFolder(folder.id);
  }

  protected onSaveEditFolderFromForm(data: { name: string; color: string }): void {
    const id = this.editingFolderId();
    if (!id) return;
    if (this.folderService.updateFolder(id, data)) {
      this.setEditingFolder(null);
      this.toast.show('Folder updated!');
    } else {
      this.toast.show(SAVE_ERROR, 'error');
    }
  }

  protected onCancelEditFolder(): void {
    this.setEditingFolder(null);
  }

  protected onSelectWordsForFolder(folder: Folder): void {
    this.setEditingFolder(null);
    this.wordPickerFolder.set(folder);
    this.wordPickerOpen.set(true);
  }

  protected onWordsAddedToFolder(wordIds: string[]): void {
    const folder = this.wordPickerFolder();
    if (!folder) return;
    let failed = false;
    wordIds.forEach((id) => {
      if (!this.wordService.updateWord(id, { folderId: folder.id })) {
        failed = true;
      }
    });
    this.wordPickerFolder.set(null);
    this.selectedFolderId.set(folder.id);
    this.expandedFolderIds.update(ids => new Set(ids).add(folder.id));
    if (failed) {
      this.toast.show(SAVE_ERROR, 'error');
    } else {
      this.toast.show(`${wordIds.length} word${wordIds.length !== 1 ? 's' : ''} added to ${folder.name}`);
    }
  }

  protected readonly folderDeleteTarget = signal<Folder | null>(null);

  protected readonly folderDeleteWordCount = computed(() => {
    const folder = this.folderDeleteTarget();
    if (!folder) return 0;
    return this.words().filter((w) => w.folderId === folder.id).length;
  });

  protected confirmDeleteFolder(folder: Folder): void {
    const wordCount = this.words().filter((w) => w.folderId === folder.id).length;
    if (wordCount > 0) {
      this.folderDeleteTarget.set(folder);
    } else {
      this.executeDeleteFolder(folder);
    }
  }

  protected executeDeleteFolder(folder: Folder): void {
    // Capture orphaned words for undo
    const orphanedWords = this.words().filter((w) => w.folderId === folder.id);
    orphanedWords.forEach((w) => {
      this.wordService.updateWord(w.id, { folderId: undefined });
    });

    if (this.folderService.deleteFolder(folder.id)) {
      this.expandedFolderIds.update(ids => {
        const next = new Set(ids);
        next.delete(folder.id);
        return next;
      });
      if (this.selectedFolderId() === folder.id) {
        this.selectedFolderId.set(null);
      }
      this.setEditingFolder(null);
      this.folderDeleteTarget.set(null);
      this.toast.showWithAction('Folder deleted', {
        label: 'Undo',
        callback: () => {
          this.folderService.restoreFolder(folder);
          orphanedWords.forEach((w) => {
            this.wordService.updateWord(w.id, { folderId: folder.id });
          });
        },
      }, 'info');
    } else {
      this.toast.show(SAVE_ERROR, 'error');
    }
  }

  protected cancelDeleteFolder(): void {
    this.folderDeleteTarget.set(null);
  }

  protected toggleFolderFilter(folderId: string): void {
    this.selectedFolderId.set(
      this.selectedFolderId() === folderId ? null : folderId,
    );
  }

  protected getFolderName(folderId?: string): string {
    if (!folderId) return '';
    return this.folderService.getFolder(folderId)?.name ?? '';
  }

  protected getFolderColor(folderId?: string): string {
    if (!folderId) return '';
    return this.folderService.getFolder(folderId)?.color ?? '';
  }

  protected readonly folderPickerWord = signal<Word | null>(null);
  protected readonly folderPickerVisible = signal(true);

  protected getWordFolder(word: Word): Folder | undefined {
    return this.wordFolderMap().get(word.id);
  }

  protected onFolderRequested(word: Word): void {
    this.folderPickerWord.set(word);
    this.folderPickerVisible.set(true);
  }

  protected assignFolder(folderId: string | null): void {
    const word = this.folderPickerWord();
    if (!word) return;
    if (this.wordService.updateWord(word.id, { folderId: folderId ?? undefined })) {
      this.toast.show(folderId ? 'Moved to folder' : 'Removed from folder');
    } else {
      this.toast.show(SAVE_ERROR, 'error');
    }
    this.folderPickerVisible.set(false);
    this.folderPickerWord.set(null);
  }

  private readonly folderPickerCloseEffect = effect(() => {
    if (!this.folderPickerVisible()) {
      this.folderPickerWord.set(null);
    }
  });

  protected toggleSelectMode(): void {
    if (this.selectMode()) {
      this.selectMode.set(false);
      this.selectedWordIds.set(new Set());
    } else {
      this.selectMode.set(true);
    }
  }

  protected toggleWordSelection(word: Word): void {
    this.selectedWordIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(word.id)) {
        next.delete(word.id);
      } else {
        next.add(word.id);
      }
      return next;
    });
  }

  protected selectAllVisible(): void {
    const visible = this.filteredWords();
    const allSelected = visible.every((w) => this.selectedWordIds().has(w.id));
    if (allSelected) {
      this.selectedWordIds.set(new Set());
    } else {
      this.selectedWordIds.set(new Set(visible.map((w) => w.id)));
    }
  }

  protected readonly bulkPickerOpen = signal(false);
  protected readonly confirmBulkDelete = signal(false);

  protected bulkAssignFolder(folderId: string | null): void {
    const ids = this.selectedWordIds();
    let failed = false;
    ids.forEach((id) => {
      if (!this.wordService.updateWord(id, { folderId: folderId ?? undefined })) {
        failed = true;
      }
    });
    const count = ids.size;
    this.selectedWordIds.set(new Set());
    this.selectMode.set(false);
    this.bulkPickerOpen.set(false);
    if (failed) {
      this.toast.show(SAVE_ERROR, 'error');
    } else {
      this.toast.show(`${count} word${count !== 1 ? 's' : ''} moved`);
    }
  }

  protected onDeleteSelected(): void {
    const ids = this.selectedWordIds();
    // Capture words and quiz membership before deletion for undo
    const deletedWords = this.words().filter((w) => ids.has(w.id));
    const quizMembership = new Map<string, string[]>();
    ids.forEach((id) => {
      quizMembership.set(id, this.quizService.getQuizSetIdsForWord(id));
      this.quizService.removeWordFromAllQuizSets(id);
      this.wordService.deleteWord(id);
    });
    const count = ids.size;
    this.selectedWordIds.set(new Set());
    this.selectMode.set(false);

    // Auto-clear filters when they would produce an empty view
    if (this.incompleteFilter() && this.incompleteCount() === 0) {
      this.incompleteFilter.set(false);
    }
    if (this.flagFilter() && this.flaggedCount() === 0) {
      this.flagFilter.set(false);
    }
    if (this.selectedFolderId() && this.filteredWords().length === 0) {
      this.selectedFolderId.set(null);
    }

    this.toast.showWithAction(`${count} word${count !== 1 ? 's' : ''} deleted`, {
      label: 'Undo',
      callback: () => {
        this.wordService.restoreWords(deletedWords);
        for (const [wordId, qsIds] of quizMembership) {
          this.quizService.restoreWordToQuizSets(wordId, qsIds);
        }
      },
    }, 'info');
  }

  protected onConfirmBulkDelete(): void {
    this.confirmBulkDelete.set(false);
    this.onDeleteSelected();
  }

  protected onDeleteFromForm(): void {
    const word = this.selectedWord();
    if (word?.id) {
      const wordId = word.id;
      const quizSetIds = this.quizService.getQuizSetIdsForWord(wordId);
      this.quizService.removeWordFromAllQuizSets(wordId);
      if (this.wordService.deleteWord(wordId)) {
        this.toast.showWithAction('Term deleted', {
          label: 'Undo',
          callback: () => {
            this.wordService.restoreWord(word as Word);
            this.quizService.restoreWordToQuizSets(wordId, quizSetIds);
          },
        }, 'info');
      } else {
        this.toast.show(SAVE_ERROR, 'error');
      }
    }
    this.setView('list');
    this.selectedWord.set(null);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected reloadPage(): void {
    window.location.reload();
  }
}
