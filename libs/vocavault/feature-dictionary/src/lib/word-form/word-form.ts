import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button, DefinitionPicker, HoldButton, PageHeader } from '@vocavault/ui';
import {
  DefinitionMeaning,
  DictionaryApiService,
  Folder,
  FolderService,
  Word,
  isPlaceholderDefinition,
  parseDefinition,
  removeMeaning,
} from '@vocavault/data-access';
import { FolderPicker } from '../folder-picker/folder-picker';
import { useSafeTimeout } from '@vocavault/util';

export interface WordFormData {
  word: string;
  pronunciation: string;
  definition: string;
  examples: string[];
  folderId?: string;
  quizMeaningIndex?: number;
}

@Component({
  selector: 'lib-word-form',
  imports: [FormsModule, Button, PageHeader, HoldButton, FolderPicker, DefinitionPicker],
  templateUrl: './word-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex-1 flex flex-col' },
  styles: [
    `
      :host {
        .vv-lookup-highlight {
          animation: vv-highlight-fade 2s ease-out;
        }
      }
      @keyframes vv-highlight-fade {
        0%,
        30% {
          background-color: rgba(var(--vv-brand-rgb, 99, 102, 241), 0.12);
          border-radius: 0.75rem;
        }
        100% {
          background-color: transparent;
        }
      }
    `,
  ],
})
export class WordForm implements OnInit {
  private readonly dictionaryApi = inject(DictionaryApiService);
  protected readonly folderService = inject(FolderService);
  private readonly safeTimeout = useSafeTimeout();
  private resetKeyInitialized = false;

  constructor() {
    effect(() => {
      this.resetKey();
      if (!this.resetKeyInitialized) {
        this.resetKeyInitialized = true;
        return;
      }
      this.resetForm(this.defaultFolderId());
      setTimeout(() => this.focusTermInput());
    });
  }

  readonly initialData = input<Partial<Word> | null>(null);
  readonly isEditMode = input<boolean>(false);
  readonly defaultFolderId = input<string | undefined>(undefined);
  readonly autoLookup = input<boolean>(false);
  readonly resetKey = input(0);
  readonly saved = output<WordFormData>();
  readonly deleted = output<void>();
  readonly cancelled = output<void>();

  protected readonly wordField = signal('');
  protected readonly pronunciation = signal('');
  protected readonly definition = signal('');
  protected readonly examples = signal<string[]>(['']);
  protected readonly selectedFolderId = signal<string | undefined>(undefined);
  protected readonly lookupLoading = signal(false);
  protected readonly lookupError = signal('');
  protected readonly lookupSuccess = signal(false);
  protected readonly lookupShake = signal(false);
  protected readonly highlightedFields = signal<Set<string>>(new Set());
  protected readonly availableMeanings = signal<DefinitionMeaning[]>([]);
  protected readonly definitionPickerOpen = signal(false);
  protected readonly definitionsFound = computed(() => this.availableMeanings().length);
  protected readonly definitionInvalid = computed(() => {
    const def = this.definition();
    return def.trim().length > 0 && isPlaceholderDefinition(def);
  });

  protected readonly addedDefinitions = computed(() =>
    parseDefinition(this.definition()).meanings.map((m) => m.text),
  );

  protected readonly addedExamples = computed(() =>
    this.examples().filter((e) => e.trim().length > 0),
  );

  private readonly termInputRef = viewChild<ElementRef<HTMLInputElement>>('termInput');

  protected readonly isIncomplete = computed(() => !!this.initialData()?.incomplete);
  protected readonly folders = this.folderService.folders;
  protected readonly folderWordCounts = this.folderService.folderWordCounts;
  protected readonly folderPickerOpen = signal(false);
  protected readonly selectedFolder = computed<Folder | null>(() => {
    const id = this.selectedFolderId();
    if (!id) return null;
    return this.folders().find((f) => f.id === id) ?? null;
  });

  ngOnInit(): void {
    const data = this.initialData();
    if (data) {
      this.wordField.set(data.word ?? '');
      this.pronunciation.set(data.pronunciation ?? '');
      this.definition.set(data.definition ?? '');
      this.examples.set(data.examples?.length ? [...data.examples] : ['']);
      this.selectedFolderId.set(data.folderId);
    } else if (this.defaultFolderId()) {
      this.selectedFolderId.set(this.defaultFolderId());
    }
    if (this.autoLookup() && this.wordField().trim()) {
      this.onLookup();
    }
  }

  resetForm(defaultFolderId?: string): void {
    this.wordField.set('');
    this.pronunciation.set('');
    this.definition.set('');
    this.examples.set(['']);
    this.selectedFolderId.set(defaultFolderId);
    this.lookupLoading.set(false);
    this.lookupError.set('');
    this.lookupSuccess.set(false);
    this.lookupShake.set(false);
    this.highlightedFields.set(new Set());
    this.availableMeanings.set([]);
    this.definitionPickerOpen.set(false);
  }

