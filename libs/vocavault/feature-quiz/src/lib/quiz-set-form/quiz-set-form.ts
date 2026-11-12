import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuizSet, WordService, FolderService } from '@vocavault/data-access';
import { Button, ColorPicker, HoldButton, PageHeader } from '@vocavault/ui';
import { wordStartsWith } from '@vocavault/util';

export interface QuizSetFormData {
  name: string;
  description: string;
  wordIds: string[];
  color?: string;
}

@Component({
  selector: 'lib-quiz-set-form',
  imports: [FormsModule, Button, ColorPicker, HoldButton, PageHeader],
  templateUrl: './quiz-set-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex-1 flex flex-col' },
})
export class QuizSetForm implements OnInit {
  private readonly wordService = inject(WordService);
  protected readonly folderService = inject(FolderService);
  protected readonly folders = this.folderService.folders;

  readonly editQuizSet = input<QuizSet | null>(null);
  readonly saved = output<QuizSetFormData>();
  readonly cancelled = output<void>();
  readonly deleteRequested = output<void>();
  readonly dirtyChange = output<boolean>();

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly selectedWordIds = signal<string[]>([]);
  protected readonly color = signal<string>('');
  protected readonly showColorPicker = signal(false);
  private initialName = '';
  private initialWordIds: string[] = [];

  protected readonly availableWords = this.wordService.quizzableWords;
  protected readonly wordFilter = signal('');

  protected readonly filteredWords = computed(() => {
    const q = this.wordFilter().toLowerCase().trim();
    if (!q) return this.availableWords();
    return this.availableWords().filter((w) => wordStartsWith(w.word, q));
  });

  protected readonly allFilteredSelected = computed(() => {
    const filtered = this.filteredWords();
    if (filtered.length === 0) return false;
    const selected = this.selectedWordIds();
    return filtered.every((w) => selected.includes(w.id));
  });

  protected readonly isEditMode = computed(() => this.editQuizSet() !== null);
  protected readonly canSave = computed(
    () => this.name().trim().length > 0 && this.selectedWordIds().length > 0,
  );

  readonly isDirty = computed(() => {
    const nameChanged = this.name().trim() !== this.initialName;
    const current = this.selectedWordIds();
    const initial = this.initialWordIds;
    const idsChanged =
      current.length !== initial.length ||
      !current.every((id) => initial.includes(id));
    return nameChanged || idsChanged;
  });

  private readonly dirtyEffect = effect(() => {
    this.dirtyChange.emit(this.isDirty());
  });

  ngOnInit(): void {
    const qs = this.editQuizSet();
    if (qs) {
      this.name.set(qs.name);
      this.description.set(qs.description);
      this.selectedWordIds.set([...qs.wordIds]);
      this.initialName = qs.name;
      this.initialWordIds = [...qs.wordIds];
      if (qs.color) {
        this.color.set(qs.color);
        this.showColorPicker.set(true);
      }
    }
  }

  protected readonly selectedFolderIds = signal<Set<string>>(new Set());

  protected selectFolder(folderId: string): void {
    const folderWords = this.availableWords().filter((w) => w.folderId === folderId);
    const currentIds = new Set(this.selectedWordIds());
    const alreadyAllSelected = folderWords.length > 0 && folderWords.every((w) => currentIds.has(w.id));

    if (alreadyAllSelected) {
      // Deselect folder words
      const removeIds = new Set(folderWords.map((w) => w.id));
      this.selectedWordIds.update((ids) => ids.filter((id) => !removeIds.has(id)));
      this.selectedFolderIds.update((s) => { const n = new Set(s); n.delete(folderId); return n; });
    } else {
      // Select folder words
      const newIds = folderWords.filter((w) => !currentIds.has(w.id)).map((w) => w.id);
      this.selectedWordIds.update((ids) => [...ids, ...newIds]);
      this.selectedFolderIds.update((s) => new Set([...s, folderId]));
    }

    // Auto-fill name from folder if empty
    if (!alreadyAllSelected && !this.name().trim()) {
      const folder = this.folderService.getFolder(folderId);
      if (folder) this.name.set(folder.name);
    }

    // Auto-inherit folder color if no color is set
    if (!alreadyAllSelected && !this.color()) {
      const folder = this.folderService.getFolder(folderId);
      if (folder?.color) {
        this.color.set(folder.color);
        this.showColorPicker.set(true);
      }
    }
  }

  protected toggleAll(): void {
    const filtered = this.filteredWords();
    if (this.allFilteredSelected()) {
      const removeIds = new Set(filtered.map((w) => w.id));
      this.selectedWordIds.update((ids) => ids.filter((id) => !removeIds.has(id)));
    } else {
      const currentIds = new Set(this.selectedWordIds());
      const newIds = filtered.filter((w) => !currentIds.has(w.id)).map((w) => w.id);
      this.selectedWordIds.update((ids) => [...ids, ...newIds]);
    }
  }

  protected toggleWord(wordId: string): void {
    this.selectedWordIds.update((ids) =>
      ids.includes(wordId) ? ids.filter((id) => id !== wordId) : [...ids, wordId],
    );
  }

  protected isWordSelected(wordId: string): boolean {
    return this.selectedWordIds().includes(wordId);
  }

  protected onSave(): void {
    if (!this.canSave()) return;
    this.saved.emit({
      name: this.name().trim(),
      description: this.description().trim(),
      wordIds: this.selectedWordIds(),
      color: this.color() || undefined,
    });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }

  protected onDelete(): void {
    this.deleteRequested.emit();
  }
}
