// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { ProgressService } from './progress.service';
import { WordService } from './word.service';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { MasteryLevel } from './models';

describe('ProgressService', () => {
  let progressService: ProgressService;
  let wordService: WordService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        WordService,
        ProgressService,
        { provide: StorageService, useClass: LocalStorageService },
      ],
    });
    progressService = TestBed.inject(ProgressService);
    wordService = TestBed.inject(WordService);
  });

  it('should return eloquenceScore of 0 when no words exist', () => {
    expect(progressService.eloquenceScore()).toBe(0);
  });

  it('should return eloquenceScore of 100 when all words are MasteryLevel.Mastered', () => {
    wordService.addWord({
      word: 'test1',
      pronunciation: 'test',
      definition: 'test',
      examples: [],
    });
    wordService.addWord({
      word: 'test2',
      pronunciation: 'test',
      definition: 'test',
      examples: [],
    });

    // Update both to Mastered
    wordService.words().forEach((w) =>
      wordService.updateWord(w.id, { masteryLevel: MasteryLevel.Mastered })
    );

    expect(progressService.eloquenceScore()).toBe(100);
  });

  it('should return masteryDistribution with counts per MasteryLevel', () => {
    wordService.addWord({
      word: 'new-word',
      pronunciation: 'test',
      definition: 'test',
      examples: [],
    });
    const { word: learning } = wordService.addWord({
      word: 'learning-word',
      pronunciation: 'test',
      definition: 'test',
      examples: [],
    });
    wordService.updateWord(learning.id, { masteryLevel: MasteryLevel.Learning });

    const dist = progressService.masteryDistribution();
    expect(dist[MasteryLevel.New]).toBe(1);
    expect(dist[MasteryLevel.Learning]).toBe(1);
    expect(dist[MasteryLevel.Review]).toBe(0);
    expect(dist[MasteryLevel.Mastered]).toBe(0);
  });

  describe('wordsLearned', () => {
    it('should return 0 when no words exist', () => {
      expect(progressService.wordsLearned()).toBe(0);
    });

    it('should count only Review and Mastered words', () => {
      wordService.addWord({ word: 'new', pronunciation: '', definition: 'd', examples: [] });
      const { word: w2 } = wordService.addWord({ word: 'learning', pronunciation: '', definition: 'd', examples: [] });
      const { word: w3 } = wordService.addWord({ word: 'review', pronunciation: '', definition: 'd', examples: [] });
      const { word: w4 } = wordService.addWord({ word: 'mastered', pronunciation: '', definition: 'd', examples: [] });

      wordService.updateWord(w2.id, { masteryLevel: MasteryLevel.Learning });
      wordService.updateWord(w3.id, { masteryLevel: MasteryLevel.Review });
      wordService.updateWord(w4.id, { masteryLevel: MasteryLevel.Mastered });

      expect(progressService.wordsLearned()).toBe(2);
    });
  });

  describe('addResult', () => {
    it('should add a quiz result with generated id and completedAt', () => {
      progressService.addResult({
        quizSetId: 'qs-1',
        score: 8,
        totalQuestions: 10,
        accuracy: 80,
        wordResults: [
          { wordId: 'w1', correct: true },
          { wordId: 'w2', correct: false },
        ],
      });

      expect(progressService.results().length).toBe(1);
      const result = progressService.results()[0];
      expect(result.id).toBeTruthy();
      expect(result.score).toBe(8);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should return true on success', () => {
      const ok = progressService.addResult({
        quizSetId: 'qs-1',
        score: 5,
        totalQuestions: 5,
        accuracy: 100,
        wordResults: [],
      });
      expect(ok).toBe(true);
    });

    it('should return false when storage fails', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const ok = progressService.addResult({
        quizSetId: 'qs-1',
        score: 5,
        totalQuestions: 5,
        accuracy: 100,
        wordResults: [],
      });
      expect(ok).toBe(false);
      vi.restoreAllMocks();
    });

    it('should persist results to localStorage', () => {
      progressService.addResult({
        quizSetId: 'qs-1',
        score: 5,
        totalQuestions: 5,
        accuracy: 100,
        wordResults: [],
      });

      const stored = JSON.parse(localStorage.getItem('vv_quiz_results') ?? '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].score).toBe(5);
    });

    it('should accumulate multiple results', () => {
      progressService.addResult({ quizSetId: 'qs-1', score: 3, totalQuestions: 5, accuracy: 60, wordResults: [] });
      progressService.addResult({ quizSetId: 'qs-2', score: 5, totalQuestions: 5, accuracy: 100, wordResults: [] });
      expect(progressService.results().length).toBe(2);
    });
  });

  describe('getLatestResult', () => {
    it('should return undefined when no results exist', () => {
      expect(progressService.getLatestResult('qs-1')).toBeUndefined();
    });

    it('should return the most recent result for a quiz set', () => {
      progressService.addResult({ quizSetId: 'qs-1', score: 3, totalQuestions: 5, accuracy: 60, wordResults: [] });
      progressService.addResult({ quizSetId: 'qs-2', score: 5, totalQuestions: 5, accuracy: 100, wordResults: [] });
      progressService.addResult({ quizSetId: 'qs-1', score: 4, totalQuestions: 5, accuracy: 80, wordResults: [{ wordId: 'w1', correct: true }] });

      const latest = progressService.getLatestResult('qs-1');
      expect(latest).toBeDefined();
      if (!latest) return;
      expect(latest.score).toBe(4);
      expect(latest.accuracy).toBe(80);
    });

    it('should return undefined for a quiz set with no results', () => {
      progressService.addResult({ quizSetId: 'qs-1', score: 5, totalQuestions: 5, accuracy: 100, wordResults: [] });
      expect(progressService.getLatestResult('qs-other')).toBeUndefined();
    });
  });

  describe('streak edge cases', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const mockResult = { quizSetId: 'qs1', score: 8, totalQuestions: 10, accuracy: 80, wordResults: [] };

    it('streak increments on consecutive days', () => {
      vi.setSystemTime(new Date('2026-06-01T10:00:00Z')); // Monday
      progressService.addResult(mockResult);
      expect(progressService.streak().currentStreak).toBe(1);

      vi.setSystemTime(new Date('2026-06-02T10:00:00Z')); // Tuesday
      progressService.addResult(mockResult);
      expect(progressService.streak().currentStreak).toBe(2);
    });

    it('streak resets to 1 when one day is skipped', () => {
      vi.setSystemTime(new Date('2026-06-01T10:00:00Z')); // Monday
      progressService.addResult(mockResult);
      expect(progressService.streak().currentStreak).toBe(1);

      vi.setSystemTime(new Date('2026-06-03T10:00:00Z')); // Wednesday (skip Tuesday)
      progressService.addResult(mockResult);
      expect(progressService.streak().currentStreak).toBe(1);
    });

    it('streak resets to 1 when two days are skipped', () => {
      vi.setSystemTime(new Date('2026-06-01T10:00:00Z')); // Monday
      progressService.addResult(mockResult);

      vi.setSystemTime(new Date('2026-06-04T10:00:00Z')); // Thursday (skip Tue+Wed)
      progressService.addResult(mockResult);
      expect(progressService.streak().currentStreak).toBe(1);
    });

    it('streak stays same for multiple quizzes on same day (no double-counting)', () => {
      vi.setSystemTime(new Date('2026-06-01T10:00:00Z'));
      progressService.addResult(mockResult);
      expect(progressService.streak().currentStreak).toBe(1);

      progressService.addResult(mockResult);
      expect(progressService.streak().currentStreak).toBe(1);

      progressService.addResult(mockResult);
      expect(progressService.streak().currentStreak).toBe(1);
    });

    it('longestStreak is preserved even when currentStreak resets', () => {
      // Build streak to 5
      vi.setSystemTime(new Date('2026-06-01T10:00:00Z'));
      progressService.addResult(mockResult);
      vi.setSystemTime(new Date('2026-06-02T10:00:00Z'));
      progressService.addResult(mockResult);
      vi.setSystemTime(new Date('2026-06-03T10:00:00Z'));
      progressService.addResult(mockResult);
      vi.setSystemTime(new Date('2026-06-04T10:00:00Z'));
      progressService.addResult(mockResult);
      vi.setSystemTime(new Date('2026-06-05T10:00:00Z'));
      progressService.addResult(mockResult);
      expect(progressService.streak().currentStreak).toBe(5);
      expect(progressService.streak().longestStreak).toBe(5);

      // Skip a day, take quiz -> resets current but preserves longest
      vi.setSystemTime(new Date('2026-06-07T10:00:00Z'));
      progressService.addResult(mockResult);
      expect(progressService.streak().currentStreak).toBe(1);
      expect(progressService.streak().longestStreak).toBe(5);
    });
  });

  describe('weekly snapshot rollover', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps exactly 12 weeks -- adding 13th snapshot drops the oldest', () => {
      // Build 12 snapshots by calling addResult on 12 different weeks
      // Each week needs a different weekStart to trigger maybeSnapshot
      for (let i = 0; i < 12; i++) {
        // Set time to a Monday at week i
        const monday = new Date(2026, 0, 5 + i * 7, 10, 0, 0); // Mondays starting Jan 5
        vi.setSystemTime(monday);
        progressService.addResult({ quizSetId: 'qs1', score: 8, totalQuestions: 10, accuracy: 80, wordResults: [] });
      }

      const snapsBefore = JSON.parse(localStorage.getItem('vv_progress_snapshots') ?? '[]');
      expect(snapsBefore.length).toBe(12);
      const oldestWeekStart = snapsBefore[0].weekStart;

      // Now trigger a 13th week
      const week13Monday = new Date(2026, 0, 5 + 12 * 7, 10, 0, 0);
      vi.setSystemTime(week13Monday);
      progressService.addResult({ quizSetId: 'qs1', score: 8, totalQuestions: 10, accuracy: 80, wordResults: [] });

      const snapsAfter = JSON.parse(localStorage.getItem('vv_progress_snapshots') ?? '[]');
      expect(snapsAfter.length).toBe(12); // Not 13
      // Oldest should be gone
      expect(snapsAfter[0].weekStart).not.toBe(oldestWeekStart);
      // Newest should be the last entry (different from the 12th entry before)
      expect(snapsAfter[snapsAfter.length - 1].weekStart).not.toBe(snapsBefore[snapsBefore.length - 1].weekStart);
    });
  });

  describe('eloquenceScore mixed levels', () => {
    it('should compute weighted average', () => {
      // 1 New (0), 1 Learning (33), 1 Review (66), 1 Mastered (100) = avg 49.75 -> 50
      wordService.addWord({ word: 'a', pronunciation: '', definition: 'd', examples: [] });
      const { word: w2 } = wordService.addWord({ word: 'b', pronunciation: '', definition: 'd', examples: [] });
      const { word: w3 } = wordService.addWord({ word: 'c', pronunciation: '', definition: 'd', examples: [] });
      const { word: w4 } = wordService.addWord({ word: 'd', pronunciation: '', definition: 'd', examples: [] });

      wordService.updateWord(w2.id, { masteryLevel: MasteryLevel.Learning });
      wordService.updateWord(w3.id, { masteryLevel: MasteryLevel.Review });
      wordService.updateWord(w4.id, { masteryLevel: MasteryLevel.Mastered });

      expect(progressService.eloquenceScore()).toBe(50);
    });
  });
});
