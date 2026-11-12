import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BulkImportService, ParsedRow } from '@vocavault/data-access';
import { BulkPreview } from './bulk-preview';

function makeMockBulkService() {
  return {
    rows: signal<ParsedRow[]>([]),
    readyCount: signal(0),
    amberCount: signal(0),
    redCount: signal(0),
    importableCount: signal(0),
    lookupProgress: signal<{ current: number; total: number } | null>(null),
    currentLookupWord: signal(''),
    wordsOnlyMode: signal(false),
    lastLookupResult: signal<{ found: number; notFound: number } | null>(null),
    lookupResults: signal<Array<{ word: string; found: boolean }>>([]),
    retryRound: signal(0),
    retryCountdown: signal(0),
    retriableCount: signal(0),
    lookupServiceError: signal(false),
    lookupAll: vi.fn().mockResolvedValue({ found: 0, notFound: 0 }),
    abortLookup: vi.fn(),
    skipAllDuplicates: vi.fn(),
    saveDraft: vi.fn(),
  };
}

type MockBulkService = ReturnType<typeof makeMockBulkService>;

function makeRow(overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    id: crypto.randomUUID(),
    word: 'apple',
    definition: '',
    pronunciation: '',
    examples: [],
    status: 'missing-def',
    ...overrides,
  };
}

