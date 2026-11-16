import { QuizDirection, QuizMode, Word } from './models';

/**
 * Minimum number of *playable* words a mode needs to be a meaningful quiz.
 *
 * - flashcard / type work with a single word.
 * - multiple-choice needs enough words to build real distractors.
 * - match needs enough words that pairing isn't trivial.
 */
export const QUIZ_MODE_MIN_WORDS: Record<QuizMode, number> = {
  flashcard: 1,
  type: 1,
  'multiple-choice': 4,
  match: 4,
};

/**
 * A word can be played in the example-based direction only when it is fully
 * complete: it has a term, a definition, and at least one example. The example
 * direction is all-or-nothing (see `directionOfferable`) — rather than silently
 * dropping incomplete words, we only offer it when every word qualifies.
 */
export function hasExamplePlayableContent(word: Word): boolean {
  return (
    word.word.trim().length > 0 &&
    word.definition.trim().length > 0 &&
    word.examples.length > 0
  );
}

const ALL_MODES: readonly QuizMode[] = ['flashcard', 'multiple-choice', 'type', 'match'];
const ALL_DIRECTIONS: readonly QuizDirection[] = [
  'definition-to-word',
  'word-to-definition',
  'example-to-definition',
  'mixed',
];

/**
 * How many of `words` are actually playable in `direction`. The example-based
 * direction can only use words that have an example; every other direction can
 * use the whole set.
 */
export function playableWordCount(words: Word[], direction: QuizDirection): number {
  if (direction === 'example-to-definition') {
    return words.filter(hasExamplePlayableContent).length;
  }
  return words.length;
}

/** Whether a direction clears its own minimum to be offered at all. */
function directionOfferable(words: Word[], direction: QuizDirection): boolean {
  if (direction === 'example-to-definition') {
    // All-or-nothing: offer only when EVERY word is complete (term + definition +
    // example), so no word is ever silently excluded from an example quiz.
    return words.length > 0 && words.every(hasExamplePlayableContent);
  }
  return words.length >= 1;
}

/**
 * The modes that are viable for a given direction, accounting for the fact that
 * the direction may shrink the effective word count (e.g. example-based play).
 */
export function viableModesForDirection(words: Word[], direction: QuizDirection): QuizMode[] {
  if (!directionOfferable(words, direction)) return [];
  const playable = playableWordCount(words, direction);
  return ALL_MODES.filter((mode) => playable >= QUIZ_MODE_MIN_WORDS[mode]);
}

export interface QuizCapabilities {
  /** Modes viable for at least one offerable direction. */
  modes: QuizMode[];
  /** Directions that support at least one viable mode. */
  directions: QuizDirection[];
  /** Every fully-viable (mode, direction) combination for this word set. */
  pairs: { mode: QuizMode; direction: QuizDirection }[];
}

/**
 * Single source of truth for "what quizzes make sense for this word set".
 *
 * Returns only combinations that will produce a real quiz, so that no launcher
 * can offer — and no user can reach — a crashing or degenerate quiz (e.g. a
 * 1-item match, a single-option multiple-choice, or an example quiz with no
 * examples). Every launcher derives its options from this.
 */
export function quizCapabilities(words: Word[]): QuizCapabilities {
  const pairs: { mode: QuizMode; direction: QuizDirection }[] = [];
  for (const direction of ALL_DIRECTIONS) {
    for (const mode of viableModesForDirection(words, direction)) {
      pairs.push({ mode, direction });
    }
  }
  return {
    modes: ALL_MODES.filter((mode) => pairs.some((p) => p.mode === mode)),
    directions: ALL_DIRECTIONS.filter((direction) => pairs.some((p) => p.direction === direction)),
    pairs,
  };
}

/**
 * Pick a random, always-viable (mode, direction) pair for Quick Quiz.
 * Returns null only when no quiz is possible (e.g. an empty dictionary).
 * `rng` is injectable so the choice is deterministic in tests.
 */
export function pickQuickQuiz(
  words: Word[],
  rng: () => number = Math.random,
): { mode: QuizMode; direction: QuizDirection } | null {
  const { pairs } = quizCapabilities(words);
  if (pairs.length === 0) return null;
  return pairs[Math.floor(rng() * pairs.length)];
}
