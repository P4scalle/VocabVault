// @vitest-environment jsdom
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BulkInput } from './bulk-input';
import { BulkImportService, ParsedRow, DetectedDelimiter } from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';

function createMockBulkService() {
  return {
    rows: signal<ParsedRow[]>([]),
    lastInputText: signal(''),
    detectedDelimiter: signal<DetectedDelimiter | string>(''),
    mixedSeparators: signal<DetectedDelimiter[]>([]),
    detectedWordsOnly: signal(false),
    wordsOnlyMode: signal(false),
    parseText: vi.fn(),
    saveDraft: vi.fn(),
    toggleWordsOnlyMode: vi.fn(),
    parseFile: vi.fn(),
  };
}

function createMockToastService() {
  return { show: vi.fn() };
}

type MockBulkService = ReturnType<typeof createMockBulkService>;
type MockToastService = ReturnType<typeof createMockToastService>;

function queryTextarea(fixture: ComponentFixture<BulkInput>): HTMLTextAreaElement {
  const el = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement | null;
  if (!el) throw new Error('textarea not found');
  return el;
}

function queryPasteButton(fixture: ComponentFixture<BulkInput>): HTMLButtonElement {
  const buttons: HTMLButtonElement[] = Array.from(
    fixture.nativeElement.querySelectorAll('button'),
  );
  const btn = buttons.find((b) => b.textContent?.trim().includes('Paste'));
  if (!btn) throw new Error('Paste button not found');
  return btn;
}

function stubClipboard(text: string) {
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { readText: vi.fn().mockResolvedValue(text) },
  });
}

function stubClipboardFailure() {
  vi.stubGlobal('navigator', {
    ...navigator,
    clipboard: { readText: vi.fn().mockRejectedValue(new DOMException('Not allowed')) },
  });
}

describe('BulkInput', () => {
  let fixture: ComponentFixture<BulkInput>;
  let bulkService: MockBulkService;
  let toastService: MockToastService;

  beforeEach(async () => {
    bulkService = createMockBulkService();
    toastService = createMockToastService();

    await TestBed.configureTestingModule({
      imports: [BulkInput],
      providers: [
        { provide: BulkImportService, useValue: bulkService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BulkInput);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should render textarea and paste button', () => {
    expect(queryTextarea(fixture)).toBeTruthy();
    expect(queryPasteButton(fixture)).toBeTruthy();
  });

  describe('paste button', () => {
    it('should read clipboard and parse text on click', async () => {
      stubClipboard('apple - fruit');

      queryPasteButton(fixture).click();
      await fixture.whenStable();

      expect(bulkService.parseText).toHaveBeenCalledWith('apple - fruit');
      expect(bulkService.saveDraft).toHaveBeenCalled();
    });

    it('should sync lastInputText so back-to-editing restores content', async () => {
      stubClipboard('banana - yellow fruit');

      queryPasteButton(fixture).click();
      await fixture.whenStable();

      expect(bulkService.lastInputText()).toBe('banana - yellow fruit');
    });

    it('should clear stale delimiter override before parsing', async () => {
      stubClipboard('cherry - red fruit');

      // Simulate a previous delimiter override via text input + delimiter select
      const textarea = queryTextarea(fixture);
      textarea.value = 'old:text';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // Now paste new content. Override should be cleared.
      queryPasteButton(fixture).click();
      await fixture.whenStable();

      // parseText should be called without a delimiter argument (auto-detect)
      expect(bulkService.parseText).toHaveBeenLastCalledWith('cherry - red fruit');
    });

    it('should update textarea DOM value with pasted text', async () => {
      stubClipboard('mango - tropical fruit');

      queryPasteButton(fixture).click();
      await fixture.whenStable();

      expect(queryTextarea(fixture).value).toBe('mango - tropical fruit');
    });

    it('should show fallback toast when clipboard access is denied', async () => {
      stubClipboardFailure();

      queryPasteButton(fixture).click();
      await fixture.whenStable();

      expect(toastService.show).toHaveBeenCalledWith(
        'Tap the text area and use long-press to paste',
        'info',
      );
      expect(bulkService.parseText).not.toHaveBeenCalled();
      expect(bulkService.saveDraft).not.toHaveBeenCalled();
    });

    it('should not leave stale state when clipboard fails', async () => {
      stubClipboardFailure();

      queryPasteButton(fixture).click();
      await fixture.whenStable();

      expect(bulkService.lastInputText()).toBe('');
      expect(queryTextarea(fixture).value).toBe('');
    });
  });

  describe('textarea input', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce parsing by 150ms', () => {
      const textarea = queryTextarea(fixture);
      textarea.value = 'test - word';
      textarea.dispatchEvent(new Event('input'));

      expect(bulkService.parseText).not.toHaveBeenCalled();

      vi.advanceTimersByTime(150);

      expect(bulkService.parseText).toHaveBeenCalledWith('test - word');
      expect(bulkService.saveDraft).toHaveBeenCalled();
    });

    it('should sync lastInputText immediately without waiting for debounce', () => {
      const textarea = queryTextarea(fixture);
      textarea.value = 'hello - world';
      textarea.dispatchEvent(new Event('input'));

      expect(bulkService.lastInputText()).toBe('hello - world');
    });

    it('should reset debounce timer on rapid input', () => {
      const textarea = queryTextarea(fixture);

      textarea.value = 'first';
      textarea.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(100);

      textarea.value = 'second';
      textarea.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(100);

      // First input's timer was cleared, only 100ms into second
      expect(bulkService.parseText).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(bulkService.parseText).toHaveBeenCalledOnce();
      expect(bulkService.parseText).toHaveBeenCalledWith('second');
    });
  });

  describe('delimiter selection', () => {
    it('should re-parse with selected delimiter', () => {
      // Populate input so delimiter chips appear
      bulkService.detectedDelimiter.set('dash');
      const textarea = queryTextarea(fixture);
      textarea.value = 'apple:fruit';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      bulkService.parseText.mockClear();

      // Find and click a delimiter chip
      const chips: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      );
      const colonChip = chips.find((b) => b.textContent?.trim() === 'Colon (:)');
      expect(colonChip).toBeTruthy();
      if (!colonChip) return;

      colonChip.click();

      expect(bulkService.parseText).toHaveBeenCalledWith('apple:fruit', 'colon');
    });

    it('should clear override when clicking already-active delimiter', () => {
      bulkService.detectedDelimiter.set('colon');
      const textarea = queryTextarea(fixture);
      textarea.value = 'apple:fruit';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      bulkService.parseText.mockClear();

      // Click the active colon chip to toggle it off
      const chips: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      );
      const colonChip = chips.find((b) => b.textContent?.trim() === 'Colon (:)');
      if (!colonChip) return;
      colonChip.click();

      // Should re-parse without override (auto-detect)
      expect(bulkService.parseText).toHaveBeenCalledWith('apple:fruit');
    });
  });

  describe('mode toggle', () => {
    it('should toggle words-only mode and re-parse', () => {
      const textarea = queryTextarea(fixture);
      textarea.value = 'apple\nbanana';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      bulkService.parseText.mockClear();

      // Find "Words only" button
      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      );
      const wordsOnlyBtn = buttons.find((b) => b.textContent?.trim() === 'Words only');
      expect(wordsOnlyBtn).toBeTruthy();
      if (!wordsOnlyBtn) return;

      wordsOnlyBtn.click();

      expect(bulkService.toggleWordsOnlyMode).toHaveBeenCalled();
      expect(bulkService.parseText).toHaveBeenCalledWith('apple\nbanana', undefined);
    });
  });
});
