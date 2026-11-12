// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { QuizService } from './quiz.service';
import { WordService } from './word.service';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { MasteryLevel } from './models';

describe('QuizService', () => {
  let service: QuizService;
  let wordService: WordService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        QuizService,
        WordService,
        { provide: StorageService, useClass: LocalStorageService },
      ],
    });
    service = TestBed.inject(QuizService);
    wordService = TestBed.inject(WordService);
  });

  it('should start with empty quiz sets', () => {
    expect(service.quizSets()).toEqual([]);
  });

  describe('addQuizSet', () => {
    it('should add a quiz set with generated id and dates', () => {
      const { quizSet: qs, ok } = service.addQuizSet({
        name: 'Test Set',
        description: 'desc',
        wordIds: ['w1', 'w2'],
      });

      expect(ok).toBe(true);
      expect(qs.id).toBeTruthy();
      expect(qs.name).toBe('Test Set');
      expect(qs.wordIds).toEqual(['w1', 'w2']);
      expect(qs.createdAt).toBeInstanceOf(Date);
      expect(qs.updatedAt).toBeInstanceOf(Date);
      expect(service.quizSets().length).toBe(1);
    });

    it('should persist to localStorage', () => {
      service.addQuizSet({ name: 'Persisted', description: '', wordIds: [] });
      const stored = JSON.parse(localStorage.getItem('vv_quiz_sets') ?? '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].name).toBe('Persisted');
    });

    it('should return ok: false when storage fails', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const { ok } = service.addQuizSet({ name: 'Fail', description: '', wordIds: [] });
      expect(ok).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe('updateQuizSet', () => {
    it('should update name and set updatedAt', () => {
      const { quizSet: qs } = service.addQuizSet({ name: 'Old', description: '', wordIds: [] });
      const before = new Date();
      service.updateQuizSet(qs.id, { name: 'New' });
      const after = new Date();

      const updated = service.getQuizSet(qs.id);
      expect(updated).toBeDefined();
      if (!updated) return;
      expect(updated.name).toBe('New');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updated.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should persist changes', () => {
      const { quizSet: qs } = service.addQuizSet({ name: 'Before', description: '', wordIds: [] });
      service.updateQuizSet(qs.id, { name: 'After' });
      const stored = JSON.parse(localStorage.getItem('vv_quiz_sets') ?? '[]');
      expect(stored[0].name).toBe('After');
    });

    it('should return true on success and false on storage failure', () => {
      const { quizSet: qs } = service.addQuizSet({ name: 'Test', description: '', wordIds: [] });
      expect(service.updateQuizSet(qs.id, { name: 'New' })).toBe(true);

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
      expect(service.updateQuizSet(qs.id, { name: 'Fail' })).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe('deleteQuizSet', () => {
    it('should remove the quiz set', () => {
      const { quizSet: qs } = service.addQuizSet({ name: 'ToDelete', description: '', wordIds: [] });
      expect(service.quizSets().length).toBe(1);
      service.deleteQuizSet(qs.id);
      expect(service.quizSets().length).toBe(0);
    });

    it('should persist deletion', () => {
      const { quizSet: qs } = service.addQuizSet({ name: 'Gone', description: '', wordIds: [] });
      service.deleteQuizSet(qs.id);
      const stored = JSON.parse(localStorage.getItem('vv_quiz_sets') ?? '[]');
      expect(stored.length).toBe(0);
    });

    it('should return true on success and false on storage failure', () => {
      const { quizSet: qs } = service.addQuizSet({ name: 'Test', description: '', wordIds: [] });

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
      expect(service.deleteQuizSet(qs.id)).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe('getQuizSet', () => {
    it('should find by id', () => {
      const { quizSet: qs } = service.addQuizSet({ name: 'Find Me', description: '', wordIds: [] });
      expect(service.getQuizSet(qs.id)?.name).toBe('Find Me');
    });

    it('should return undefined for unknown id', () => {
      expect(service.getQuizSet('nonexistent')).toBeUndefined();
    });
  });

  describe('createTempQuizSet', () => {
    it('should create a temp set with __smart_review__ id by default', () => {
      const temp = service.createTempQuizSet(['w1', 'w2']);
      expect(temp.id).toBe('__smart_review__');
      expect(temp.wordIds).toEqual(['w1', 'w2']);
    });

    it('should be retrievable via getQuizSet', () => {
      service.createTempQuizSet(['w1']);
      const found = service.getQuizSet('__smart_review__');
      expect(found?.name).toBe('Smart Review');
    });

    it('should not be persisted to localStorage', () => {
      service.createTempQuizSet(['w1']);
      const stored = JSON.parse(localStorage.getItem('vv_quiz_sets') ?? '[]');
      expect(stored.length).toBe(0);
    });

    it('should create a temp set with custom id', () => {
      const temp = service.createTempQuizSet(['w1', 'w2', 'w3'], 'Quick Quiz', '__quick_quiz__');
      expect(temp.id).toBe('__quick_quiz__');
      expect(temp.name).toBe('Quick Quiz');
      expect(temp.wordIds).toEqual(['w1', 'w2', 'w3']);
    });

    it('should retrieve any temp set id via getQuizSet', () => {
      service.createTempQuizSet(['w1', 'w2'], 'Quick Quiz', '__quick_quiz__');
      const found = service.getQuizSet('__quick_quiz__');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Quick Quiz');
      expect(found?.wordIds).toEqual(['w1', 'w2']);
    });

    it('should persist temp set to sessionStorage', () => {
      service.createTempQuizSet(['w1'], 'Quick Quiz', '__quick_quiz__');
      const raw = sessionStorage.getItem('vv_temp_quiz_set');
      expect(raw).toBeTruthy();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      expect(parsed.id).toBe('__quick_quiz__');
    });

    it('should not pollute the persisted quiz sets store', () => {
      service.createTempQuizSet(['w1', 'w2'], 'Quick Quiz', '__quick_quiz__');
      expect(service.quizSets().length).toBe(0);
    });
  });

  describe('startQuickQuiz', () => {
    it('should return a quiz set with __quick_quiz__ id', () => {
      wordService.addWord({ word: 'hello', pronunciation: '', definition: 'hi', examples: [] });
      const { quizSet } = service.startQuickQuiz();
      expect(quizSet.id).toBe('__quick_quiz__');
      expect(quizSet.name).toBe('Quick Quiz');
    });

    it('should return a valid quiz mode', () => {
      wordService.addWord({ word: 'hello', pronunciation: '', definition: 'hi', examples: [] });
      const validModes = ['flashcard', 'multiple-choice', 'type', 'match'];
      const { mode } = service.startQuickQuiz();
      expect(validModes).toContain(mode);
    });

    it('should limit word selection to 20', () => {
      for (let i = 0; i < 30; i++) {
        wordService.addWord({ word: `w${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
      }
      const { quizSet } = service.startQuickQuiz();
      expect(quizSet.wordIds.length).toBe(20);
    });

    it('should include all words when fewer than 20 exist', () => {
      for (let i = 0; i < 5; i++) {
        wordService.addWord({ word: `w${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
      }
      const { quizSet } = service.startQuickQuiz();
      expect(quizSet.wordIds.length).toBe(5);
    });

    it('should not include duplicate word IDs', () => {
      for (let i = 0; i < 15; i++) {
        wordService.addWord({ word: `w${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
      }
      const { quizSet } = service.startQuickQuiz();
      const unique = new Set(quizSet.wordIds);
      expect(unique.size).toBe(quizSet.wordIds.length);
    });

    it('should only include IDs that exist in the word list', () => {
      for (let i = 0; i < 5; i++) {
        wordService.addWord({ word: `w${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
      }
      const allIds = wordService.words().map((w) => w.id);
      const { quizSet } = service.startQuickQuiz();
      quizSet.wordIds.forEach((id) => expect(allIds).toContain(id));
    });

    it('should shuffle words (not always original order)', () => {
      for (let i = 0; i < 25; i++) {
        wordService.addWord({ word: `w${String(i).padStart(2, '0')}`, pronunciation: '', definition: `d${i}`, examples: [] });
      }
      const results = Array.from({ length: 5 }, () => service.startQuickQuiz().quizSet.wordIds);
      const allSame = results.every((r) => JSON.stringify(r) === JSON.stringify(results[0]));
      expect(allSame).toBe(false);
    });

    it('should be retrievable via getQuizSet after creation', () => {
      wordService.addWord({ word: 'test', pronunciation: '', definition: 'test', examples: [] });
      service.startQuickQuiz();
      const found = service.getQuizSet('__quick_quiz__');
      expect(found).toBeDefined();
      expect(found?.name).toBe('Quick Quiz');
    });

    it('should work with exactly 1 word', () => {
      const { word } = wordService.addWord({ word: 'solo', pronunciation: '', definition: 'alone', examples: [] });
      const { quizSet } = service.startQuickQuiz();
      expect(quizSet.wordIds).toEqual([word.id]);
    });

    it('should work with exactly 20 words (boundary)', () => {
      for (let i = 0; i < 20; i++) {
        wordService.addWord({ word: `w${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
      }
      const { quizSet } = service.startQuickQuiz();
      expect(quizSet.wordIds.length).toBe(20);
      expect(quizSet.wordIds.sort()).toEqual(wordService.words().map((w) => w.id).sort());
    });
  });

  describe('getSessionWords', () => {
    it('should return all word IDs for small sets (<= 20)', () => {
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        const { word } = wordService.addWord({ word: `w${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
        ids.push(word.id);
      }
      const { quizSet } = service.addQuizSet({ name: 'Small', description: '', wordIds: ids });
      const session = service.getSessionWords(quizSet.id);
      expect(session.length).toBe(10);
      expect(session.sort()).toEqual(ids.sort());
    });

    it('should cap at 20 for large sets', () => {
      const ids: string[] = [];
      for (let i = 0; i < 50; i++) {
        const { word } = wordService.addWord({ word: `w${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
        ids.push(word.id);
      }
      const { quizSet } = service.addQuizSet({ name: 'Large', description: '', wordIds: ids });
      const session = service.getSessionWords(quizSet.id);
      expect(session.length).toBe(20);
    });

    it('should prioritise new and learning words over mastered', () => {
      const newIds: string[] = [];
      const masteredIds: string[] = [];
      for (let i = 0; i < 15; i++) {
        const { word } = wordService.addWord({ word: `new${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
        newIds.push(word.id);
      }
      for (let i = 0; i < 15; i++) {
        const { word } = wordService.addWord({ word: `mastered${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
        wordService.updateWord(word.id, { masteryLevel: MasteryLevel.Mastered });
        masteredIds.push(word.id);
      }
      const allIds = [...newIds, ...masteredIds];
      const { quizSet } = service.addQuizSet({ name: 'Mixed', description: '', wordIds: allIds });
      const session = service.getSessionWords(quizSet.id);
      // All 15 new words should be included (10 from new cap + 5 backfill)
      const newInSession = session.filter((id) => newIds.includes(id));
      expect(newInSession.length).toBeGreaterThanOrEqual(10);
    });

    it('should return empty for unknown quiz set', () => {
      expect(service.getSessionWords('nonexistent')).toEqual([]);
    });

    it('should not return duplicate IDs', () => {
      const ids: string[] = [];
      for (let i = 0; i < 30; i++) {
        const { word } = wordService.addWord({ word: `w${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
        ids.push(word.id);
      }
      const { quizSet } = service.addQuizSet({ name: 'NoDups', description: '', wordIds: ids });
      const session = service.getSessionWords(quizSet.id);
      expect(new Set(session).size).toBe(session.length);
    });
  });

  describe('getSessionInfo', () => {
    it('should report needsChunking false for small sets', () => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const { word } = wordService.addWord({ word: `w${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
        ids.push(word.id);
      }
      const { quizSet } = service.addQuizSet({ name: 'Small', description: '', wordIds: ids });
      const info = service.getSessionInfo(quizSet.id);
      expect(info.needsChunking).toBe(false);
      expect(info.totalWords).toBe(5);
      expect(info.totalSessions).toBe(1);
    });

    it('should report needsChunking true for large sets', () => {
      const ids: string[] = [];
      for (let i = 0; i < 50; i++) {
        const { word } = wordService.addWord({ word: `w${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
        ids.push(word.id);
      }
      const { quizSet } = service.addQuizSet({ name: 'Large', description: '', wordIds: ids });
      const info = service.getSessionInfo(quizSet.id);
      expect(info.needsChunking).toBe(true);
      expect(info.totalWords).toBe(50);
      expect(info.totalSessions).toBe(3);
      expect(info.practicedWords).toBe(0);
    });

    it('should count practiced words correctly', () => {
      const ids: string[] = [];
      for (let i = 0; i < 30; i++) {
        const { word } = wordService.addWord({ word: `w${i}`, pronunciation: '', definition: `d${i}`, examples: [] });
        if (i < 10) wordService.updateWord(word.id, { masteryLevel: MasteryLevel.Learning });
        ids.push(word.id);
      }
      const { quizSet } = service.addQuizSet({ name: 'Partial', description: '', wordIds: ids });
      const info = service.getSessionInfo(quizSet.id);
      expect(info.practicedWords).toBe(10);
    });
  });

  describe('removeWordFromAllQuizSets', () => {
    it('should remove word from all sets containing it', () => {
      service.addQuizSet({ name: 'Set1', description: '', wordIds: ['w1', 'w2'] });
      service.addQuizSet({ name: 'Set2', description: '', wordIds: ['w2', 'w3'] });

      service.removeWordFromAllQuizSets('w2');

      const sets = service.quizSets();
      expect(sets[0].wordIds).toEqual(['w1']);
      expect(sets[1].wordIds).toEqual(['w3']);
    });

    it('should not modify sets that do not contain the word', () => {
      const { quizSet: qs } = service.addQuizSet({ name: 'Untouched', description: '', wordIds: ['w1'] });

      service.removeWordFromAllQuizSets('w99');

      const result = service.getQuizSet(qs.id);
      expect(result?.wordIds).toEqual(['w1']);
    });

    it('should return true on success and false on storage failure', () => {
      service.addQuizSet({ name: 'Set1', description: '', wordIds: ['w1'] });

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
      expect(service.removeWordFromAllQuizSets('w1')).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe('getWordsForQuizSet', () => {
    it('should resolve word IDs to Word objects', () => {
      const { word: w1 } = wordService.addWord({ word: 'hello', pronunciation: '', definition: 'greeting', examples: [] });
      const { word: w2 } = wordService.addWord({ word: 'bye', pronunciation: '', definition: 'farewell', examples: [] });
      const { quizSet: qs } = service.addQuizSet({ name: 'Test', description: '', wordIds: [w1.id, w2.id] });

      const words = service.getWordsForQuizSet(qs.id);
      expect(words.length).toBe(2);
      expect(words[0].word).toBe('hello');
      expect(words[1].word).toBe('bye');
    });

    it('should filter out deleted words', () => {
      const { word: w1 } = wordService.addWord({ word: 'keep', pronunciation: '', definition: 'stay', examples: [] });
      const { word: w2 } = wordService.addWord({ word: 'remove', pronunciation: '', definition: 'gone', examples: [] });
      const { quizSet: qs } = service.addQuizSet({ name: 'Test', description: '', wordIds: [w1.id, w2.id] });

      wordService.deleteWord(w2.id);

      const words = service.getWordsForQuizSet(qs.id);
      expect(words.length).toBe(1);
      expect(words[0].word).toBe('keep');
    });

    it('should return empty array for unknown quiz set', () => {
      expect(service.getWordsForQuizSet('nonexistent')).toEqual([]);
    });
  });

  describe('restoreQuizSet', () => {
    it('re-inserts a deleted quiz set', () => {
      const { quizSet: qs } = service.addQuizSet({ name: 'Restore Me', description: '', wordIds: ['w1'] });
      service.deleteQuizSet(qs.id);
      expect(service.quizSets().length).toBe(0);

      service.restoreQuizSet(qs);

      expect(service.quizSets().length).toBe(1);
      expect(service.quizSets()[0].name).toBe('Restore Me');
    });

    it('persists restored quiz set to storage', () => {
      const { quizSet: qs } = service.addQuizSet({ name: 'Persist Me', description: '', wordIds: [] });
      service.deleteQuizSet(qs.id);
      service.restoreQuizSet(qs);

      const stored = JSON.parse(localStorage.getItem('vv_quiz_sets') ?? '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].name).toBe('Persist Me');
    });
  });

  describe('restoreWordToQuizSets', () => {
    it('re-inserts wordId into specified quiz sets', () => {
      const { quizSet: qs1 } = service.addQuizSet({ name: 'Set1', description: '', wordIds: ['w1', 'w2'] });
      const { quizSet: qs2 } = service.addQuizSet({ name: 'Set2', description: '', wordIds: ['w1', 'w3'] });

      service.removeWordFromAllQuizSets('w1');
      expect(service.getQuizSet(qs1.id)?.wordIds).not.toContain('w1');
      expect(service.getQuizSet(qs2.id)?.wordIds).not.toContain('w1');

      service.restoreWordToQuizSets('w1', [qs1.id, qs2.id]);

      expect(service.getQuizSet(qs1.id)?.wordIds).toContain('w1');
      expect(service.getQuizSet(qs2.id)?.wordIds).toContain('w1');
    });
  });

  describe('orphaned word IDs', () => {
    it('should return only existing words when 1 of 3 has been deleted', () => {
      const { word: w1 } = wordService.addWord({ word: 'alpha', pronunciation: '', definition: 'first', examples: [] });
      const { word: w2 } = wordService.addWord({ word: 'beta', pronunciation: '', definition: 'second', examples: [] });
      const { word: w3 } = wordService.addWord({ word: 'gamma', pronunciation: '', definition: 'third', examples: [] });
      const { quizSet: qs } = service.addQuizSet({ name: 'Orphan Test', description: '', wordIds: [w1.id, w2.id, w3.id] });

      wordService.deleteWord(w2.id);

      const words = service.getWordsForQuizSet(qs.id);
      expect(words.length).toBe(2);
      expect(words.map((w) => w.id)).not.toContain(w2.id);
      expect(words.map((w) => w.word)).toEqual(['alpha', 'gamma']);
    });

    it('should return empty array when all word IDs are orphaned (all deleted)', () => {
      const { word: w1 } = wordService.addWord({ word: 'one', pronunciation: '', definition: 'd1', examples: [] });
      const { word: w2 } = wordService.addWord({ word: 'two', pronunciation: '', definition: 'd2', examples: [] });
      const { word: w3 } = wordService.addWord({ word: 'three', pronunciation: '', definition: 'd3', examples: [] });
      const { quizSet: qs } = service.addQuizSet({ name: 'All Orphaned', description: '', wordIds: [w1.id, w2.id, w3.id] });

      wordService.deleteWord(w1.id);
      wordService.deleteWord(w2.id);
      wordService.deleteWord(w3.id);

      const words = service.getWordsForQuizSet(qs.id);
      expect(words).toEqual([]);
    });

    it('should return empty array for a non-existent quizSetId', () => {
      expect(service.getWordsForQuizSet('non-existent-id-12345')).toEqual([]);
    });
  });
});
