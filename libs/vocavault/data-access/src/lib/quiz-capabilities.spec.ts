import { describe, it, expect } from 'vitest';
import {
  quizCapabilities,
  pickQuickQuiz,
  playableWordCount,
  viableModesForDirection,
  EXAMPLE_DIRECTION_MIN_WORDS,
  QUIZ_MODE_MIN_WORDS,
} from './quiz-capabilities';
import { makeWord } from './testing/test-factories';
import { Word } from './models';

const plainWords = (n: number): Word[] => Array.from({ length: n }, () => makeWord());
const exampleWords = (n: number): Word[] =>
  Array.from({ length: n }, (_, i) => makeWord({ examples: [`example ${i}`] }));

describe('playableWordCount', () => {
  it('counts the whole set for non-example directions', () => {
    const words = [...plainWords(2), ...exampleWords(1)];
    expect(playableWordCount(words, 'definition-to-word')).toBe(3);
    expect(playableWordCount(words, 'word-to-definition')).toBe(3);
    expect(playableWordCount(words, 'mixed')).toBe(3);
  });

  it('counts only words with examples for example-to-definition', () => {
    const words = [...plainWords(5), ...exampleWords(2)];
    expect(playableWordCount(words, 'example-to-definition')).toBe(2);
  });
});

describe('quizCapabilities', () => {
  it('returns nothing for an empty dictionary', () => {
    const caps = quizCapabilities([]);
    expect(caps.modes).toEqual([]);
    expect(caps.directions).toEqual([]);
    expect(caps.pairs).toEqual([]);
  });

  it('offers only flashcard/type (and non-example directions) for a single word', () => {
    const caps = quizCapabilities(plainWords(1));
    expect(caps.modes).toEqual(['flashcard', 'type']);
    expect(caps.directions).toEqual(['definition-to-word', 'word-to-definition', 'mixed']);
    expect(caps.directions).not.toContain('example-to-definition');
  });

  it('adds multiple-choice and match once the word count clears their minimum', () => {
    const caps = quizCapabilities(plainWords(QUIZ_MODE_MIN_WORDS.match));
    expect(caps.modes).toEqual(['flashcard', 'multiple-choice', 'type', 'match']);
  });

  it('does not offer match/multiple-choice just below their minimum', () => {
    const caps = quizCapabilities(plainWords(QUIZ_MODE_MIN_WORDS.match - 1));
    expect(caps.modes).not.toContain('match');
    expect(caps.modes).not.toContain('multiple-choice');
  });

  it('hides example-to-definition when too few words have examples', () => {
    const words = [...plainWords(10), ...exampleWords(EXAMPLE_DIRECTION_MIN_WORDS - 1)];
    expect(quizCapabilities(words).directions).not.toContain('example-to-definition');
  });

  it('offers example-to-definition at the threshold, but not for modes needing more example words', () => {
    // Exactly the example minimum (3), which is below the match/MC minimum (4).
    const words = [...plainWords(20), ...exampleWords(EXAMPLE_DIRECTION_MIN_WORDS)];
    const caps = quizCapabilities(words);
    expect(caps.directions).toContain('example-to-definition');
    // match/MC are viable for the roomy non-example directions...
    expect(caps.pairs).toContainEqual({ mode: 'match', direction: 'definition-to-word' });
    // ...but never paired with example-to-definition, which only has 3 playable words.
    expect(caps.pairs).not.toContainEqual({ mode: 'match', direction: 'example-to-definition' });
    expect(caps.pairs).not.toContainEqual({ mode: 'multiple-choice', direction: 'example-to-definition' });
    expect(caps.pairs).toContainEqual({ mode: 'flashcard', direction: 'example-to-definition' });
  });

  it('every reported pair is self-consistent (mode viable for its direction)', () => {
    const words = [...plainWords(6), ...exampleWords(4)];
    for (const { mode, direction } of quizCapabilities(words).pairs) {
      expect(viableModesForDirection(words, direction)).toContain(mode);
    }
  });
});

describe('pickQuickQuiz', () => {
  it('returns null when no quiz is possible', () => {
    expect(pickQuickQuiz([], () => 0)).toBeNull();
  });

  it('is deterministic given a fixed rng (first pair at rng=0)', () => {
    const words = plainWords(1);
    const { pairs } = quizCapabilities(words);
    expect(pickQuickQuiz(words, () => 0)).toEqual(pairs[0]);
  });

  it('selects the last pair as rng approaches 1', () => {
    const words = [...plainWords(6), ...exampleWords(4)];
    const { pairs } = quizCapabilities(words);
    expect(pickQuickQuiz(words, () => 0.999999)).toEqual(pairs[pairs.length - 1]);
  });

  it('can never return a degenerate pair, across the whole rng range', () => {
    // A dictionary with just enough example words to expose the cross-constraint.
    const words = [...plainWords(10), ...exampleWords(EXAMPLE_DIRECTION_MIN_WORDS)];
    for (let r = 0; r < 1; r += 0.05) {
      const pick = pickQuickQuiz(words, () => r);
      expect(pick).not.toBeNull();
      // match/MC must never be paired with the 3-example direction.
      const degenerate =
        !!pick &&
        (pick.mode === 'match' || pick.mode === 'multiple-choice') &&
        pick.direction === 'example-to-definition';
      expect(degenerate).toBe(false);
    }
  });
});
