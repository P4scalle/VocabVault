import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { BulkImportService, ParsedRow } from '@vocavault/data-access';

@Component({
  selector: 'lib-bulk-preview-row',
  imports: [],
  templateUrl: './bulk-preview-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkPreviewRow {
  private readonly bulkService = inject(BulkImportService);
  private readonly el = inject(ElementRef);
  private readonly injector = inject(Injector);

  readonly row = input.required<ParsedRow>();
  readonly expanded = input(false);
  readonly expand = output<void>();

  protected readonly lookingUp = signal(false);

  // Inline edit signals (populated on expand)
  protected readonly editWord = signal('');
  protected readonly editDefinition = signal('');
  protected readonly editPronunciation = signal('');
  protected readonly editExamples = signal<string[]>([]);

  // Computed: effective status considering wordsOnly mode and duplicate resolution
  protected readonly effectiveStatus = computed(() => {
    const r = this.row();
    if (r.status === 'duplicate' && r.duplicateAction === 'skip') return 'skipped';
    if (
      r.status === 'duplicate' &&
      (r.duplicateAction === 'keep' || r.duplicateAction === 'merge')
    )
      return 'resolved';
    if (r.status === 'missing-def' && this.bulkService.wordsOnlyMode()) return 'words-only';
    return r.status;
  });

  // Status badge configuration
  protected readonly badgeConfig = computed(() => {
    const s = this.effectiveStatus();
    switch (s) {
      case 'ok':
        return {
          label: 'Ready',
          classes: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
          borderClass: 'border-green-500',
          dotClass: 'bg-green-500',
        };
      case 'missing-def':
        return {
          label: 'No definition',
          classes: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
          borderClass: 'border-amber-400',
          dotClass: 'bg-amber-400',
        };
      case 'duplicate':
        return {
          label: 'Already in dictionary',
          classes: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
          borderClass: 'border-red-400',
          dotClass: 'bg-red-400',
        };
      case 'skipped':
        return {
          label: 'Skipped',
          classes: 'bg-slate-100 dark:bg-slate-700 text-slate-400',
          borderClass: 'border-slate-300',
          dotClass: 'bg-slate-300',
        };
      case 'resolved':
        return {
          label: 'Ready',
          classes: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
          borderClass: 'border-green-500',
          dotClass: 'bg-green-500',
        };
      case 'words-only':
        return {
          label: 'Will look up',
          classes: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
          borderClass: 'border-blue-400',
          dotClass: 'bg-blue-400',
        };
      default:
        return { label: '', classes: '', borderClass: '', dotClass: '' };
    }
  });

  protected onExpand(): void {
    const wasCollapsed = !this.expanded();
    if (wasCollapsed) {
      // Populate edit fields from current row data
      const r = this.row();
      this.editWord.set(r.word);
      this.editDefinition.set(r.definition);
      this.editPronunciation.set(r.pronunciation);
      this.editExamples.set([...r.examples]);
    }
    this.expand.emit();
    if (wasCollapsed) {
      afterNextRender(() => {
        this.el.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, { injector: this.injector });
    }
  }

  protected addExample(): void {
    this.editExamples.update(ex => [...ex, '']);
  }

  protected updateExample(index: number, value: string): void {
    this.editExamples.update(ex => ex.map((e, i) => i === index ? value : e));
  }

  protected removeExample(index: number): void {
    this.editExamples.update(ex => ex.filter((_, i) => i !== index));
  }

  protected onSaveEdit(): void {
    this.bulkService.updateRow(this.row().id, {
      word: this.editWord(),
      definition: this.editDefinition(),
      pronunciation: this.editPronunciation(),
      examples: this.editExamples().filter(e => e.trim()),
    });
    this.bulkService.saveDraft();
    this.expand.emit(); // collapse
  }

  protected onDiscardEdit(): void {
    this.expand.emit(); // collapse without saving
  }

  protected async onLookupOne(): Promise<void> {
    this.lookingUp.set(true);
    await this.bulkService.lookupOne(this.row().id);
    this.lookingUp.set(false);
    this.bulkService.saveDraft();
  }

  protected onResolveDuplicate(action: 'keep' | 'skip' | 'merge'): void {
    this.bulkService.resolveDuplicate(this.row().id, action);
    this.bulkService.saveDraft();
  }

  protected readonly duplicateActions: Array<{ value: 'skip' | 'keep' | 'merge'; label: string }> =
    [
      { value: 'skip', label: 'Skip' },
      { value: 'keep', label: 'Keep both' },
      { value: 'merge', label: 'Merge' },
    ];
}
