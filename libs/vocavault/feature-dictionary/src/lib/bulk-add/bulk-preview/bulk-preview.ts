import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { BulkImportService, ParsedRow } from '@vocavault/data-access';
import { BulkPreviewRow } from './bulk-preview-row';

@Component({
  selector: 'lib-bulk-preview',
  imports: [BulkPreviewRow],
  templateUrl: './bulk-preview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkPreview {
  protected readonly bulkService = inject(BulkImportService);

  protected readonly expandedRowId = signal<string | null>(null);

  protected readonly rows = this.bulkService.rows;
  protected readonly readyCount = this.bulkService.readyCount;
  protected readonly amberCount = this.bulkService.amberCount;
  protected readonly redCount = this.bulkService.redCount;
  protected readonly lookupProgress = this.bulkService.lookupProgress;
  protected readonly currentLookupWord = this.bulkService.currentLookupWord;
  protected readonly wordsOnlyMode = this.bulkService.wordsOnlyMode;
  protected readonly lastLookupResult = this.bulkService.lastLookupResult;
  protected readonly lookupResults = this.bulkService.lookupResults;
  protected readonly retryRound = this.bulkService.retryRound;
  protected readonly retryCountdown = this.bulkService.retryCountdown;
  protected readonly retriableCount = this.bulkService.retriableCount;
  protected readonly lookupServiceError = this.bulkService.lookupServiceError;
  protected readonly isRetrying = computed(() => this.retryRound() > 0 && this.retryCountdown() > 0);

  protected readonly guidanceMessage = computed(() => {
    const total = this.rows().length;
    if (total === 0) return '';
    const ready = this.readyCount();
    const amber = this.amberCount();
    const red = this.redCount();
    if (red > 0) return `${red} word${red !== 1 ? 's' : ''} already exist in your dictionary. Decide what to do with each one below.`;
    if (amber === total) return 'None of your words have definitions yet. Start with \'Auto look up\' or add them one by one.';
    if (amber > 0 && ready > 0) return `${amber} word${amber !== 1 ? 's' : ''} need definitions. Use 'Auto look up' or edit them manually below.`;
    if (ready === total) return `Everything looks good! Hit 'Add ${total} Word${total !== 1 ? 's' : ''}' to import.`;
    return '';
  });

  protected readonly attentionRows = computed(() =>
    this.bulkService.rows().filter(
      (r) => r.status === 'missing-def' || r.status === 'duplicate'
    )
  );
  protected readonly readyRows = computed(() =>
    this.bulkService.rows().filter(
      (r) => r.status === 'ok'
    )
  );

  protected readonly attentionExpanded = signal(true);
  protected readonly readyExpanded = signal(true);
  // Show first 3 rows, expand on demand
  protected readonly attentionShowAll = signal(false);
  protected readonly readyShowAll = signal(false);
  private static readonly PREVIEW_LIMIT = 3;

  protected readonly visibleAttentionRows = computed(() => {
    const rows = this.attentionRows();
    return this.attentionShowAll() ? rows : rows.slice(0, BulkPreview.PREVIEW_LIMIT);
  });
  protected readonly visibleReadyRows = computed(() => {
    const rows = this.readyRows();
    return this.readyShowAll() ? rows : rows.slice(0, BulkPreview.PREVIEW_LIMIT);
  });
  protected readonly hiddenAttentionCount = computed(() =>
    Math.max(0, this.attentionRows().length - BulkPreview.PREVIEW_LIMIT)
  );
  protected readonly hiddenReadyCount = computed(() =>
    Math.max(0, this.readyRows().length - BulkPreview.PREVIEW_LIMIT)
  );

  // Lookup progress percentage
  protected readonly lookupProgressPercent = computed(() => {
    const p = this.lookupProgress();
    if (!p || p.total === 0) return 0;
    return Math.round((p.current / p.total) * 100);
  });

  protected trackRow(_: number, row: ParsedRow): string {
    return row.id;
  }

  protected async onLookupAll(): Promise<void> {
    await this.bulkService.lookupAll();
  }

  protected onAbortLookup(): void {
    this.bulkService.abortLookup();
  }

  protected onSkipAllDuplicates(): void {
    this.bulkService.skipAllDuplicates();
    this.bulkService.saveDraft();
  }

}