describe('BulkPreview', () => {
  let fixture: ComponentFixture<BulkPreview>;
  let mockService: MockBulkService;

  beforeEach(async () => {
    mockService = makeMockBulkService();

    await TestBed.configureTestingModule({
      imports: [BulkPreview],
      providers: [
        { provide: BulkImportService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BulkPreview);
  });

  function render() {
    fixture.detectChanges();
  }

  function queryText(selector: string): string {
    const el = fixture.nativeElement.querySelector(selector) as HTMLElement | null;
    return el?.textContent?.trim() ?? '';
  }

  function queryEl(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  // ── Summary bar ──

  describe('summary bar', () => {
    it('should show ready, amber, and red counts', () => {
      mockService.readyCount.set(5);
      mockService.amberCount.set(3);
      mockService.redCount.set(2);
      mockService.rows.set([makeRow({ status: 'ok' })]);
      render();

      expect(queryText('.text-green-600')).toContain('5 ready');
      expect(queryText('.text-amber-600')).toContain('3 need definitions');
      expect(queryText('.text-red-600')).toContain('2 duplicates');
    });
  });

  // ── Lookup service error banner ──

  describe('lookup service error banner', () => {
    it('should show amber error banner when lookupServiceError is true', () => {
      mockService.lookupServiceError.set(true);
      mockService.rows.set([makeRow()]);
      render();

      const banner = queryEl('.pi-exclamation-triangle');
      expect(banner).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain(
        'Dictionary service temporarily unavailable',
      );
    });

    it('should NOT show error banner when lookupServiceError is false', () => {
      mockService.lookupServiceError.set(false);
      mockService.rows.set([makeRow()]);
      render();

      expect(fixture.nativeElement.textContent).not.toContain(
        'Dictionary service temporarily unavailable',
      );
    });
  });

  // ── Post-lookup result summary ──

  describe('post-lookup result summary', () => {
    it('should show green summary with found/notFound counts after lookup', () => {
      mockService.lastLookupResult.set({ found: 8, notFound: 2 });
      mockService.lookupProgress.set(null);
      mockService.rows.set([makeRow()]);
      render();

      const summary = fixture.nativeElement.textContent;
      expect(summary).toContain('Found 8 of 10 definitions');
      expect(summary).toContain('2 words need manual entry');
    });

    it('should show only found count when all words found', () => {
      mockService.lastLookupResult.set({ found: 5, notFound: 0 });
      mockService.lookupProgress.set(null);
      mockService.rows.set([makeRow()]);
      render();

      const summary = fixture.nativeElement.textContent;
      expect(summary).toContain('Found 5 of 5 definitions');
      expect(summary).not.toContain('need manual entry');
    });

    it('should NOT show summary while lookup is in progress', () => {
      mockService.lastLookupResult.set({ found: 3, notFound: 1 });
      mockService.lookupProgress.set({ current: 2, total: 5 });
      mockService.rows.set([makeRow()]);
      mockService.amberCount.set(1);
      render();

      const summaryBanner = queryEl('.pi-check-circle.text-green-500');
      expect(summaryBanner).toBeFalsy();
    });
  });

  // ── Lookup progress ──

  describe('lookup progress', () => {
    it('should show progress bar during lookup', () => {
      mockService.lookupProgress.set({ current: 3, total: 10 });
      mockService.amberCount.set(1);
      mockService.rows.set([makeRow()]);
      render();

      expect(fixture.nativeElement.textContent).toContain('Looking up 3 of 10');
    });

    it('should show Stop button during lookup', () => {
      mockService.lookupProgress.set({ current: 1, total: 5 });
      mockService.amberCount.set(1);
      mockService.rows.set([makeRow()]);
      render();

      const stopBtn = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent?.includes('Stop'));
      expect(stopBtn).toBeTruthy();
    });
  });

  // ── Retry countdown ──

  describe('retry countdown', () => {
    it('should show retry countdown banner when retrying', () => {
      mockService.retryRound.set(1);
      mockService.retryCountdown.set(5);
      mockService.retriableCount.set(3);
      mockService.amberCount.set(1);
      mockService.lookupProgress.set({ current: 0, total: 3 });
      mockService.rows.set([makeRow()]);
      render();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Retrying 3 rate-limited words in 5s');
      expect(text).toContain('(round 1/3)');
    });

    it('should NOT show retry countdown when not retrying', () => {
      mockService.retryRound.set(0);
      mockService.retryCountdown.set(0);
      mockService.amberCount.set(1);
      mockService.rows.set([makeRow()]);
      render();

      expect(fixture.nativeElement.textContent).not.toContain('Retrying');
    });
  });

  // ── Per-word lookup results ──

  describe('per-word lookup results', () => {
    it('should show checkmarks for found words and X for not-found', () => {
      mockService.lookupResults.set([
        { word: 'apple', found: true },
        { word: 'xyzqwerty', found: false },
      ]);
      mockService.lookupProgress.set({ current: 2, total: 3 });
      mockService.amberCount.set(1);
      mockService.rows.set([makeRow()]);
      render();

      const text = fixture.nativeElement.textContent;
      expect(text).toContain('✓ apple');
      expect(text).toContain('✗ xyzqwerty');
    });

    it('should show pulsing indicator for word currently being looked up', () => {
      mockService.currentLookupWord.set('banana');
      mockService.lookupResults.set([{ word: 'apple', found: true }]);
      mockService.lookupProgress.set({ current: 1, total: 3 });
      mockService.amberCount.set(1);
      mockService.rows.set([makeRow()]);
      render();

      const pulsingEl = queryEl('.animate-pulse');
      expect(pulsingEl).toBeTruthy();
      expect(pulsingEl?.textContent).toContain('banana');
    });
  });

  // ── Empty state ──

  describe('empty state', () => {
    it('should show empty state when no rows', () => {
      mockService.rows.set([]);
      render();

      expect(fixture.nativeElement.textContent).toContain('No words to review');
    });
  });

  // ── Auto look up card ──

  describe('auto look up card', () => {
    it('should show auto look up card when amber rows exist', () => {
      mockService.amberCount.set(5);
      mockService.rows.set([makeRow()]);
      render();

      expect(fixture.nativeElement.textContent).toContain('5 words need definitions');
      expect(fixture.nativeElement.textContent).toContain('Auto look up 5');
    });

    it('should NOT show auto look up card when no amber rows', () => {
      mockService.amberCount.set(0);
      mockService.rows.set([makeRow({ status: 'ok', definition: 'a fruit' })]);
      render();

      expect(fixture.nativeElement.textContent).not.toContain('Auto look up');
    });
  });
});
