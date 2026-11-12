import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Folder, Word } from '@vocavault/data-access';
import { BottomSheet } from '@vocavault/ui';
import { wordStartsWith } from '@vocavault/util';

@Component({
  selector: 'lib-folder-word-picker',
  imports: [BottomSheet, FormsModule],
  templateUrl: './folder-word-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolderWordPicker {
  readonly words = input.required<Word[]>();
  readonly folder = input.required<Folder>();
  readonly visible = model<boolean>(false);
  readonly wordsAdded = output<string[]>();
  readonly addNewWord = output<void>();
  readonly bulkImport = output<void>();

  protected readonly searchQuery = signal('');
  protected readonly selectedIds = signal<Set<string>>(new Set());

  protected readonly filteredWords = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.words().filter((w) => !w.incomplete);
    const filtered = q
      ? all.filter((w) => wordStartsWith(w.word, q))
      : all;
    return [...filtered].sort((a, b) => a.word.localeCompare(b.word));
  });

  protected readonly selectableWords = computed(() =>
    this.filteredWords().filter((w) => !this.isAlreadyInFolder(w)),
  );

  protected readonly allSelected = computed(() => {
    const selectable = this.selectableWords();
    if (selectable.length === 0) return false;
    const ids = this.selectedIds();
    return selectable.every((w) => ids.has(w.id));
  });

  protected readonly newSelectionCount = computed(() => {
    const folder = this.folder();
    let count = 0;
    for (const id of this.selectedIds()) {
      const word = this.words().find((w) => w.id === id);
      if (word && word.folderId !== folder.id) count++;
    }
    return count;
  });

  protected isAlreadyInFolder(word: Word): boolean {
    return word.folderId === this.folder().id;
  }

  protected isSelected(word: Word): boolean {
    return this.isAlreadyInFolder(word) || this.selectedIds().has(word.id);
  }

  protected toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedIds.update((ids) => {
        const next = new Set(ids);
        for (const w of this.selectableWords()) next.delete(w.id);
        return next;
      });
    } else {
      this.selectedIds.update((ids) => {
        const next = new Set(ids);
        for (const w of this.selectableWords()) next.add(w.id);
        return next;
      });
    }
  }

  protected toggleWord(word: Word): void {
    if (this.isAlreadyInFolder(word)) return;
    this.selectedIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(word.id)) {
        next.delete(word.id);
      } else {
        next.add(word.id);
      }
      return next;
    });
  }

  protected onAddNewWord(): void {
    this.visible.set(false);
    this.reset();
    this.addNewWord.emit();
  }

  protected onBulkImport(): void {
    this.visible.set(false);
    this.reset();
    this.bulkImport.emit();
  }

  protected onConfirm(): void {
    const folder = this.folder();
    const newIds = [...this.selectedIds()].filter((id) => {
      const word = this.words().find((w) => w.id === id);
      return word && word.folderId !== folder.id;
    });
    if (newIds.length > 0) {
      this.wordsAdded.emit(newIds);
    }
    this.visible.set(false);
    this.reset();
  }

  protected onCancel(): void {
    this.visible.set(false);
    this.reset();
  }

  private reset(): void {
    this.selectedIds.set(new Set());
    this.searchQuery.set('');
  }
}
