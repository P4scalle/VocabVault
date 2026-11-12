import { TestBed } from '@angular/core/testing';
import { SpacedRepetitionService } from './spaced-repetition.service';
import {
  Word,
  MasteryLevel,
  SR_DEFAULTS,
  SR_EASE_MIN,
  SR_EASE_MAX,
  SR_NEW_WORDS_PER_DAY,
} from './models';

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: 'w1',
    word: 'test',
    pronunciation: 'test',
    definition: 'test def',
    examples: [],
    masteryLevel: MasteryLevel.New,
    createdAt: new Date(),
    updatedAt: new Date(),
    interval: SR_DEFAULTS.interval,
    easeFactor: SR_DEFAULTS.easeFactor,
    reviewCount: SR_DEFAULTS.reviewCount,
    ...overrides,
  };
}

describe('SpacedRepetitionService', () => {
  let service: SpacedRepetitionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SpacedRepetitionService],
    });
    service = TestBed.inject(SpacedRepetitionService);
  });

  describe('calculateNextReview', () => {
    it('first correct answer on new word produces interval=1, easeFactor=2.5, reviewCount=1', () => {
      const word = makeWord({ interval: 0, easeFactor: 2.5, reviewCount: 0 });
      const result = service.calculateNextReview(word, true);

      expect(result.interval).toBe(1);
      expect(result.easeFactor).toBe(2.5);
      expect(result.reviewCount).toBe(1);
    });

    it('second correct answer (interval=1) produces interval=3, easeFactor=2.5', () => {
      const word = makeWord({ interval: 1, easeFactor: 2.5, reviewCount: 1 });
      const result = service.calculateNextReview(word, true);

      expect(result.interval).toBe(3);
      expect(result.easeFactor).toBe(2.5);
    });

    it('third correct answer (interval=3) produces interval=7', () => {
      const word = makeWord({ interval: 3, easeFactor: 2.5, reviewCount: 2 });
      const result = service.calculateNextReview(word, true);

      expect(result.interval).toBe(7);
    });

    it('wrong answer resets interval to 1 and decreases easeFactor by 0.2', () => {
      const word = makeWord({ interval: 7, easeFactor: 2.5, reviewCount: 3 });
      const result = service.calculateNextReview(word, false);

      expect(result.interval).toBe(1);
      expect(result.easeFactor).toBe(2.3);
    });

    it('wrong answer on easeFactor=1.3 keeps easeFactor at 1.3 (floor)', () => {
      const word = makeWord({ interval: 3, easeFactor: SR_EASE_MIN, reviewCount: 2 });
      const result = service.calculateNextReview(word, false);

      expect(result.interval).toBe(1);
      expect(result.easeFactor).toBe(SR_EASE_MIN);
    });

    it('correct answer increases easeFactor by 0.1 but caps at 2.5', () => {
      const word = makeWord({ interval: 14, easeFactor: 2.4, reviewCount: 3 });
      const result = service.calculateNextReview(word, true);

      expect(result.easeFactor).toBe(SR_EASE_MAX);
    });

    it('nextReviewDate is set to now + interval days', () => {
      const before = new Date();
      const word = makeWord({ interval: 0, easeFactor: 2.5, reviewCount: 0 });
      const result = service.calculateNextReview(word, true);
      const after = new Date();

      // interval=1 day, so nextReviewDate should be ~1 day from now
      const expectedMin = new Date(before.getTime() + 1 * 24 * 60 * 60 * 1000);
      const expectedMax = new Date(after.getTime() + 1 * 24 * 60 * 60 * 1000);

      expect(result.nextReviewDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(result.nextReviewDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    it('lastReviewedAt is set to current time', () => {
      const before = new Date();
      const word = makeWord();
      const result = service.calculateNextReview(word, true);
      const after = new Date();

      expect(result.lastReviewedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.lastReviewedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getWordsDueForReview', () => {
    it('returns words where nextReviewDate <= now', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const words = [makeWord({ id: 'w1', nextReviewDate: pastDate })];
      const due = service.getWordsDueForReview(words);

      expect(due.length).toBe(1);
      expect(due[0].id).toBe('w1');
    });

    it('excludes words where nextReviewDate is in the future', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const words = [makeWord({ id: 'w1', nextReviewDate: futureDate })];
      const due = service.getWordsDueForReview(words);

      expect(due.length).toBe(0);
    });

    it('includes words with no nextReviewDate (never reviewed = immediately due)', () => {
      const words = [makeWord({ id: 'w1', nextReviewDate: undefined })];
      const due = service.getWordsDueForReview(words);

      expect(due.length).toBe(1);
    });

    it('results sorted: returning by nextReviewDate ascending, then new words', () => {
      const oldest = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const words = [
        makeWord({ id: 'recent', nextReviewDate: recent }),
        makeWord({ id: 'oldest', nextReviewDate: oldest }),
        makeWord({ id: 'never', nextReviewDate: undefined }),
      ];
      const due = service.getWordsDueForReview(words);

      expect(due[0].id).toBe('oldest');
      expect(due[1].id).toBe('recent');
      expect(due[2].id).toBe('never');
    });

    it('returns empty array when no words are due', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const words = [
        makeWord({ id: 'w1', nextReviewDate: futureDate }),
        makeWord({ id: 'w2', nextReviewDate: futureDate }),
      ];
      const due = service.getWordsDueForReview(words);

      expect(due.length).toBe(0);
    });

    // Note: incomplete word filtering is the caller's responsibility via WordService.quizzableWords()
  });

  describe('date boundary edge cases', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('past-due word: calculateNextReview bases nextReviewDate from now, not old overdue date', () => {
      vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
      const word = makeWord({
        nextReviewDate: new Date('2026-05-01T00:00:00Z'), // 31 days ago
        interval: 7,
        easeFactor: 2.5,
        reviewCount: 5,
      });

      const result = service.calculateNextReview(word, true);
      const now = new Date('2026-06-01T12:00:00Z');

      expect(result.interval).toBe(Math.round(7 * 2.5)); // 18
      expect(result.nextReviewDate.getTime()).toBeGreaterThan(now.getTime());
      // nextReviewDate should be ~18 days from now, not from 2026-05-01
      const expectedMs = now.getTime() + 18 * 24 * 60 * 60 * 1000;
      expect(result.nextReviewDate.getTime()).toBe(expectedMs);
    });

    it('midnight boundary: calculateNextReview at 23:59:59.999 produces valid future date', () => {
      vi.setSystemTime(new Date('2026-06-01T23:59:59.999Z'));
      const word = makeWord({ interval: 3, easeFactor: 2.5, reviewCount: 2 });

      const result = service.calculateNextReview(word, true);
      const now = new Date('2026-06-01T23:59:59.999Z');

      expect(result.nextReviewDate.getTime()).toBeGreaterThan(now.getTime());
      expect(result.nextReviewDate).toBeInstanceOf(Date);
      expect(isNaN(result.nextReviewDate.getTime())).toBe(false);
    });

    it('far-future word (2099): calculateNextReview bases nextReviewDate from now, not from 2099', () => {
      vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
      const word = makeWord({
        nextReviewDate: new Date('2099-01-01T00:00:00Z'),
        interval: 30,
        easeFactor: 2.5,
        reviewCount: 6,
      });

      const result = service.calculateNextReview(word, true);
      const now = new Date('2026-06-01T12:00:00Z');

      expect(result.interval).toBe(Math.round(30 * 2.5)); // 75
      expect(result.nextReviewDate.getTime()).toBeGreaterThan(now.getTime());
      // Should be ~75 days from now (2026), not from 2099
      expect(result.nextReviewDate.getFullYear()).toBe(2026);
    });

    it('getWordsDueForReview includes words with undefined nextReviewDate (never reviewed)', () => {
      vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
      const words = [
        makeWord({ id: 'never-reviewed', nextReviewDate: undefined }),
      ];

      const due = service.getWordsDueForReview(words);
      expect(due.length).toBe(1);
      expect(due[0].id).toBe('never-reviewed');
    });

    it('getWordsDueForReview includes words with nextReviewDate exactly now (boundary)', () => {
      const now = new Date('2026-06-01T12:00:00Z');
      vi.setSystemTime(now);
      const words = [
        makeWord({ id: 'exact-now', nextReviewDate: new Date('2026-06-01T12:00:00Z') }),
      ];

      const due = service.getWordsDueForReview(words);
      expect(due.length).toBe(1);
      expect(due[0].id).toBe('exact-now');
    });

    it('getWordsDueForReview excludes words with nextReviewDate 1 day in the future', () => {
      vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
      const words = [
        makeWord({ id: 'future', nextReviewDate: new Date('2026-06-02T12:00:00Z') }),
      ];

      const due = service.getWordsDueForReview(words);
      expect(due.length).toBe(0);
    });

  });

  describe('getDueCount', () => {
    it('returns count matching getWordsDueForReview length', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const words = [
        makeWord({ id: 'w1', nextReviewDate: pastDate }),
        makeWord({ id: 'w2', nextReviewDate: undefined }),
        makeWord({ id: 'w3', nextReviewDate: futureDate }),
      ];

      expect(service.getDueCount(words)).toBe(2);
      expect(service.getDueCount(words)).toBe(service.getWordsDueForReview(words).length);
    });

  });

  describe('daily pacing', () => {
    it('caps new words at SR_NEW_WORDS_PER_DAY', () => {
      const words = Array.from({ length: 30 }, (_, i) =>
        makeWord({
          id: `new-${i}`,
          nextReviewDate: undefined,
          createdAt: new Date(Date.now() - (30 - i) * 60000),
        })
      );

      const due = service.getWordsDueForReview(words);
      expect(due.length).toBe(SR_NEW_WORDS_PER_DAY);
      expect(service.getDueCount(words)).toBe(SR_NEW_WORDS_PER_DAY);
    });

    it('returning reviews are never capped', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const words = Array.from({ length: 50 }, (_, i) =>
        makeWord({
          id: `ret-${i}`,
          nextReviewDate: pastDate,
          reviewCount: 2,
        })
      );

      const due = service.getWordsDueForReview(words);
      expect(due.length).toBe(50);
      expect(service.getDueCount(words)).toBe(50);
    });

    it('mixed returning + new respects both rules', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const returning = Array.from({ length: 10 }, (_, i) =>
        makeWord({
          id: `ret-${i}`,
          nextReviewDate: pastDate,
          reviewCount: 2,
        })
      );
      const newWords = Array.from({ length: 30 }, (_, i) =>
        makeWord({
          id: `new-${i}`,
          nextReviewDate: undefined,
          createdAt: new Date(Date.now() - (30 - i) * 60000),
        })
      );

      const words = [...returning, ...newWords];
      const due = service.getWordsDueForReview(words);
      expect(due.length).toBe(30); // 10 returning + 20 new
      expect(service.getDueCount(words)).toBe(30);
    });

    it('new words ordered FIFO by createdAt', () => {
      const words = [
        makeWord({ id: 'newest', nextReviewDate: undefined, createdAt: new Date('2026-05-19') }),
        makeWord({ id: 'oldest', nextReviewDate: undefined, createdAt: new Date('2026-05-15') }),
        makeWord({ id: 'middle', nextReviewDate: undefined, createdAt: new Date('2026-05-17') }),
        makeWord({ id: 'recent', nextReviewDate: undefined, createdAt: new Date('2026-05-18') }),
        makeWord({ id: 'early', nextReviewDate: undefined, createdAt: new Date('2026-05-16') }),
      ];

      const due = service.getWordsDueForReview(words);
      expect(due.map((w) => w.id)).toEqual([
        'oldest',
        'early',
        'middle',
        'recent',
        'newest',
      ]);
    });

    it('consumed budget reduces available new words', () => {
      const today = new Date();
      today.setHours(6, 0, 0, 0);

      const consumedWords = Array.from({ length: 5 }, (_, i) =>
        makeWord({
          id: `consumed-${i}`,
          reviewCount: 1,
          lastReviewedAt: today,
          nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // future, not due
          interval: 1,
        })
      );
      const newWords = Array.from({ length: 25 }, (_, i) =>
        makeWord({
          id: `new-${i}`,
          nextReviewDate: undefined,
          createdAt: new Date(Date.now() - (25 - i) * 60000),
        })
      );

      const words = [...consumedWords, ...newWords];
      const due = service.getWordsDueForReview(words);
      expect(due.length).toBe(15); // 20 - 5 consumed = 15 budget
      expect(service.getDueCount(words)).toBe(15);
    });

    it('getQueuedCount returns overflow', () => {
      const words = Array.from({ length: 50 }, (_, i) =>
        makeWord({
          id: `new-${i}`,
          nextReviewDate: undefined,
        })
      );

      expect(service.getQueuedCount(words)).toBe(30); // 50 - 20
    });

    it('getQueuedCount returns 0 when under budget', () => {
      const words = Array.from({ length: 10 }, (_, i) =>
        makeWord({
          id: `new-${i}`,
          nextReviewDate: undefined,
        })
      );

      expect(service.getQueuedCount(words)).toBe(0);
    });

    it('yesterday consumed budget does not affect today', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(14, 0, 0, 0);

      const consumedYesterday = Array.from({ length: 5 }, (_, i) =>
        makeWord({
          id: `consumed-${i}`,
          reviewCount: 1,
          lastReviewedAt: yesterday,
          nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          interval: 1,
        })
      );
      const newWords = Array.from({ length: 25 }, (_, i) =>
        makeWord({
          id: `new-${i}`,
          nextReviewDate: undefined,
          createdAt: new Date(Date.now() - (25 - i) * 60000),
        })
      );

      const words = [...consumedYesterday, ...newWords];
      const due = service.getWordsDueForReview(words);
      expect(due.length).toBe(SR_NEW_WORDS_PER_DAY); // full budget, yesterday doesn't count
    });
  });

  // ── returning-sort comparator edge behavior ─────────────────
  // The sort comparator uses `new Date(a.nextReviewDate ?? 0)`. In the normal
  // flow a word with a missing nextReviewDate is routed to the new-words bucket,
  // so the `?? 0` fallback is a defensive, deterministic choice: a missing date
  // maps to the epoch and therefore sorts most-overdue-first. (The pre-lint `!`
  // produced Invalid Date -> NaN, yielding a non-deterministic ordering.)
  describe('returning-sort fallback for missing nextReviewDate', () => {
    // Reconstruct the exact comparator used in getWordsDueForReview so we can
    // drive a missing date through the returning sort directly.
    const comparator = (a: Word, b: Word) =>
      new Date(a.nextReviewDate ?? 0).getTime() -
      new Date(b.nextReviewDate ?? 0).getTime();

    it('sorts a word with missing nextReviewDate most-overdue-first (epoch), deterministically', () => {
      const overdue = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const returning = [
        makeWord({ id: 'recent', nextReviewDate: recent }),
        makeWord({ id: 'missing', nextReviewDate: undefined }),
        makeWord({ id: 'overdue', nextReviewDate: overdue }),
      ];

      const sorted = [...returning].sort(comparator).map((w) => w.id);

      // epoch (missing) < overdue < recent -> missing is most-overdue-first
      expect(sorted).toEqual(['missing', 'overdue', 'recent']);

      // Deterministic: the result does not depend on initial input order.
      const reversed = [...returning].reverse().sort(comparator).map((w) => w.id);
      expect(reversed).toEqual(['missing', 'overdue', 'recent']);
    });

    it('getWordsDueForReview keeps due returning words most-overdue-first', () => {
      const oldest = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const words = [
        makeWord({ id: 'recent', nextReviewDate: recent }),
        makeWord({ id: 'oldest', nextReviewDate: oldest }),
      ];

      const due = service.getWordsDueForReview(words).map((w) => w.id);
      expect(due).toEqual(['oldest', 'recent']);
    });
  });
});
