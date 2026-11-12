// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { WordService } from './word.service';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { MasteryLevel, SR_DEFAULTS, FlagReason } from './models';

describe('WordService', () => {
  let service: WordService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        WordService,
        { provide: StorageService, useClass: LocalStorageService },
      ],
    });
    service = TestBed.inject(WordService);
  });

  it('should start empty when localStorage has no vv_words key', () => {
    expect(service.words()).toEqual([]);
  });

  it('should add a word with MasteryLevel.New, auto-generated id, createdAt/updatedAt', () => {
    const { word } = service.addWord({
      word: 'ephemeral',
      pronunciation: 'ih-FEM-er-ul',
      definition: 'Lasting for a very short time',
      examples: ['The ephemeral beauty of cherry blossoms'],
    });

    expect(word.masteryLevel).toBe(MasteryLevel.New);
    expect(word.id).toBeTruthy();
    expect(word.id.length).toBeGreaterThan(0);
    expect(word.createdAt).toBeInstanceOf(Date);
    expect(word.updatedAt).toBeInstanceOf(Date);
  });

  it('should return ok: true on successful addWord', () => {
    const { ok } = service.addWord({
      word: 'test',
      pronunciation: 'test',
      definition: 'test',
      examples: [],
    });
    expect(ok).toBe(true);
  });

  it('should persist words by calling storage.set after addWord', () => {
    service.addWord({
      word: 'test',
      pronunciation: 'test',
      definition: 'test',
      examples: [],
    });

    const stored = JSON.parse(localStorage.getItem('vv_words') ?? '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].word).toBe('test');
  });

  it('should updateWord — change specified fields and set updatedAt, not change createdAt', () => {
    const { word } = service.addWord({
      word: 'original',
      pronunciation: 'test',
      definition: 'original definition',
      examples: [],
    });

    const originalCreatedAt = word.createdAt;

    service.updateWord(word.id, { definition: 'updated definition' });

    const updated = service.getWord(word.id);
    expect(updated?.definition).toBe('updated definition');
    expect(updated?.word).toBe('original');
    // createdAt must not change
    expect(updated).toBeDefined();
    if (!updated) return;
    expect(new Date(updated.createdAt as unknown as string).toISOString()).toBe(
      new Date(originalCreatedAt).toISOString()
    );
  });

  it('should return true on successful updateWord', () => {
    const { word } = service.addWord({
      word: 'test',
      pronunciation: 'test',
      definition: 'test',
      examples: [],
    });
    expect(service.updateWord(word.id, { definition: 'new' })).toBe(true);
  });

  it('should deleteWord — remove word from signal and persist', () => {
    const { word } = service.addWord({
      word: 'toDelete',
      pronunciation: 'test',
      definition: 'to be deleted',
      examples: [],
    });

    expect(service.words().length).toBe(1);
    service.deleteWord(word.id);
    expect(service.words().length).toBe(0);

    const stored = JSON.parse(localStorage.getItem('vv_words') ?? '[]');
    expect(stored.length).toBe(0);
  });

  it('should return true on successful deleteWord', () => {
    const { word } = service.addWord({
      word: 'test',
      pronunciation: 'test',
      definition: 'test',
      examples: [],
    });
    expect(service.deleteWord(word.id)).toBe(true);
  });

  it('should read initial words from storage on construction', () => {
    const words = [
      {
        id: 'test-id',
        word: 'existing',
        pronunciation: 'test',
        definition: 'existing word',
        examples: [],
        masteryLevel: MasteryLevel.New,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    localStorage.setItem('vv_words', JSON.stringify(words));

    // Create a new service instance in a new TestBed
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        WordService,
        { provide: StorageService, useClass: LocalStorageService },
      ],
    });
    const newService = TestBed.inject(WordService);
    expect(newService.words().length).toBe(1);
    expect(newService.words()[0].word).toBe('existing');
  });

  describe('storage failure', () => {
    it('should return ok: false when storage fails on addWord', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const { ok } = service.addWord({
        word: 'fail',
        pronunciation: 'test',
        definition: 'test',
        examples: [],
      });
      expect(ok).toBe(false);
      vi.restoreAllMocks();
    });

    it('should return false when storage fails on updateWord', () => {
      const { word } = service.addWord({
        word: 'test',
        pronunciation: 'test',
        definition: 'test',
        examples: [],
      });

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      expect(service.updateWord(word.id, { definition: 'new' })).toBe(false);
      vi.restoreAllMocks();
    });

    it('should return false when storage fails on deleteWord', () => {
      const { word } = service.addWord({
        word: 'test',
        pronunciation: 'test',
        definition: 'test',
        examples: [],
      });

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      expect(service.deleteWord(word.id)).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe('isIncomplete null safety', () => {
    it('addWord with null word should be incomplete without throwing', () => {
      const { word } = service.addWord({
        word: null as unknown as string,
        pronunciation: '',
        definition: 'some definition',
        examples: [],
      });
      expect(word.incomplete).toBe(true);
    });

    it('addWord with null definition should be incomplete without throwing', () => {
      const { word } = service.addWord({
        word: 'valid',
        pronunciation: '',
        definition: null as unknown as string,
        examples: [],
      });
      expect(word.incomplete).toBe(true);
    });
  });

  describe('SR migration', () => {
    it('should add SR defaults to words loaded without SR fields', () => {
      const oldWord = {
        id: 'old-1',
        word: 'hello',
        pronunciation: 'heh-loh',
        definition: 'A greeting',
        examples: [],
        masteryLevel: 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('vv_words', JSON.stringify([oldWord]));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          WordService,
          { provide: StorageService, useClass: LocalStorageService },
        ],
      });
      const svc = TestBed.inject(WordService);
      const word = svc.words()[0];

      expect(word.interval).toBe(SR_DEFAULTS.interval);
      expect(word.easeFactor).toBe(SR_DEFAULTS.easeFactor);
      expect(word.reviewCount).toBe(SR_DEFAULTS.reviewCount);
    });

    it('should not modify words that already have SR fields', () => {
      const existingWord = {
        id: 'sr-1',
        word: 'test',
        pronunciation: 'test',
        definition: 'test',
        examples: [],
        masteryLevel: 'learning',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        interval: 7,
        easeFactor: 2.1,
        reviewCount: 5,
      };
      localStorage.setItem('vv_words', JSON.stringify([existingWord]));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          WordService,
          { provide: StorageService, useClass: LocalStorageService },
        ],
      });
      const svc = TestBed.inject(WordService);
      const word = svc.words()[0];

      expect(word.interval).toBe(7);
      expect(word.easeFactor).toBe(2.1);
      expect(word.reviewCount).toBe(5);
    });

    it('should persist migrated words back to localStorage', () => {
      const oldWord = {
        id: 'old-2',
        word: 'world',
        pronunciation: 'wurld',
        definition: 'The earth',
        examples: [],
        masteryLevel: 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('vv_words', JSON.stringify([oldWord]));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          WordService,
          { provide: StorageService, useClass: LocalStorageService },
        ],
      });
      TestBed.inject(WordService);

      const stored = JSON.parse(localStorage.getItem('vv_words') ?? '[]');
      expect(stored[0].interval).toBe(SR_DEFAULTS.interval);
      expect(stored[0].easeFactor).toBe(SR_DEFAULTS.easeFactor);
      expect(stored[0].reviewCount).toBe(SR_DEFAULTS.reviewCount);
    });

    it('should recompute incomplete flag during migration for words missing it', () => {
      const oldWordEmpty = {
        id: 'migrate-empty',
        word: 'hello',
        pronunciation: '',
        definition: '',
        examples: [],
        masteryLevel: 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const oldWordValid = {
        id: 'migrate-valid',
        word: 'hello',
        pronunciation: '',
        definition: 'A greeting',
        examples: [],
        masteryLevel: 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('vv_words', JSON.stringify([oldWordEmpty, oldWordValid]));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          WordService,
          { provide: StorageService, useClass: LocalStorageService },
        ],
      });
      const svc = TestBed.inject(WordService);

      const words = svc.words();
      expect(words.find((w) => w.id === 'migrate-empty')?.incomplete).toBe(true);
      expect(words.find((w) => w.id === 'migrate-valid')?.incomplete).toBeFalsy();
    });

    it('quizzableWords excludes migrated words with empty definitions', () => {
      const oldWordNoFlag = {
        id: 'no-flag-empty-def',
        word: 'hello',
        pronunciation: '',
        definition: '',
        examples: [],
        masteryLevel: 'new',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('vv_words', JSON.stringify([oldWordNoFlag]));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          WordService,
          { provide: StorageService, useClass: LocalStorageService },
        ],
      });
      const svc = TestBed.inject(WordService);

      expect(svc.quizzableWords().length).toBe(0);
    });
  });


  describe('addWords', () => {
    it('should add multiple words in single call', () => {
      const result = service.addWords([
        { word: 'a', definition: 'b', pronunciation: '', examples: [] },
        { word: 'c', definition: 'd', pronunciation: '', examples: [] },
      ]);
      expect(result.ok).toBe(true);
      expect(result.words.length).toBe(2);
      expect(service.words().length).toBe(2);
    });

    it('should assign unique ids to each word', () => {
      const result = service.addWords([
        { word: 'x', definition: 'y', pronunciation: '', examples: [] },
        { word: 'p', definition: 'q', pronunciation: '', examples: [] },
      ]);
      expect(result.words[0].id).not.toBe(result.words[1].id);
    });

    it('should set masteryLevel to New for all words', () => {
      const result = service.addWords([
        { word: 'alpha', definition: 'first', pronunciation: '', examples: [] },
        { word: 'beta', definition: 'second', pronunciation: '', examples: [] },
      ]);
      expect(result.words.every((w) => w.masteryLevel === MasteryLevel.New)).toBe(true);
    });

    it('should handle incomplete words', () => {
      const result = service.addWords([
        { word: 'incomplete-word', definition: '', pronunciation: '', examples: [], incomplete: true },
      ]);
      expect(result.words[0].incomplete).toBe(true);
    });
  });

  describe('toughWords', () => {
    it('returns empty array when no words exist', () => {
      expect(service.toughWords()).toEqual([]);
    });

    it('excludes words with reviewCount 0 (never reviewed)', () => {
      service.addWord({ word: 'never-reviewed', pronunciation: '', definition: 'test', examples: [] });
      expect(service.toughWords()).toEqual([]);
    });

    it('returns words that are Learning + reviewed + easeFactor below default', () => {
      const { word } = service.addWord({ word: 'tough', pronunciation: '', definition: 'test', examples: [] });
      service.updateWord(word.id, {
        masteryLevel: MasteryLevel.Learning,
        reviewCount: 3,
        easeFactor: 1.8,
        interval: 1,
        lastReviewedAt: new Date(),
        nextReviewDate: new Date(),
      });
      const tough = service.toughWords();
      expect(tough.length).toBe(1);
      expect(tough[0].id).toBe(word.id);
    });

    it('excludes Learning words with default easeFactor (2.5) — not tough, just learning', () => {
      const { word } = service.addWord({ word: 'normal-learner', pronunciation: '', definition: 'test', examples: [] });
      service.updateWord(word.id, {
        masteryLevel: MasteryLevel.Learning,
        reviewCount: 2,
        easeFactor: 2.5,
        interval: 1,
        lastReviewedAt: new Date(),
        nextReviewDate: new Date(),
      });
      expect(service.toughWords()).toEqual([]);
    });

    it('excludes Review-level words even with low easeFactor — they progressed past tough', () => {
      const { word } = service.addWord({ word: 'review-low-ease', pronunciation: '', definition: 'test', examples: [] });
      service.updateWord(word.id, {
        masteryLevel: MasteryLevel.Review,
        reviewCount: 5,
        easeFactor: 1.5,
        interval: 7,
        lastReviewedAt: new Date(),
        nextReviewDate: new Date(),
      });
      expect(service.toughWords()).toEqual([]);
    });
  });

  describe('word === definition guard', () => {
    it('addWord with word === definition should set incomplete to true', () => {
      const { word } = service.addWord({
        word: 'ephemeral',
        pronunciation: '',
        definition: 'ephemeral',
        examples: [],
      });
      expect(word.incomplete).toBe(true);
    });

    it('addWord with different word and definition should NOT set incomplete', () => {
      const { word } = service.addWord({
        word: 'ephemeral',
        pronunciation: '',
        definition: 'Lasting for a very short time',
        examples: [],
      });
      expect(word.incomplete).toBeFalsy();
    });

    it('addWords with one matching word === definition should mark only that one incomplete', () => {
      const { words } = service.addWords([
        { word: 'ephemeral', definition: 'ephemeral', pronunciation: '', examples: [] },
        { word: 'transient', definition: 'Passing quickly', pronunciation: '', examples: [] },
      ]);
      expect(words[0].incomplete).toBe(true);
      expect(words[1].incomplete).toBeFalsy();
    });

    it('updateWord changing word to match definition should set incomplete', () => {
      const { word } = service.addWord({
        word: 'ephemeral',
        pronunciation: '',
        definition: 'Lasting for a very short time',
        examples: [],
      });
      service.updateWord(word.id, { word: 'Lasting for a very short time' });
      const updated = service.getWord(word.id);
      expect(updated?.incomplete).toBe(true);
    });

    it('updateWord fixing word so it no longer matches should clear incomplete', () => {
      const { word } = service.addWord({
        word: 'ephemeral',
        pronunciation: '',
        definition: 'ephemeral',
        examples: [],
      });
      expect(word.incomplete).toBe(true);
      service.updateWord(word.id, { definition: 'Lasting for a very short time' });
      const updated = service.getWord(word.id);
      expect(updated?.incomplete).toBeFalsy();
    });

    it('case-insensitive: addWord with "Hello" word and "hello" definition should be incomplete', () => {
      const { word } = service.addWord({
        word: 'Hello',
        pronunciation: '',
        definition: 'hello',
        examples: [],
      });
      expect(word.incomplete).toBe(true);
    });

    it('whitespace: addWord with " hello " word and "hello" definition should be incomplete', () => {
      const { word } = service.addWord({
        word: ' hello ',
        pronunciation: '',
        definition: 'hello',
        examples: [],
      });
      expect(word.incomplete).toBe(true);
    });

    it('empty word: addWord with "" word should be incomplete', () => {
      const { word } = service.addWord({
        word: '',
        pronunciation: '',
        definition: 'some definition',
        examples: [],
      });
      expect(word.incomplete).toBe(true);
    });

    it('empty definition: addWord with "" definition should be incomplete', () => {
      const { word } = service.addWord({
        word: 'ephemeral',
        pronunciation: '',
        definition: '',
        examples: [],
      });
      expect(word.incomplete).toBe(true);
    });
  });

  describe('restoreWord', () => {
    it('re-inserts a deleted word', () => {
      const { word } = service.addWord({
        word: 'restore-me',
        pronunciation: '',
        definition: 'to put back',
        examples: [],
      });
      service.deleteWord(word.id);
      expect(service.words().length).toBe(0);

      service.restoreWord(word);

      expect(service.words().length).toBe(1);
      expect(service.words()[0].word).toBe('restore-me');
    });

    it('persists restored word to storage', () => {
      const { word } = service.addWord({
        word: 'persist-restore',
        pronunciation: '',
        definition: 'saved again',
        examples: [],
      });
      service.deleteWord(word.id);
      service.restoreWord(word);

      const stored = JSON.parse(localStorage.getItem('vv_words') ?? '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].word).toBe('persist-restore');
    });
  });

  describe('restoreWords', () => {
    it('re-inserts multiple deleted words', () => {
      const { word: w1 } = service.addWord({ word: 'alpha', pronunciation: '', definition: 'first', examples: [] });
      const { word: w2 } = service.addWord({ word: 'beta', pronunciation: '', definition: 'second', examples: [] });

      service.deleteWord(w1.id);
      service.deleteWord(w2.id);
      expect(service.words().length).toBe(0);

      service.restoreWords([w1, w2]);

      expect(service.words().length).toBe(2);
      const wordNames = service.words().map((w) => w.word);
      expect(wordNames).toContain('alpha');
      expect(wordNames).toContain('beta');
    });
  });

  describe('flag system', () => {
    it('flagWord sets flag with flaggedAt date and returns true', () => {
      const { word } = service.addWord({ word: 'test', pronunciation: '', definition: 'a test', examples: [] });
      const result = service.flagWord(word.id);
      expect(result).toBe(true);
      const updated = service.getWord(word.id);
      expect(updated?.flag).toBeDefined();
      expect(updated?.flag?.flaggedAt).toBeInstanceOf(Date);
    });

    it('flagWord with reason sets flag.reason', () => {
      const { word } = service.addWord({ word: 'confuse', pronunciation: '', definition: 'baffling', examples: [] });
      service.flagWord(word.id, 'confusing');
      const updated = service.getWord(word.id);
      expect(updated?.flag?.reason).toBe('confusing');
    });

    it('flagWord on non-existent id returns false', () => {
      expect(service.flagWord('nonexistent-id')).toBe(false);
    });

    it('unflagWord removes flag and returns true', () => {
      const { word } = service.addWord({ word: 'unflag-me', pronunciation: '', definition: 'remove flag', examples: [] });
      service.flagWord(word.id);
      expect(service.getWord(word.id)?.flag).toBeDefined();
      const result = service.unflagWord(word.id);
      expect(result).toBe(true);
      expect(service.getWord(word.id)?.flag).toBeUndefined();
    });

    it('unflagWord on non-existent id returns false', () => {
      expect(service.unflagWord('nonexistent-id')).toBe(false);
    });

    it('flaggedWords returns only words with flag set', () => {
      const { word: w1 } = service.addWord({ word: 'flagged', pronunciation: '', definition: 'has flag', examples: [] });
      service.addWord({ word: 'clean', pronunciation: '', definition: 'no flag', examples: [] });
      service.flagWord(w1.id);
      const flagged = service.flaggedWords();
      expect(flagged.length).toBe(1);
      expect(flagged[0].id).toBe(w1.id);
    });

    it('flaggedWords updates reactively when word is flagged/unflagged', () => {
      const { word } = service.addWord({ word: 'reactive', pronunciation: '', definition: 'updates', examples: [] });
      expect(service.flaggedWords().length).toBe(0);
      service.flagWord(word.id);
      expect(service.flaggedWords().length).toBe(1);
      service.unflagWord(word.id);
      expect(service.flaggedWords().length).toBe(0);
    });

    it('FlagReason accepts all 4 values', () => {
      const reasons: FlagReason[] = ['confusing', 'wrong', 'needs-context', 'too-easy'];
      const { word } = service.addWord({ word: 'multi', pronunciation: '', definition: 'reasons', examples: [] });
      for (const reason of reasons) {
        service.flagWord(word.id, reason);
        expect(service.getWord(word.id)?.flag?.reason).toBe(reason);
      }
    });

    it('WordFlag has optional reason and required flaggedAt', () => {
      const { word } = service.addWord({ word: 'shape', pronunciation: '', definition: 'test shape', examples: [] });
      service.flagWord(word.id);
      const flag = service.getWord(word.id)?.flag;
      expect(flag?.flaggedAt).toBeDefined();
      expect(flag?.reason).toBeUndefined();
    });
  });

  describe('updateWord (SR fields)', () => {
    it('should update SR fields on the target word', () => {
      const { word } = service.addWord({
        word: 'review-test',
        pronunciation: 'test',
        definition: 'test',
        examples: [],
      });

      const srData = {
        lastReviewedAt: new Date(),
        nextReviewDate: new Date(Date.now() + 86400000),
        interval: 1,
        easeFactor: 2.5,
        reviewCount: 1,
      };

      service.updateWord(word.id, srData);
      const updated = service.getWord(word.id);

      expect(updated?.interval).toBe(1);
      expect(updated?.reviewCount).toBe(1);
    });

    it('should not modify other words', () => {
      const { word: word1 } = service.addWord({
        word: 'word1',
        pronunciation: 'test',
        definition: 'test',
        examples: [],
      });
      const { word: word2 } = service.addWord({
        word: 'word2',
        pronunciation: 'test',
        definition: 'test',
        examples: [],
      });

      const srData = {
        lastReviewedAt: new Date(),
        nextReviewDate: new Date(Date.now() + 86400000),
        interval: 3,
        easeFactor: 2.4,
        reviewCount: 2,
      };

      service.updateWord(word1.id, srData);

      const unchanged = service.getWord(word2.id);
      expect(unchanged?.interval).toBe(SR_DEFAULTS.interval);
      expect(unchanged?.reviewCount).toBe(SR_DEFAULTS.reviewCount);
    });

    it('should persist changes to localStorage', () => {
      const { word } = service.addWord({
        word: 'persist-test',
        pronunciation: 'test',
        definition: 'test',
        examples: [],
      });

      const srData = {
        lastReviewedAt: new Date(),
        nextReviewDate: new Date(Date.now() + 86400000),
        interval: 7,
        easeFactor: 2.3,
        reviewCount: 3,
      };

      service.updateWord(word.id, srData);

      const stored = JSON.parse(localStorage.getItem('vv_words') ?? '[]');
      const storedWord = stored.find((w: Pick<typeof word, 'id'>) => w.id === word.id);
      expect(storedWord.interval).toBe(7);
      expect(storedWord.reviewCount).toBe(3);
    });

    it('should set updatedAt to current time', () => {
      const { word } = service.addWord({
        word: 'time-test',
        pronunciation: 'test',
        definition: 'test',
        examples: [],
      });

      const before = new Date();
      const srData = {
        lastReviewedAt: new Date(),
        nextReviewDate: new Date(Date.now() + 86400000),
        interval: 1,
        easeFactor: 2.5,
        reviewCount: 1,
      };

      service.updateWord(word.id, srData);
      const after = new Date();

      const updated = service.getWord(word.id);
      expect(updated).toBeDefined();
      if (!updated) return;
      const updatedAt = new Date(updated.updatedAt as unknown as string);
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
