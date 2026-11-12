import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { BulkImportService, DetectedDelimiter } from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';

@Component({
  selector: 'lib-bulk-input',
  imports: [],
  templateUrl: './bulk-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkInput {
  protected readonly bulkService = inject(BulkImportService);
  private readonly toast = inject(ToastService);

  // Initialize from service's lastInputText so "Back to editing" restores content
  protected readonly rawText = signal(inject(BulkImportService).lastInputText());
  protected readonly overrideDelimiter = signal<DetectedDelimiter | null>(null);
  protected readonly dragOver = signal(false);
  private parseTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  protected readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');

  protected readonly wordCount = computed(() => this.bulkService.rows().length);
  protected readonly defCount = computed(() => this.bulkService.rows().filter(r => r.status === 'ok').length);
  protected readonly delimiter = this.bulkService.detectedDelimiter;
  protected readonly wordsOnly = this.bulkService.wordsOnlyMode;
  protected readonly mixedSeparators = this.bulkService.mixedSeparators;
  // The active delimiter: override if set, otherwise auto-detected
  protected readonly activeDelimiter = computed(() => this.overrideDelimiter() ?? this.delimiter());

  private readonly delimiterLabels: Record<string, string> = {
    dash: 'dash (-)',
    colon: 'colon (:)',
    equals: 'equals (=)',
    semicolon: 'semicolon (;)',
    tab: 'tab',
    comma: 'comma (,)',
  };

  protected readonly mixedSeparatorWarning = computed(() => {
    const mixed = this.mixedSeparators();
    if (mixed.length === 0) return '';
    const primary = this.delimiter();
    const primaryName = this.delimiterLabels[primary as string] ?? primary;
    const otherNames = mixed.map(s => this.delimiterLabels[s] ?? s).join(', ');
    return `We're using ${primaryName} as the separator, but some lines use ${otherNames}. Those definitions may be lost. Use one separator consistently, or click a chip above to re-parse.`;
  });

  protected readonly delimiterOptions: { value: DetectedDelimiter; label: string }[] = [
    { value: 'tab', label: 'Tab' },
    { value: 'dash', label: 'Dash (-)' },
    { value: 'colon', label: 'Colon (:)' },
    { value: 'comma', label: 'Comma (,)' },
    { value: 'equals', label: 'Equals (=)' },
    { value: 'semicolon', label: 'Semicolon (;)' },
  ];

  protected onTextInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.rawText.set(value);
    // Immediately sync to service so "Back to editing" always restores latest text
    this.bulkService.lastInputText.set(value);
    // Clear any stale delimiter override when user changes input
    this.overrideDelimiter.set(null);
    if (this.parseTimer !== null) clearTimeout(this.parseTimer);
    this.parseTimer = setTimeout(() => {
      this.bulkService.parseText(value);
      this.bulkService.saveDraft();
      this.parseTimer = null;
    }, 150);
  }

  protected onDelimiterSelect(delim: DetectedDelimiter): void {
    if (this.activeDelimiter() === delim) {
      // Clicking the active one clears the override → re-auto-detect
      this.overrideDelimiter.set(null);
      this.bulkService.parseText(this.rawText());
    } else {
      this.overrideDelimiter.set(delim);
      this.bulkService.parseText(this.rawText(), delim);
    }
  }

  protected toggleWordsOnly(): void {
    this.bulkService.toggleWordsOnlyMode();
    this.bulkService.parseText(this.rawText(), this.overrideDelimiter() ?? undefined);
  }

  protected async onPasteClick(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      this.rawText.set(text);
      this.bulkService.lastInputText.set(text);
      this.overrideDelimiter.set(null);
      const ta = this.textareaRef()?.nativeElement;
      if (ta) ta.value = text;
      this.bulkService.parseText(text);
      this.bulkService.saveDraft();
    } catch {
      this.textareaRef()?.nativeElement.focus();
      this.toast.show('Tap the text area and use long-press to paste', 'info');
    }
  }

  protected onFileUploadClick(): void {
    this.fileInputRef()?.nativeElement.click();
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const result = await this.bulkService.parseFile(file);
    if (!result.ok) {
      this.toast.show(result.error ?? 'Unknown error', 'error');
    } else {
      this.bulkService.saveDraft();
    }
    const input = this.fileInputRef()?.nativeElement;
    if (input) input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  protected async onFileDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (!file) {
      this.toast.show('Please drag a file from your computer, not a web link. Or use "Upload file" to pick a file.', 'info');
      return;
    }
    const result = await this.bulkService.parseFile(file);
    if (!result.ok) {
      this.toast.show(result.error ?? 'Unknown error', 'error');
    } else {
      this.bulkService.saveDraft();
    }
  }
}
