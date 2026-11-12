import { Injectable } from '@angular/core';
import {
  Word,
  SpacedRepetitionUpdate,
  SR_INITIAL_INTERVALS,
  SR_EASE_MIN,
  SR_EASE_MAX,
  SR_EASE_STEP,
  SR_EASE_PENALTY,
  SR_NEW_WORDS_PER_DAY,
} from './models';

@Injectable({ providedIn: 'root' })
export class SpacedRepetitionService {
  calculateNextReview(word: Word, correct: boolean): SpacedRepetitionUpdate {
    const now = new Date();
    let interval: number;
    let easeFactor: number;

    if (correct) {
      if (word.reviewCount < SR_INITIAL_INTERVALS.length) {
        interval = SR_INITIAL_INTERVALS[word.reviewCount];
      } else {
        interval = Math.round(word.interval * word.easeFactor);
      }
      easeFactor = Math.min(SR_EASE_MAX, word.easeFactor + SR_EASE_STEP);
    } else {
      interval = 1;
      easeFactor = Math.max(SR_EASE_MIN, word.easeFactor - SR_EASE_PENALTY);
    }

    const nextReviewDate = new Date(
      now.getTime() + interval * 24 * 60 * 60 * 1000
    );

    return {
      lastReviewedAt: now,
      nextReviewDate,
      interval,
      easeFactor,
      reviewCount: word.reviewCount + 1,
    };
  }

  /** Returns words due for review: all returning + capped new words per day */
  getWordsDueForReview(words: Word[]): Word[] {
    const nowMs = Date.now();

    const returning: Word[] = [];
    const newWords: Word[] = [];

    for (const w of words) {
      if (w.nextReviewDate) {
        if (new Date(w.nextReviewDate).getTime() <= nowMs) {
          returning.push(w);
        }
      } else {
        newWords.push(w);
      }
    }

    // Sort returning by nextReviewDate ascending (most overdue first).
    // `?? 0` maps a missing date to the epoch so it sorts most-overdue-first
    // deterministically. (The pre-lint `!` yielded Invalid Date -> NaN, which
    // makes the comparator non-deterministic.) A returning word should always
    // have a nextReviewDate, so this is a defensive, order-stable fallback.
    returning.sort(
      (a, b) =>
        new Date(a.nextReviewDate ?? 0).getTime() -
        new Date(b.nextReviewDate ?? 0).getTime()
    );

    // Sort new words FIFO by createdAt (oldest import first)
    newWords.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const budget = this.getNewWordBudget(words);
    const cappedNew = newWords.slice(0, budget);

    return [...returning, ...cappedNew];
  }

  /** Count only — applies same daily cap as getWordsDueForReview */
  getDueCount(words: Word[]): number {
    const nowMs = Date.now();
    let returningCount = 0;
    let newCount = 0;

    for (const w of words) {
      if (w.nextReviewDate) {
        if (new Date(w.nextReviewDate).getTime() <= nowMs) returningCount++;
      } else {
        newCount++;
      }
    }

    const budget = this.getNewWordBudget(words);
    return returningCount + Math.min(newCount, budget);
  }

  /** Count new words waiting beyond today's daily budget */
  getQueuedCount(words: Word[]): number {
    let newCount = 0;
    for (const w of words) {
      if (!w.nextReviewDate) newCount++;
    }
    const budget = this.getNewWordBudget(words);
    return Math.max(0, newCount - budget);
  }

  /**
   * Calculate how many new words can still be introduced today.
   * A word counts as "consumed today" if reviewCount === 1
   * and lastReviewedAt is today (first review happened today).
   */
  private getNewWordBudget(words: Word[]): number {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    let consumedToday = 0;
    for (const w of words) {
      if (
        w.reviewCount === 1 &&
        w.lastReviewedAt &&
        new Date(w.lastReviewedAt).getTime() >= todayMs
      ) {
        consumedToday++;
      }
    }

    return Math.max(0, SR_NEW_WORDS_PER_DAY - consumedToday);
  }
}
