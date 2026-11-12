// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { BulkImportService } from './bulk-import.service';
import { WordService } from './word.service';
import { DictionaryApiService, RateLimitError } from './dictionary-api.service';
import { signal, WritableSignal } from '@angular/core';
import { Word, MasteryLevel, SR_DEFAULTS } from './models';
import { MockedFunction } from 'vitest';

const makeWord = (word: string, id = crypto.randomUUID()): Word => ({
  id,
  word,
  pronunciation: '',
  definition: 'some definition',
  examples: [],
  masteryLevel: MasteryLevel.New,
  createdAt: new Date(),
  updatedAt: new Date(),
  interval: SR_DEFAULTS.interval,
  easeFactor: SR_DEFAULTS.easeFactor,
  reviewCount: SR_DEFAULTS.reviewCount,
});

describe('BulkImportService', () => {
  let service: BulkImportService;
  let wordServiceMock: Partial<WordService>;
  let dictApiMock: Partial<DictionaryApiService>;
  let wordsSignal: WritableSignal<Word[]>;
  let lookupWordMock: MockedFunction<DictionaryApiService['lookupWord']>;

  beforeEach(() => {
    sessionStorage.clear();

    wordsSignal = signal<Word[]>([]);
    wordServiceMock = {
      words: wordsSignal,
    };

    lookupWordMock = vi.fn();
    dictApiMock = {
      lookupWord: lookupWordMock,
    };

    TestBed.configureTestingModule({
      providers: [
        BulkImportService,
        { provide: WordService, useValue: wordServiceMock },
        { provide: DictionaryApiService, useValue: dictApiMock },
      ],
    });
    service = TestBed.inject(BulkImportService);
  });

  describe('parseText', () => {
    it('should parse tab-separated text into rows', () => {
      service.parseText('apple\ta fruit\nbanana\tyellow');
      expect(service.rows().length).toBe(2);
      expect(service.rows()[0].word).toBe('apple');
      expect(service.rows()[0].definition).toBe('a fruit');
      expect(service.rows()[0].status).toBe('ok');
    });

    it('should parse dash-separated text into rows', () => {
      service.parseText('apple - a fruit\nbanana - yellow fruit');
      expect(service.rows().length).toBe(2);
      expect(service.rows()[0].word).toBe('apple');
      expect(service.rows()[0].definition).toBe('a fruit');
    });

    it('should parse colon-separated text', () => {
      service.parseText('apple: a fruit\nbanana: yellow fruit');
      expect(service.rows().length).toBe(2);
      expect(service.rows()[0].word).toBe('apple');
      expect(service.rows()[0].definition).toBe('a fruit');
    });

    it('should mark rows without definition as missing-def', () => {
      service.parseText('apple\nbanana');
      const rows = service.rows();
      expect(rows.every(r => r.status === 'missing-def')).toBe(true);
    });

    it('should set status ok for rows with definition', () => {
      service.parseText('apple - a fruit\nbanana - yellow');
      expect(service.rows().every(r => r.status === 'ok')).toBe(true);
    });

    it('should assign unique ids to each row', () => {
      service.parseText('apple - a fruit\nbanana - yellow');
      const rows = service.rows();
      expect(rows[0].id).not.toBe(rows[1].id);
    });

    it('should skip empty lines', () => {
      service.parseText('apple - a fruit\n\nbanana - yellow\n');
      expect(service.rows().length).toBe(2);
    });

    it('should detect dash delimiter from a single line', () => {
      service.parseText('banana - yellow fruit');
      expect(service.rows().length).toBe(1);
      expect(service.rows()[0].word).toBe('banana');
      expect(service.rows()[0].definition).toBe('yellow fruit');
      expect(service.rows()[0].status).toBe('ok');
      expect(service.detectedDelimiter()).toBe('dash');
    });

    it('should detect equals separator', () => {
      service.parseText('apple = a round fruit\nbanana = yellow fruit');
      expect(service.rows()[0].word).toBe('apple');
      expect(service.rows()[0].definition).toBe('a round fruit');
      expect(service.rows()[0].status).toBe('ok');
    });

    it('mixed input: dash lines + word-only line → word-only gets missing-def', () => {
      service.parseText('apple - a fruit\nbanana - yellow\ncherry');
      const rows = service.rows();
      expect(rows[0].status).toBe('ok');
      expect(rows[1].status).toBe('ok');
      expect(rows[2].status).toBe('missing-def');
    });
  });

  describe('detectDelimiter', () => {
    it('should detect tab delimiter', () => {
      service.parseText('apple\ta fruit\nbanana\tyellow');
      expect(service.detectedDelimiter()).toBe('\t');
    });

    it('should detect dash delimiter', () => {
      service.parseText('apple - a fruit\nbanana - yellow fruit');
      expect(service.detectedDelimiter()).not.toBe('');
    });

    it('should use override delimiter when provided', () => {
      service.parseText('apple,a fruit\nbanana,yellow', ',');
      expect(service.rows()[0].word).toBe('apple');
      expect(service.rows()[0].definition).toBe('a fruit');
    });
  });

  describe('mixedSeparators', () => {
    it('should be empty when all lines use the same separator', () => {
      service.parseText('apple - a fruit\nbanana - yellow fruit');
      expect(service.mixedSeparators()).toEqual([]);
    });

    it('should detect mixed separators when lines use different delimiters', () => {
      service.parseText('apple - a fruit\nbanana = yellow fruit');
      expect(service.mixedSeparators().length).toBeGreaterThan(0);
      expect(service.mixedSeparators()).toContain('equals');
    });

    it('should detect equals as mixed when primary is dash', () => {
      // dash is tested first in SMART_SEPARATORS, so it wins even with fewer matches
      service.parseText('apple - a fruit\nbanana = yellow fruit\ncherry = red fruit');
      expect(service.detectedDelimiter()).toBe('dash');
      expect(service.mixedSeparators()).toContain('equals');
    });

    it('should detect colon vs dash mixed input', () => {
      service.parseText('apple - a fruit\nbanana - yellow\ncherry: red fruit');
      expect(service.detectedDelimiter()).toBe('dash');
      expect(service.mixedSeparators()).toContain('colon');
    });

    it('should be empty when override delimiter is set', () => {
      service.parseText('apple - a fruit\nbanana = yellow fruit', 'dash');
      expect(service.mixedSeparators()).toEqual([]);
    });

    it('should be empty for consistent word-only input', () => {
      service.parseText('apple\nbanana\ncherry');
      expect(service.mixedSeparators()).toEqual([]);
    });

    it('should not flag word-only lines as mixed separators', () => {
      service.parseText('apple - a fruit\nbanana - yellow\ncherry');
      // "cherry" has no separator at all, so no mixed separator detected
      expect(service.mixedSeparators()).toEqual([]);
    });

    it('should reset on service reset', () => {
      service.parseText('apple - a fruit\nbanana = yellow fruit');
      expect(service.mixedSeparators().length).toBeGreaterThan(0);
      service.reset();
      expect(service.mixedSeparators()).toEqual([]);
    });
  });

  describe('wordsOnlyMode', () => {
    it('should NOT change underlying row status to ok when wordsOnlyMode is true — status stays missing-def', () => {
      // wordsOnlyMode only changes the visual display (effectiveStatus in the row component),
      // it does NOT promote the ParsedRow.status to 'ok'. Definitions are still required to import.
      service.wordsOnlyMode.set(true);
      service.parseText('apple\nbanana');
      expect(service.rows().every(r => r.status === 'missing-def')).toBe(true);
    });

    it('should mark rows as missing-def when wordsOnlyMode is false (default)', () => {
      service.wordsOnlyMode.set(false);
      service.parseText('apple\nbanana');
      expect(service.rows().every(r => r.status === 'missing-def')).toBe(true);
    });

    it('words-only mode with all missing-def rows → importableCount is 0', () => {
      service.wordsOnlyMode.set(true);
      service.parseText('apple\nbanana\ncherry');
      // wordsOnlyMode does NOT bypass the missing-def requirement for importability
      expect(service.importableCount()).toBe(0);
    });
  });

  describe('duplicate detection', () => {
    it('should mark rows as duplicate when word exists in dictionary (case-insensitive)', () => {
      wordsSignal.set([makeWord('Apple')]);
      service.parseText('apple - a fruit\nbanana - yellow');
      const rows = service.rows();
      expect(rows[0].status).toBe('duplicate');
      expect(rows[1].status).toBe('ok');
    });

    it('should set duplicateOf to existing word id for duplicates', () => {
      const existingId = 'existing-id-1';
      wordsSignal.set([makeWord('Apple', existingId)]);
      service.parseText('apple - a fruit');
      expect(service.rows()[0].duplicateOf).toBe(existingId);
    });

    it('should detect duplicate within same import batch', () => {
      service.parseText('apple - a fruit\nApple - different definition');
      const rows = service.rows();
      expect(rows[1].status).toBe('duplicate');
    });
  });

  describe('computed signals', () => {
    it('readyCount should count rows with status ok', () => {
      service.parseText('apple - a fruit\nbanana - yellow');
      expect(service.readyCount()).toBe(2);
    });

    it('amberCount should count rows with status missing-def', () => {
      service.parseText('apple\nbanana');
      expect(service.amberCount()).toBe(2);
    });

    it('redCount should count rows with status duplicate', () => {
      wordsSignal.set([makeWord('apple')]);
      service.parseText('apple - a fruit\nbanana - yellow');
      expect(service.redCount()).toBe(1);
    });

    it('importableCount should exclude skipped duplicates', () => {
      wordsSignal.set([makeWord('apple')]);
      service.parseText('apple - a fruit\nbanana - yellow');
      service.resolveDuplicate(service.rows()[0].id, 'skip');
      expect(service.importableCount()).toBe(1);
    });

    it('importableCount should include merge and keep duplicates', () => {
      wordsSignal.set([makeWord('apple'), makeWord('banana')]);
      service.parseText('apple - a fruit\nbanana - yellow\ncherry - red');
      service.resolveDuplicate(service.rows()[0].id, 'merge');
      service.resolveDuplicate(service.rows()[1].id, 'keep');
      expect(service.importableCount()).toBe(3);
    });

    it('importableCount: 3 ready + 2 missing-def → importableCount = 3', () => {
      service.parseText('apple - a fruit\nbanana - yellow\ncherry - red\nmango\npapaya');
      expect(service.readyCount()).toBe(3);
      expect(service.amberCount()).toBe(2);
      expect(service.importableCount()).toBe(3);
    });

    it('importableCount: all missing-def rows → importableCount = 0', () => {
      service.parseText('apple\nbanana\ncherry');
      expect(service.importableCount()).toBe(0);
    });

    it('importableCount: 1 ready + 1 skip-dup + 1 keep-dup → importableCount = 2', () => {
      wordsSignal.set([makeWord('apple'), makeWord('banana')]);
      service.parseText('apple - a fruit\nbanana - yellow\ncherry - red');
      service.resolveDuplicate(service.rows()[0].id, 'skip');
      service.resolveDuplicate(service.rows()[1].id, 'keep');
      // cherry (ok) + banana (keep) = 2; apple (skip) excluded
      expect(service.importableCount()).toBe(2);
    });
  });

  describe('updateRow', () => {
    it('should update specific row fields', () => {
      service.parseText('apple\nbanana - yellow');
      const rowId = service.rows()[0].id;
      service.updateRow(rowId, { definition: 'a fruit' });
      expect(service.rows()[0].definition).toBe('a fruit');
    });

    it('should update status to ok when definition is added to missing-def row', () => {
      service.parseText('apple');
      const rowId = service.rows()[0].id;
      service.updateRow(rowId, { definition: 'a fruit' });
      expect(service.rows()[0].status).toBe('ok');
    });

    it('should demote ok → missing-def when definition is cleared', () => {
      service.parseText('apple - a fruit');
      expect(service.rows()[0].status).toBe('ok');
      const rowId = service.rows()[0].id;
      service.updateRow(rowId, { definition: '' });
      expect(service.rows()[0].status).toBe('missing-def');
    });

    it('should demote ok → missing-def when definition is whitespace-only', () => {
      service.parseText('apple - a fruit');
      const rowId = service.rows()[0].id;
      service.updateRow(rowId, { definition: '   ' });
      expect(service.rows()[0].status).toBe('missing-def');
    });

    it('should persist examples array when updateRow is called with examples', () => {
      service.parseText('apple - a fruit');
      const rowId = service.rows()[0].id;
      const examples = ['She ate an apple', 'An apple a day'];
      service.updateRow(rowId, { examples });
      expect(service.rows()[0].examples).toEqual(examples);
      expect(service.rows()[0].examples.length).toBe(2);
    });

    it('should not alter status of ok row when updating examples only', () => {
      service.parseText('apple - a fruit');
      const rowId = service.rows()[0].id;
      service.updateRow(rowId, { examples: ['An apple'] });
      expect(service.rows()[0].status).toBe('ok');
    });
  });

  describe('resolveDuplicate', () => {
    it('should set duplicateAction to skip', () => {
      wordsSignal.set([makeWord('apple')]);
      service.parseText('apple - a fruit');
      const rowId = service.rows()[0].id;
      service.resolveDuplicate(rowId, 'skip');
      expect(service.rows()[0].duplicateAction).toBe('skip');
    });

    it('should set duplicateAction to merge and preserve duplicateOf', () => {
      const existingId = 'existing-id-2';
      wordsSignal.set([makeWord('apple', existingId)]);
      service.parseText('apple - a fruit');
      const rowId = service.rows()[0].id;
      service.resolveDuplicate(rowId, 'merge');
      expect(service.rows()[0].duplicateAction).toBe('merge');
      expect(service.rows()[0].duplicateOf).toBe(existingId);
    });

    it('should set duplicateAction to keep', () => {
      wordsSignal.set([makeWord('apple')]);
      service.parseText('apple - a fruit');
      const rowId = service.rows()[0].id;
      service.resolveDuplicate(rowId, 'keep');
      expect(service.rows()[0].duplicateAction).toBe('keep');
    });
  });

  describe('skipAllDuplicates', () => {
    it('should skip all duplicate rows', () => {
      wordsSignal.set([makeWord('apple'), makeWord('banana')]);
      service.parseText('apple - a fruit\nbanana - yellow\ncherry - red');
      service.skipAllDuplicates();
      const duplicates = service.rows().filter(r => r.status === 'duplicate');
      expect(duplicates.every(r => r.duplicateAction === 'skip')).toBe(true);
    });
  });

  describe('getImportableWords — incomplete flag', () => {
    it('import row where word has no definition → should be flagged incomplete', () => {
      service.parseText('ephemeral');
      const { newWords } = service.getImportableWords();
      expect(newWords[0].incomplete).toBe(true);
    });

    it('import row where word has a real definition → should NOT be flagged incomplete', () => {
      service.parseText('ephemeral - lasting only a short time');
      const { newWords } = service.getImportableWords();
      expect(newWords[0].incomplete).toBeUndefined();
    });
  });

  describe('getImportableWords', () => {
    it('should return newWords for ok rows', () => {
      service.parseText('apple - a fruit\nbanana - yellow');
      const { newWords, mergeWords } = service.getImportableWords();
      expect(newWords.length).toBe(2);
      expect(mergeWords.length).toBe(0);
    });

    it('should return mergeWords for merge-resolved duplicates', () => {
      const existingId = 'existing-id-3';
      wordsSignal.set([makeWord('apple', existingId)]);
      service.parseText('apple - updated definition\nbanana - yellow');
      service.resolveDuplicate(service.rows()[0].id, 'merge');
      const { newWords, mergeWords } = service.getImportableWords();
      expect(newWords.length).toBe(1);
      expect(mergeWords.length).toBe(1);
      expect(mergeWords[0].duplicateOf).toBe(existingId);
    });

    it('should exclude skip-resolved duplicates from both lists', () => {
      wordsSignal.set([makeWord('apple')]);
      service.parseText('apple - a fruit\nbanana - yellow');
      service.resolveDuplicate(service.rows()[0].id, 'skip');
      const { newWords, mergeWords } = service.getImportableWords();
      expect(newWords.length).toBe(1);
      expect(mergeWords.length).toBe(0);
    });

    it('should include keep-resolved duplicates as newWords', () => {
      wordsSignal.set([makeWord('apple')]);
      service.parseText('apple - a fruit\nbanana - yellow');
      service.resolveDuplicate(service.rows()[0].id, 'keep');
      const { newWords } = service.getImportableWords();
      expect(newWords.length).toBe(2);
    });
  });

  describe('draft save/restore', () => {
    it('saveDraft should persist rows to sessionStorage', () => {
      service.parseText('apple - a fruit\nbanana - yellow');
      service.saveDraft();
      const raw = sessionStorage.getItem('vv_bulk_draft');
      expect(raw).not.toBeNull();
      if (raw === null) return;
      const data = JSON.parse(raw);
      expect(data.rows.length).toBe(2);
    });

    it('restoreDraft should load rows from sessionStorage', () => {
      service.parseText('apple - a fruit');
      service.saveDraft();
      // Clear rows without clearing draft (simulates page reload scenario)
      service.rows.set([]);
      expect(service.rows().length).toBe(0);
      const restored = service.restoreDraft();
      expect(restored).toBe(true);
      expect(service.rows().length).toBe(1);
    });

    it('restoreDraft should return false when no draft exists', () => {
      expect(service.restoreDraft()).toBe(false);
    });

    it('clearDraft should remove sessionStorage entry', () => {
      service.parseText('apple - a fruit');
      service.saveDraft();
      service.clearDraft();
      expect(sessionStorage.getItem('vv_bulk_draft')).toBeNull();
    });
  });

  describe('reset', () => {
    it('should clear all rows', () => {
      service.parseText('apple - a fruit\nbanana - yellow');
      service.reset();
      expect(service.rows().length).toBe(0);
    });

    it('should clear lastInputText on reset', () => {
      service.parseText('apple - a fruit');
      expect(service.lastInputText()).toBe('apple - a fruit');
      service.reset();
      expect(service.lastInputText()).toBe('');
    });

    it('should preserve lastInputText across parseText calls (for back-to-editing)', () => {
      service.parseText('hello - world');
      expect(service.lastInputText()).toBe('hello - world');
      // Simulating "back to editing" — lastInputText should still be available
      expect(service.lastInputText()).toBe('hello - world');
    });

    it('should clear the detectedDelimiter', () => {
      service.parseText('apple - a fruit');
      service.reset();
      expect(service.detectedDelimiter()).toBe('');
    });

    it('should clear sessionStorage draft on reset', () => {
      service.parseText('apple - a fruit');
      service.saveDraft();
      service.reset();
      expect(sessionStorage.getItem('vv_bulk_draft')).toBeNull();
    });
  });

  describe('lookupOne', () => {
    it('should fill definition for a missing-def row', async () => {
      lookupWordMock.mockResolvedValue({
        definition: 'a red fruit',
        pronunciation: 'AP-ul',
        examples: ['I ate an apple'],
      });
      service.parseText('apple');
      const rowId = service.rows()[0].id;
      const result = await service.lookupOne(rowId);
      expect(result).toBe(true);
      expect(service.rows()[0].definition).toBe('a red fruit');
      expect(service.rows()[0].status).toBe('ok');
    });

    it('should set lookupFailed when API throws', async () => {
      lookupWordMock.mockRejectedValue(new Error('Not found'));
      service.parseText('xyzqwerty');
      const rowId = service.rows()[0].id;
      const result = await service.lookupOne(rowId);
      expect(result).toBe(false);
      expect(service.rows()[0].lookupFailed).toBe(true);
    });
  });

  describe('auto-detect words-only mode', () => {
    it('pure word list → detectedWordsOnly becomes true and wordsOnlyMode auto-syncs to true', () => {
      service.parseText('apple\nbanana\ncherry');
      expect(service.detectedWordsOnly()).toBe(true);
      expect(service.wordsOnlyMode()).toBe(true);
    });

    it('word + definition input → detectedWordsOnly becomes false and wordsOnlyMode auto-syncs to false', () => {
      service.parseText('apple - a fruit\nbanana - yellow');
      expect(service.detectedWordsOnly()).toBe(false);
      expect(service.wordsOnlyMode()).toBe(false);
    });

    it('user toggle → wordsOnlyMode is NOT overwritten by subsequent parseText auto-detection', () => {
      // User explicitly switches to words-only even though the input has definitions
      service.toggleWordsOnlyMode(); // now true
      expect(service.wordsOnlyMode()).toBe(true);
      // Parse text that would normally auto-detect as words+defs
      service.parseText('apple - a fruit\nbanana - yellow');
      // auto-sync must not overwrite the user's choice
      expect(service.wordsOnlyMode()).toBe(true);
    });

    it('after reset() → userToggledMode is cleared and auto-sync resumes', () => {
      // User explicitly toggles, then resets
      service.toggleWordsOnlyMode(); // sets userToggledMode = true
      service.reset();
      // Now auto-sync should work again: word-list input → wordsOnlyMode true
      service.parseText('apple\nbanana');
      expect(service.wordsOnlyMode()).toBe(true);
      // And definitions input → wordsOnlyMode false
      service.reset();
      service.parseText('apple - fruit\nbanana - yellow');
      expect(service.wordsOnlyMode()).toBe(false);
    });
  });

  describe('toggleWordsOnlyMode', () => {
    it('flips wordsOnlyMode from false to true', () => {
      expect(service.wordsOnlyMode()).toBe(false);
      service.toggleWordsOnlyMode();
      expect(service.wordsOnlyMode()).toBe(true);
    });

    it('flips wordsOnlyMode from true to false', () => {
      service.wordsOnlyMode.set(true);
      service.toggleWordsOnlyMode();
      expect(service.wordsOnlyMode()).toBe(false);
    });

    it('prevents subsequent auto-sync from overwriting mode', () => {
      service.toggleWordsOnlyMode(); // true, userToggledMode = true
      // word list input would normally auto-detect as wordsOnly=true (no change here)
      // but if we toggle to false, subsequent auto-detect should NOT re-set it to true
      service.toggleWordsOnlyMode(); // false, userToggledMode still true
      service.parseText('apple\nbanana\ncherry'); // would auto-sync to true
      expect(service.wordsOnlyMode()).toBe(false);
    });
  });

  describe('importableCount after demote', () => {
    it('demoting ok → missing-def decreases importableCount', () => {
      service.parseText('apple - a fruit\nbanana - yellow');
      expect(service.importableCount()).toBe(2);
      const rowId = service.rows()[0].id;
      service.updateRow(rowId, { definition: '' });
      expect(service.importableCount()).toBe(1);
    });

    it('demoting to whitespace-only definition decreases importableCount', () => {
      service.parseText('apple - a fruit\nbanana - yellow');
      expect(service.importableCount()).toBe(2);
      const rowId = service.rows()[1].id;
      service.updateRow(rowId, { definition: '   ' });
      expect(service.importableCount()).toBe(1);
    });
  });

  describe('definition count (ok vs missing-def)', () => {
    it('mixed input: 1 with definition + 1 without → 1 ok, 1 missing-def', () => {
      service.parseText('apple - a fruit\nbanana');
      const rows = service.rows();
      expect(rows[0].status).toBe('ok');
      expect(rows[1].status).toBe('missing-def');
      expect(service.readyCount()).toBe(1);
      expect(service.amberCount()).toBe(1);
    });

    it('all-tab-separated: 2 with definitions → readyCount = 2, amberCount = 0', () => {
      service.parseText('apple\ta fruit\nbanana\tyellow fruit');
      expect(service.readyCount()).toBe(2);
      expect(service.amberCount()).toBe(0);
    });
  });

  describe('lookupAll', () => {
    it('should fill definitions for all missing-def rows', async () => {
      lookupWordMock.mockResolvedValue({
        definition: 'filled definition',
        pronunciation: '',
        examples: [],
      });
      service.parseText('apple\nbanana');
      const { found, notFound } = await service.lookupAll();
      expect(found).toBe(2);
      expect(notFound).toBe(0);
      expect(service.rows().every(r => r.status === 'ok')).toBe(true);
    });

    it('should update lookupProgress during batch lookup', async () => {
      const progress: Array<{ current: number; total: number } | null> = [];
      lookupWordMock.mockImplementation(async () => {
        progress.push(service.lookupProgress());
        return { definition: 'def', pronunciation: '', examples: [] };
      });
      service.parseText('apple\nbanana');
      await service.lookupAll();
      expect(progress.some(p => p !== null && p.total === 2)).toBe(true);
    });

    it('should only look up missing-def rows, not ok rows', async () => {
      lookupWordMock.mockResolvedValue({
        definition: 'looked up',
        pronunciation: '',
        examples: [],
      });
      service.parseText('apple - already defined\nbanana');
      await service.lookupAll();
      // Only banana should be looked up
      expect(dictApiMock.lookupWord).toHaveBeenCalledTimes(1);
      expect(dictApiMock.lookupWord).toHaveBeenCalledWith('banana', { bulkMode: true });
    });

    it('should count genuine 404s as notFound', async () => {
      lookupWordMock.mockRejectedValue(
        new Error('Word not found'),
      );
      service.parseText('xyznotaword\nabcnotaword');
      const { found, notFound } = await service.lookupAll();
      expect(found).toBe(0);
      expect(notFound).toBe(2);
    });

    it('should set lookupFailed on rows that get 404', async () => {
      lookupWordMock.mockRejectedValue(
        new Error('Word not found'),
      );
      service.parseText('xyznotaword');
      await service.lookupAll();
      expect(service.rows()[0].lookupFailed).toBe(true);
    });

    it('should populate lastLookupResult after batch completes', async () => {
      let callCount = 0;
      lookupWordMock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return { definition: 'def', pronunciation: '', examples: [] };
        throw new Error('Not found');
      });
      service.parseText('apple\nxyz');
      await service.lookupAll();
      expect(service.lastLookupResult()).toEqual({ found: 1, notFound: 1 });
    });

    it('should populate lookupResults with per-word outcomes', async () => {
      let callCount = 0;
      lookupWordMock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) return { definition: 'def', pronunciation: '', examples: [] };
        throw new Error('Not found');
      });
      service.parseText('apple\nxyz');
      await service.lookupAll();
      const results = service.lookupResults();
      expect(results).toHaveLength(2);
      expect(results.find(r => r.word === 'apple')?.found).toBe(true);
      expect(results.find(r => r.word === 'xyz')?.found).toBe(false);
    });

    it('should clear retry signals after completion', async () => {
      lookupWordMock.mockResolvedValue({
        definition: 'def',
        pronunciation: '',
        examples: [],
      });
      service.parseText('apple');
      await service.lookupAll();
      expect(service.retryRound()).toBe(0);
      expect(service.retryCountdown()).toBe(0);
      expect(service.retriableCount()).toBe(0);
    });

    it('should clear lookupProgress to null after batch completes', async () => {
      lookupWordMock.mockResolvedValue({
        definition: 'def',
        pronunciation: '',
        examples: [],
      });
      service.parseText('apple');
      await service.lookupAll();
      expect(service.lookupProgress()).toBeNull();
    });

    it('should clear currentLookupWord after batch completes', async () => {
      lookupWordMock.mockResolvedValue({
        definition: 'def',
        pronunciation: '',
        examples: [],
      });
      service.parseText('apple');
      await service.lookupAll();
      expect(service.currentLookupWord()).toBe('');
    });
  });

  describe('lookupAll — rate limiting and retry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should separate rate-limited words from genuine 404s', async () => {
      lookupWordMock.mockImplementation(async (word: string) => {
        if (word === 'apple') return { definition: 'a fruit', pronunciation: '', examples: [] };
        if (word === 'banana') throw new RateLimitError('banana');
        throw new Error('Not found');
      });

      service.parseText('apple\nbanana\nxyz');

      const promise = service.lookupAll();
      // Advance through all delays (chunk delay + retry backoff countdown)
      await vi.runAllTimersAsync();
      const result = await promise;

      // apple found, xyz not found, banana retried
      expect(result.found).toBeGreaterThanOrEqual(1);
      // xyz should be genuinely not found
      const xyzRow = service.rows().find(r => r.word === 'xyz');
      expect(xyzRow?.lookupFailed).toBe(true);
    });

    it('should retry rate-limited words with backoff', async () => {
      lookupWordMock.mockImplementation(async () => {
        if (lookupWordMock.mock.calls.length <= 1) throw new RateLimitError('hello');
        return { definition: 'a greeting', pronunciation: '', examples: [] };
      });

      service.parseText('hello');
      const promise = service.lookupAll();
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.found).toBe(1);
      expect(result.notFound).toBe(0);
      expect(service.rows()[0].status).toBe('ok');
      expect(service.rows()[0].definition).toBe('a greeting');
    });

    it('should set retryRound signal during retry rounds', async () => {
      const observedRounds: number[] = [];
      lookupWordMock.mockImplementation(async () => {
        observedRounds.push(service.retryRound());
        throw new RateLimitError('test');
      });

      service.parseText('stubborn');
      const promise = service.lookupAll();
      await vi.runAllTimersAsync();
      await promise;

      // Initial pass has retryRound 0, retry rounds have 1, 2, 3
      expect(observedRounds).toContain(0);
      expect(observedRounds.some(r => r >= 1)).toBe(true);
    });

    it('should set retriableCount signal during retry', async () => {
      const observedCounts: number[] = [];
      lookupWordMock.mockImplementation(async () => {
        observedCounts.push(service.retriableCount());
        throw new RateLimitError('word');
      });

      service.parseText('word1\nword2');
      const promise = service.lookupAll();
      await vi.runAllTimersAsync();
      await promise;

      // retriableCount should reflect the number of rate-limited words
      expect(observedCounts.some(c => c === 2)).toBe(true);
    });

    it('should mark rate-limited words as failed after max retry rounds', async () => {
      lookupWordMock.mockRejectedValue(
        new RateLimitError('stubborn'),
      );

      service.parseText('stubborn');
      const promise = service.lookupAll();
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.notFound).toBe(1);
      expect(service.rows()[0].lookupFailed).toBe(true);
    });

    it('should succeed on second retry round if API recovers', async () => {
      let callCount = 0;
      lookupWordMock.mockImplementation(async () => {
        callCount++;
        // First 2 calls rate-limited, third succeeds
        if (callCount <= 2) throw new RateLimitError('hello');
        return { definition: 'greeting', pronunciation: '/həˈloʊ/', examples: [] };
      });

      service.parseText('hello');
      const promise = service.lookupAll();
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.found).toBe(1);
      expect(result.notFound).toBe(0);
      expect(service.rows()[0].definition).toBe('greeting');
    });

    it('should handle mixed results: some found, some rate-limited, some 404', async () => {
      lookupWordMock.mockImplementation(async (word: string) => {
        if (word === 'apple') return { definition: 'fruit', pronunciation: '', examples: [] };
        if (word === 'banana') throw new RateLimitError('banana');
        if (word === 'xyz') throw new Error('Not found');
        // banana recovers on retry
        if (word === 'banana') return { definition: 'yellow fruit', pronunciation: '', examples: [] };
        throw new Error('Unknown');
      });

      service.parseText('apple\nbanana\nxyz');
      const promise = service.lookupAll();
      await vi.runAllTimersAsync();
      const result = await promise;

      // apple is found for sure
      expect(result.found).toBeGreaterThanOrEqual(1);
      // xyz is genuinely not found
      const xyzRow = service.rows().find(r => r.word === 'xyz');
      expect(xyzRow?.lookupFailed).toBe(true);
    });

    it('should reset retry signals after all retries complete', async () => {
      lookupWordMock.mockRejectedValue(
        new RateLimitError('stubborn'),
      );

      service.parseText('stubborn');
      const promise = service.lookupAll();
      await vi.runAllTimersAsync();
      await promise;

      expect(service.retryRound()).toBe(0);
      expect(service.retryCountdown()).toBe(0);
      expect(service.retriableCount()).toBe(0);
    });

    it('should set lookupServiceError when rate-limited words remain after retries', async () => {
      lookupWordMock.mockRejectedValue(
        new RateLimitError('stubborn'),
      );

      expect(service.lookupServiceError()).toBe(false);

      service.parseText('stubborn');
      const promise = service.lookupAll();
      await vi.runAllTimersAsync();
      await promise;

      expect(service.lookupServiceError()).toBe(true);
    });

    it('should reset lookupServiceError at start of new lookupAll', async () => {
      // First: trigger the error
      lookupWordMock.mockRejectedValue(
        new RateLimitError('stubborn'),
      );

      service.parseText('stubborn');
      let promise = service.lookupAll();
      await vi.runAllTimersAsync();
      await promise;
      expect(service.lookupServiceError()).toBe(true);

      // Second: successful lookup resets the error
      lookupWordMock.mockResolvedValue({
        definition: 'test def',
        pronunciation: '',
        examples: [],
      });

      service.parseText('hello');
      promise = service.lookupAll();
      await vi.runAllTimersAsync();
      await promise;
      expect(service.lookupServiceError()).toBe(false);
    });

    it('should NOT set lookupServiceError when all failures are genuine 404s', async () => {
      lookupWordMock.mockRejectedValue(new Error('Not found'));

      service.parseText('xyz');
      const promise = service.lookupAll();
      await vi.runAllTimersAsync();
      await promise;

      expect(service.lookupServiceError()).toBe(false);
    });

    it('should not retry when all failures are genuine 404s', async () => {
      const callWords: string[] = [];
      lookupWordMock.mockImplementation(async (word: string) => {
        callWords.push(word);
        throw new Error('Not found');
      });

      service.parseText('xyz1\nxyz2');
      const promise = service.lookupAll();
      await vi.runAllTimersAsync();
      await promise;

      // Each word should only be called once — no retries for 404s
      expect(callWords).toEqual(['xyz1', 'xyz2']);
    });

    it('should process 8+ words in chunks of 4 with inter-chunk delay', async () => {
      const callOrder: string[] = [];
      lookupWordMock.mockImplementation(async (word: string) => {
        callOrder.push(word);
        return { definition: `${word} def`, pronunciation: '', examples: [] };
      });

      service.parseText('a\nb\nc\nd\ne\nf\ng\nh');
      const promise = service.lookupAll();
      await vi.runAllTimersAsync();
      await promise;

      expect(callOrder).toHaveLength(8);
      expect(service.rows().every(r => r.status === 'ok')).toBe(true);
    });
  });

  describe('abortLookup', () => {
    it('should clear all lookup and retry signals', () => {
      // Manually set signals to non-default values
      service.retryRound.set(2);
      service.retryCountdown.set(5);
      service.retriableCount.set(10);

      service.abortLookup();

      expect(service.lookupProgress()).toBeNull();
      expect(service.currentLookupWord()).toBe('');
      expect(service.retryRound()).toBe(0);
      expect(service.retryCountdown()).toBe(0);
      expect(service.retriableCount()).toBe(0);
    });
  });

  describe('concurrent word additions during lookup (snapshot limitation)', () => {
    it('should not detect words added after parse as duplicates — documenting snapshot-based detection limitation', async () => {
      // The detectDuplicates() method takes a snapshot of wordService.words() at parse time.
      // If a word is added to the dictionary AFTER parsing but BEFORE/DURING lookup,
      // the bulk import will not detect it as a duplicate.
      lookupWordMock.mockImplementation(async (word: string) => {
        // Simulate concurrent add: while lookup is in-flight, add "apple" to wordService
        if (word === 'apple') {
          wordsSignal.set([makeWord('apple', 'concurrent-id')]);
        }
        return { definition: 'a fruit', pronunciation: '', examples: [] };
      });

      // 1. Parse "apple" — no definition, missing-def status
      service.parseText('apple');
      expect(service.rows()[0].status).toBe('missing-def');

      // 2. Verify "apple" is not in wordService at parse time
      expect(wordsSignal().length).toBe(0);

      // 3. Start lookupAll (will trigger concurrent add inside mock)
      await service.lookupAll();

      // 4. After lookup, the row has status "ok" with definition filled
      expect(service.rows()[0].status).toBe('ok');
      expect(service.rows()[0].definition).toBe('a fruit');

      // 5. Verify "apple" now exists in wordService (added concurrently)
      expect(wordsSignal().length).toBe(1);

      // 6. getImportableWords() still includes "apple" as a new word
      //    even though it already exists — this is the snapshot limitation
      const { newWords } = service.getImportableWords();
      expect(newWords.length).toBe(1);
      expect(newWords[0].word).toBe('apple');
      // If imported now, this would create a duplicate in the dictionary
    });

    it('should detect duplicates only against snapshot taken at parse time, not at import time', () => {
      // Parse with empty dictionary
      service.parseText('hello - greeting\nworld - planet');
      expect(service.rows().every(r => r.status === 'ok')).toBe(true);

      // Add "hello" to dictionary AFTER parsing
      wordsSignal.set([makeWord('hello', 'existing-hello')]);

      // The rows are NOT re-evaluated — still shows ok, not duplicate
      expect(service.rows()[0].status).toBe('ok');
      expect(service.rows()[0].word).toBe('hello');

      // getImportableWords still returns "hello" as a new word
      const { newWords } = service.getImportableWords();
      expect(newWords.find(w => w.word === 'hello')).toBeTruthy();
    });
  });

  describe('reset clears retry state', () => {
    it('should reset all retry-related signals including lookupServiceError', () => {
      service.retryRound.set(3);
      service.retryCountdown.set(8);
      service.retriableCount.set(20);
      service.lookupServiceError.set(true);

      service.reset();

      expect(service.retryRound()).toBe(0);
      expect(service.retryCountdown()).toBe(0);
      expect(service.retriableCount()).toBe(0);
      expect(service.lookupProgress()).toBeNull();
      expect(service.currentLookupWord()).toBe('');
      expect(service.lastLookupResult()).toBeNull();
      expect(service.lookupResults()).toEqual([]);
      expect(service.lookupServiceError()).toBe(false);
    });
  });

  // ── Placeholder definition detection ────────────────────────

  describe('placeholder definition detection', () => {
    describe('buildRows — parseText', () => {
      it('should mark row with definition "Placeholder" as missing-def', () => {
        service.parseText('ephemeral\tPlaceholder');
        expect(service.rows()[0].status).toBe('missing-def');
      });

      it('should mark row with definition "test" as missing-def', () => {
        service.parseText('ephemeral\ttest');
        expect(service.rows()[0].status).toBe('missing-def');
      });

      it('should mark row with definition "aaa" as missing-def', () => {
        service.parseText('ephemeral\taaa');
        expect(service.rows()[0].status).toBe('missing-def');
      });

      it('should mark row with definition "..." as missing-def', () => {
        service.parseText('ephemeral\t...');
        expect(service.rows()[0].status).toBe('missing-def');
      });

      it('should mark row with definition "tbd" as missing-def', () => {
        service.parseText('ephemeral\ttbd');
        expect(service.rows()[0].status).toBe('missing-def');
      });

      it('should set status ok for row with a real definition', () => {
        service.parseText('ephemeral\tLasting only a short time');
        expect(service.rows()[0].status).toBe('ok');
      });

      it('should set status ok for row with definition that contains a blocklist word as substring', () => {
        service.parseText('ephemeral\tThe act of testing something');
        expect(service.rows()[0].status).toBe('ok');
      });
    });

    describe('updateRow — promote / demote logic', () => {
      const setupMissingDefRow = () => {
        service.parseText('ephemeral');
        const row = service.rows()[0];
        expect(row.status).toBe('missing-def');
        return row.id;
      };

      const setupOkRow = () => {
        service.parseText('ephemeral\tLasting only a short time');
        const row = service.rows()[0];
        expect(row.status).toBe('ok');
        return row.id;
      };

      it('should NOT promote to ok when updated definition is "Placeholder"', () => {
        const id = setupMissingDefRow();
        service.updateRow(id, { definition: 'Placeholder' });
        expect(service.rows()[0].status).toBe('missing-def');
      });

      it('should NOT promote to ok when updated definition is "test"', () => {
        const id = setupMissingDefRow();
        service.updateRow(id, { definition: 'test' });
        expect(service.rows()[0].status).toBe('missing-def');
      });

      it('should NOT promote to ok when updated definition is "aaa"', () => {
        const id = setupMissingDefRow();
        service.updateRow(id, { definition: 'aaa' });
        expect(service.rows()[0].status).toBe('missing-def');
      });

      it('should promote to ok when updated definition is a real definition', () => {
        const id = setupMissingDefRow();
        service.updateRow(id, { definition: 'Lasting only a short time' });
        expect(service.rows()[0].status).toBe('ok');
      });

      it('should demote from ok to missing-def when definition is cleared', () => {
        const id = setupOkRow();
        service.updateRow(id, { definition: '' });
        expect(service.rows()[0].status).toBe('missing-def');
      });

      it('should remain ok when definition is updated to another valid definition', () => {
        const id = setupOkRow();
        service.updateRow(id, { definition: 'A different valid definition' });
        expect(service.rows()[0].status).toBe('ok');
      });
    });
  });
});
