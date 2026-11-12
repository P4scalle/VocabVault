import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { BulkImportService, FolderService, QuizService, Word, WordService } from '@vocavault/data-access';
import { Button, ToastService } from '@vocavault/ui';
import { shuffle } from '@vocavault/util';
import { BulkInput } from './bulk-input/bulk-input';
import { BulkPreview } from './bulk-preview/bulk-preview';
import { FolderPicker } from '../folder-picker/folder-picker';

@Component({
  selector: 'lib-bulk-add',
  imports: [A11yModule, Button, BulkInput, BulkPreview, FolderPicker],
  templateUrl: './bulk-add.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex-1 flex flex-col' },
})
export class BulkAdd {
  protected readonly bulkService = inject(BulkImportService);
  private readonly toast = inject(ToastService);
  private readonly wordService = inject(WordService);
  protected readonly folderService = inject(FolderService);
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);

  readonly cancelled = output<void>();
  readonly imported = output<number>();
  readonly viewIncomplete = output<void>();

  protected readonly step = signal<'input' | 'preview'>('input');
  protected readonly showPreview = computed(() => this.bulkService.rows().length > 0);

  protected readonly selectedFolderId = signal<string | null>(null);
  protected readonly folders = this.folderService.folders;
  protected readonly folderPickerOpen = signal(false);
  protected readonly folderWordCounts = this.folderService.folderWordCounts;

  protected readonly selectedFolder = computed(() => {
    const id = this.selectedFolderId();
    if (!id) return null;
    return this.folders().find(f => f.id === id) ?? null;
  });

  protected readonly importComplete = signal(false);
  protected readonly importedCount = signal(0);
  protected readonly importedWordIds = signal<string[]>([]);
  protected readonly incompleteImportedCount = signal(0);
  protected readonly showCount = signal(0);
  protected readonly animating = signal(false);

  protected readonly importableCount = this.bulkService.importableCount;

  private readonly completeImportedIds = computed(() =>
    this.importedWordIds().filter((id) => {
      const w = this.wordService.getWord(id);
      return w && !w.incomplete;
    })
  );

  protected readonly completeWordCount = computed(() => this.completeImportedIds().length);

  protected readonly quizSampleSize = computed(() =>
    Math.min(this.completeWordCount(), BulkAdd.IMMEDIATE_QUIZ_LIMIT)
  );

  protected readonly draftBanner = signal(false);

  constructor() {
    const restored = this.bulkService.restoreDraft();
    if (restored) {
      this.step.set('preview');
      this.draftBanner.set(true);
      setTimeout(() => this.draftBanner.set(false), 4000);
    }
  }

  protected readonly showLeaveConfirm = signal(false);

  protected onCancel(): void {
    if (this.bulkService.rows().length > 0) {
      this.showLeaveConfirm.set(true);
      return;
    }
    this.bulkService.reset();
    this.cancelled.emit();
  }

  protected confirmLeave(): void {
    this.showLeaveConfirm.set(false);
    this.bulkService.reset();
    this.cancelled.emit();
  }

  protected cancelLeave(): void {
    this.showLeaveConfirm.set(false);
  }

  protected onFolderSelected(folderId: string): void {
    this.selectedFolderId.set(folderId || null);
    this.folderPickerOpen.set(false);
  }

  protected onReview(): void {
    this.step.set('preview');
  }

  protected onBackToInput(): void {
    this.step.set('input');
  }

  protected onImport(): void {
    const { newWords, mergeWords } = this.bulkService.getImportableWords();
    const totalCount = newWords.length + mergeWords.length;
    if (totalCount === 0) return;

    // Apply folder only to new words. Merge words update existing entries.
    const folderId = this.selectedFolderId();
    const newWordsWithFolder = folderId
      ? newWords.map((item) => ({ ...item, folderId }))
      : newWords;

    let addedWords: Word[] = [];
    if (newWordsWithFolder.length > 0) {
      const { words, ok } = this.wordService.addWords(newWordsWithFolder);
      if (!ok) {
        this.toast.show('Could not save. Storage may be full.', 'error');
        return;
      }
      addedWords = words;
    }

    const mergedWordIds: string[] = [];
    for (const merge of mergeWords) {
      const ok = this.wordService.updateWord(merge.duplicateOf, {
        definition: merge.definition,
        pronunciation: merge.pronunciation,
        examples: merge.examples,
      });
      if (ok) {
        mergedWordIds.push(merge.duplicateOf);
      }
    }

    const incompleteCount = newWordsWithFolder.filter((w) => w.incomplete).length;
    this.importedCount.set(totalCount);
    this.incompleteImportedCount.set(incompleteCount);
    this.importedWordIds.set(addedWords.map((w) => w.id));
    this.importComplete.set(true);
    this.bulkService.clearDraft();

    this.animateCount(totalCount);

    // Undo toast. For new words, delete them; for merged words, undo is not supported (would need to store old values).
    const newWordIds = new Set(addedWords.map((w) => w.id));
    const mergeCount = mergedWordIds.length;
    const addCount = addedWords.length;
    const message =
      mergeCount > 0
        ? `${addCount} added, ${mergeCount} merged`
        : `${addCount} word${addCount !== 1 ? 's' : ''} added`;

    if (addedWords.length > 0) {
      this.toast.showWithAction(
        message,
        {
          label: 'Undo new',
          callback: () => {
            this.wordService.deleteWords(newWordIds);
          },
        },
        'info',
      );
    } else {
      this.toast.show(message, 'info');
    }

    // Don't emit yet. Let the success screen show first.
    // The parent switches view on imported.emit(), which would hide the success animation.
    // imported is emitted from onBackToDictionary() instead.
  }

  private animateCount(target: number): void {
    this.animating.set(true);
    this.showCount.set(0);
    const duration = Math.min(1200, target * 40);
    const start = performance.now();

    const tick = (now: number): void => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      this.showCount.set(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
      else this.animating.set(false);
    };
    requestAnimationFrame(tick);
  }

  protected onAddMore(): void {
    this.importComplete.set(false);
    this.importedCount.set(0);
    this.showCount.set(0);
    this.selectedFolderId.set(null);
    this.step.set('input');
    this.bulkService.reset();
  }

  protected onDoneNoImport(): void {
    this.bulkService.reset();
    this.cancelled.emit();
  }

  private static readonly IMMEDIATE_QUIZ_LIMIT = 20;

  // Common cleanup for all exit paths that complete an import
  private finishImport(): void {
    this.bulkService.reset();
    this.imported.emit(this.importedCount());
  }

  protected onQuizImported(): void {
    const wordIds = this.importedWordIds();
    if (wordIds.length === 0) return;

    // Persist the full set so it appears on the quiz page
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    this.quizService.addQuizSet({
      name: `Import (${today})`,
      description: `${wordIds.length} words imported`,
      wordIds,
      source: 'import',
    });

    // For immediate play, only complete words, capped at 20
    const playIds = shuffle([...this.completeImportedIds()]).slice(0, BulkAdd.IMMEDIATE_QUIZ_LIMIT);

    if (playIds.length === 0) {
      // All imported words are incomplete, so skip quiz and go to quiz list
      this.finishImport();
      void this.router.navigate(['/quiz']);
      return;
    }

    this.quizService.createTempQuizSet(playIds, 'Imported Words', '__bulk_import__');
    this.finishImport();
    void this.router.navigate(['/quiz', '__bulk_import__', 'play'], {
      queryParams: { mode: 'flashcard' },
    });
  }

  protected onBackToDictionary(): void {
    this.finishImport();
  }

  protected onGoToIncomplete(): void {
    this.bulkService.reset();
    this.viewIncomplete.emit();
  }
}