  focusTermInput(): void {
    this.termInputRef()?.nativeElement.focus();
  }

  protected async onLookup(): Promise<void> {
    // Second click — open picker from cached meanings (per D-11/D-12)
    if (this.availableMeanings().length > 0) {
      this.definitionPickerOpen.set(true);
      return;
    }

    this.lookupLoading.set(true);
    this.lookupError.set('');

    try {
      const result = await this.dictionaryApi.lookupWord(this.wordField());
      this.pronunciation.set(result.pronunciation);
      this.definition.set(result.definition);
      const currentExamples = this.examples().filter((e) => e.trim().length > 0);
      const merged = [...currentExamples, ...result.examples];
      this.examples.set(merged.length > 0 ? merged : ['']);
      this.highlightedFields.set(
        new Set(['pronunciation', 'definition', 'examples']),
      );
      this.lookupSuccess.set(true);
      this.safeTimeout(() => {
        this.highlightedFields.set(new Set());
      }, 2000);

      // Store all meanings for picker (per D-04/D-10)
      if (result.allMeanings?.length) {
        this.availableMeanings.set(result.allMeanings);
      }
    } catch (error) {
      this.lookupError.set(
        error instanceof Error ? error.message : 'Lookup failed',
      );
      this.lookupShake.set(true);
    } finally {
      this.lookupLoading.set(false);
    }
  }

  protected isHighlighted(field: string): boolean {
    return this.highlightedFields().has(field);
  }

  protected resetShake(): void {
    this.lookupShake.set(false);
  }

  protected resetSuccess(): void {
    this.lookupSuccess.set(false);
  }

  protected addExample(): void {
    this.examples.update((ex) => [...ex, '']);
  }

  protected removeExample(index: number): void {
    this.examples.update((ex) => ex.filter((_, i) => i !== index));
  }

  protected updateExample(index: number, value: string): void {
    this.examples.update((ex) => ex.map((e, i) => (i === index ? value : e)));
  }

  protected onSave(): void {
    const def = this.definition().trim();
    if (!this.wordField().trim() || !def || isPlaceholderDefinition(def)) return;

    const idx = this.initialData()?.quizMeaningIndex;
    const count = parseDefinition(def).meanings.length;
    const quizMeaningIndex =
      this.isEditMode() && idx != null && count > 0
        ? Math.min(idx, count - 1)
        : undefined;

    this.saved.emit({
      word: this.wordField().trim(),
      pronunciation: this.pronunciation().trim(),
      definition: this.definition().trim(),
      examples: this.examples().filter((e) => e.trim().length > 0),
      folderId: this.selectedFolderId(),
      ...(quizMeaningIndex !== undefined ? { quizMeaningIndex } : {}),
    });
  }

  protected onDefinitionAppended(event: { definition: string; pronunciation: string }): void {
    const existing = new Set(
      parseDefinition(this.definition()).meanings.map((m) => m.text.trim().toLowerCase()),
    );
    if (existing.has(event.definition.trim().toLowerCase())) return;

    const current = this.definition().trim();
    const separator = current ? ' · ' : '';
    this.definition.set(current + separator + event.definition);
    this.highlightedFields.set(new Set(['definition']));
    this.safeTimeout(() => this.highlightedFields.set(new Set()), 2000);
  }

  protected onDefinitionRemoved(event: { definition: string }): void {
    this.definition.set(removeMeaning(this.definition(), event.definition));
    this.highlightedFields.set(new Set(['definition']));
    this.safeTimeout(() => this.highlightedFields.set(new Set()), 2000);
  }

  protected onExampleAppended(example: string): void {
    const current = this.examples().filter((e) => e.trim().length > 0);
    const target = example.trim().toLowerCase();
    if (current.some((e) => e.trim().toLowerCase() === target)) return;
    this.examples.set([...current, example]);
    this.highlightedFields.set(new Set(['examples']));
    this.safeTimeout(() => this.highlightedFields.set(new Set()), 2000);
  }

  protected onExampleRemoved(text: string): void {
    const target = text.trim().toLowerCase();
    const next = this.examples().filter((e) => e.trim().toLowerCase() !== target);
    this.examples.set(next.length ? next : ['']);
    this.highlightedFields.set(new Set(['examples']));
    this.safeTimeout(() => this.highlightedFields.set(new Set()), 2000);
  }

  protected onDelete(): void {
    this.deleted.emit();
  }

  protected onFolderSelected(folderId: string): void {
    this.selectedFolderId.set(folderId || undefined);
    this.folderPickerOpen.set(false);
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
