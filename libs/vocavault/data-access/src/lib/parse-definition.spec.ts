import { describe, it, expect } from 'vitest';
import {
  parseDefinition,
  getQuizMeaning,
  getQuizExample,
  formatMeaning,
  stringifyMeanings,
  removeMeaning,
} from './parse-definition';
import { POS_ABBREV_SET, POS_BADGE_CLASSES } from './pos-abbreviations';

describe('parseDefinition', () => {
  it('parses single POS definition', () => {
    const result = parseDefinition('n. a test to measure knowledge');
    expect(result.meanings).toEqual([
      { pos: 'n.', posLabel: 'noun', text: 'a test to measure knowledge' },
    ]);
    expect(result.hasStructure).toBe(true);
  });

  it('parses multi-POS definition with middle dot separator', () => {
    const result = parseDefinition('n. a test \u00B7 v. to carry out a test');
    expect(result.meanings).toHaveLength(2);
    expect(result.meanings[0]).toEqual({
      pos: 'n.',
      posLabel: 'noun',
      text: 'a test',
    });
    expect(result.meanings[1]).toEqual({
      pos: 'v.',
      posLabel: 'verb',
      text: 'to carry out a test',
    });
    expect(result.hasStructure).toBe(true);
  });

  it('handles plain definition without POS prefix', () => {
    const result = parseDefinition('the act of running');
    expect(result.meanings).toEqual([
      { pos: null, posLabel: null, text: 'the act of running' },
    ]);
    expect(result.hasStructure).toBe(false);
  });

  it('returns empty for empty string', () => {
    const result = parseDefinition('');
    expect(result.meanings).toEqual([]);
    expect(result.hasStructure).toBe(false);
  });

  it('returns empty for null/undefined', () => {
    expect(parseDefinition(null).meanings).toEqual([]);
    expect(parseDefinition(undefined).meanings).toEqual([]);
  });

  it('parses three POS segments', () => {
    const result = parseDefinition(
      'n. first meaning \u00B7 adj. second \u00B7 v. third',
    );
    expect(result.meanings).toHaveLength(3);
    expect(result.meanings[0].pos).toBe('n.');
    expect(result.meanings[1].pos).toBe('adj.');
    expect(result.meanings[2].pos).toBe('v.');
  });

  it('handles mixed structured and unstructured segments', () => {
    const result = parseDefinition('n. a noun \u00B7 something else');
    expect(result.meanings[0].pos).toBe('n.');
    expect(result.meanings[1].pos).toBeNull();
    expect(result.hasStructure).toBe(true);
  });

  it('handles whitespace-only input', () => {
    expect(parseDefinition('   ').meanings).toEqual([]);
  });

  it('handles definition text containing sentence periods', () => {
    const result = parseDefinition('n. A test. · v. To evaluate.');
    expect(result.meanings).toHaveLength(2);
    expect(result.meanings[0]).toEqual({
      pos: 'n.',
      posLabel: 'noun',
      text: 'A test.',
    });
    expect(result.meanings[1]).toEqual({
      pos: 'v.',
      posLabel: 'verb',
      text: 'To evaluate.',
    });
  });

  it('handles single word after POS prefix', () => {
    const result = parseDefinition('v. run');
    expect(result.meanings[0]).toEqual({
      pos: 'v.',
      posLabel: 'verb',
      text: 'run',
    });
  });

  it('treats unknown POS prefix as plain text', () => {
    const result = parseDefinition('foo. something here');
    expect(result.meanings[0].pos).toBeNull();
    expect(result.meanings[0].text).toBe('foo. something here');
    expect(result.hasStructure).toBe(false);
  });

  it('handles uppercase POS prefix (case insensitive)', () => {
    const result = parseDefinition('N. Something');
    expect(result.meanings[0].pos).toBe('n.');
    expect(result.meanings[0].text).toBe('Something');
  });

  it('handles appended definitions without POS (user-selected from picker)', () => {
    const result = parseDefinition('First definition · Second definition');
    expect(result.meanings).toHaveLength(2);
    expect(result.meanings[0]).toEqual({
      pos: null,
      posLabel: null,
      text: 'First definition',
    });
    expect(result.meanings[1]).toEqual({
      pos: null,
      posLabel: null,
      text: 'Second definition',
    });
    expect(result.hasStructure).toBe(false);
  });
});

describe('POS_ABBREV_SET', () => {
  it('contains known abbreviations', () => {
    expect(POS_ABBREV_SET.has('n.')).toBe(true);
    expect(POS_ABBREV_SET.has('v.')).toBe(true);
    expect(POS_ABBREV_SET.has('adj.')).toBe(true);
  });

  it('rejects unknown abbreviations', () => {
    expect(POS_ABBREV_SET.has('unknown.')).toBe(false);
  });
});

describe('getQuizMeaning', () => {
  it('returns first meaning when quizMeaningIndex is undefined', () => {
    const word = { definition: 'n. a feline · v. to categorize', quizMeaningIndex: undefined };
    const result = getQuizMeaning(word);
    expect(result).toEqual({ pos: 'n.', posLabel: 'noun', text: 'a feline' });
  });

  it('returns meaning at quizMeaningIndex when set', () => {
    const word = { definition: 'n. a feline · v. to categorize · adj. catlike', quizMeaningIndex: 1 };
    const result = getQuizMeaning(word);
    expect(result).toEqual({ pos: 'v.', posLabel: 'verb', text: 'to categorize' });
  });

  it('falls back to first meaning when index is out of bounds', () => {
    const word = { definition: 'n. a feline · v. to categorize', quizMeaningIndex: 5 };
    const result = getQuizMeaning(word);
    expect(result).toEqual({ pos: 'n.', posLabel: 'noun', text: 'a feline' });
  });

  it('returns fallback for empty definition', () => {
    const word = { definition: '', quizMeaningIndex: undefined };
    const result = getQuizMeaning(word);
    expect(result).toEqual({ pos: null, posLabel: null, text: '' });
  });

  it('returns plain text meaning for unparseable definition', () => {
    const word = { definition: 'just some text', quizMeaningIndex: undefined };
    const result = getQuizMeaning(word);
    expect(result).toEqual({ pos: null, posLabel: null, text: 'just some text' });
  });

  it('defaults quizMeaningIndex to 0 when not present', () => {
    const word = { definition: 'n. first · v. second' } as { definition: string; quizMeaningIndex?: number };
    const result = getQuizMeaning(word);
    expect(result).toEqual({ pos: 'n.', posLabel: 'noun', text: 'first' });
  });
});

describe('getQuizExample', () => {
  it('returns example at quizMeaningIndex', () => {
    const word = { examples: ['first ex', 'second ex', 'third ex'], quizMeaningIndex: 1 };
    expect(getQuizExample(word)).toBe('second ex');
  });

  it('falls back to first example when index is out of bounds', () => {
    const word = { examples: ['first ex', 'second ex'], quizMeaningIndex: 5 };
    expect(getQuizExample(word)).toBe('first ex');
  });

  it('returns undefined when word has no examples', () => {
    const word = { examples: [], quizMeaningIndex: undefined };
    expect(getQuizExample(word)).toBeUndefined();
  });

  it('returns first example when quizMeaningIndex is undefined', () => {
    const word = { examples: ['only ex'], quizMeaningIndex: undefined };
    expect(getQuizExample(word)).toBe('only ex');
  });
});

describe('formatMeaning', () => {
  it('formats meaning with POS prefix', () => {
    expect(formatMeaning({ pos: 'n.', posLabel: 'noun', text: 'a small animal' })).toBe('n. a small animal');
  });

  it('returns just text when POS is null', () => {
    expect(formatMeaning({ pos: null, posLabel: null, text: 'the meaning text' })).toBe('the meaning text');
  });

  it('returns empty string when text is null/undefined', () => {
    expect(formatMeaning({ pos: null, posLabel: null, text: null as unknown as string })).toBe('');
    expect(formatMeaning({ pos: null, posLabel: null, text: undefined as unknown as string })).toBe('');
  });
});

describe('getQuizMeaning null definition safety', () => {
  it('returns empty string text when definition is null', () => {
    const word = { definition: null as unknown as string, quizMeaningIndex: undefined };
    const result = getQuizMeaning(word);
    expect(result).toEqual({ pos: null, posLabel: null, text: '' });
  });

  it('returns empty string text when definition is undefined', () => {
    const word = { definition: undefined as unknown as string, quizMeaningIndex: undefined };
    const result = getQuizMeaning(word);
    expect(result).toEqual({ pos: null, posLabel: null, text: '' });
  });
});

describe('POS_BADGE_CLASSES', () => {
  it('returns blue classes for noun', () => {
    expect(POS_BADGE_CLASSES['n.']).toContain('bg-blue-100');
  });

  it('returns emerald classes for verb', () => {
    expect(POS_BADGE_CLASSES['v.']).toContain('bg-emerald-100');
  });

  it('returns amber classes for adjective', () => {
    expect(POS_BADGE_CLASSES['adj.']).toContain('bg-amber-100');
  });
});

describe('stringifyMeanings', () => {
  it('empty array returns empty string', () => {
    expect(stringifyMeanings([])).toBe('');
  });

  it('single plain meaning round-trips to its text', () => {
    const meanings = parseDefinition('the act of running').meanings;
    expect(stringifyMeanings(meanings)).toBe('the act of running');
  });

  it('POS-prefixed join: round-trips two meanings correctly', () => {
    const input = 'n. a test · v. to carry out a test';
    const meanings = parseDefinition(input).meanings;
    expect(stringifyMeanings(meanings)).toBe(input);
  });
});

describe('removeMeaning', () => {
  it('empty definition returns empty string', () => {
    expect(removeMeaning('', 'a test')).toBe('');
  });

  it('null definition returns empty string', () => {
    expect(removeMeaning(null as unknown as string, 'a test')).toBe('');
  });

  it('undefined definition returns empty string', () => {
    expect(removeMeaning(undefined as unknown as string, 'a test')).toBe('');
  });

  it('single/only meaning removed returns empty string (case-insensitive)', () => {
    expect(removeMeaning('n. A Test', 'a test')).toBe('');
  });

  it('removes first of multiple meanings', () => {
    expect(removeMeaning('n. a test · v. run', 'a test')).toBe('v. run');
  });

  it('removes middle of multiple meanings', () => {
    expect(removeMeaning('n. one · v. two · adj. three', 'two')).toBe('n. one · adj. three');
  });

  it('removes last of multiple meanings', () => {
    expect(removeMeaning('n. one · v. two', 'two')).toBe('n. one');
  });

  it('text not present returns unchanged round-trip', () => {
    expect(removeMeaning('n. one · v. two', 'three')).toBe('n. one · v. two');
  });

  it('case-insensitive and trimmed match', () => {
    expect(removeMeaning('v. To Test · n. other', '  to test ')).toBe('n. other');
  });

  it('POS-prefixed survivor has prefix and capitalization intact', () => {
    expect(removeMeaning('n. A test · v. run', 'run')).toBe('n. A test');
  });

  it('sentence-period segment not mis-split', () => {
    expect(removeMeaning('n. A test. · v. To evaluate.', 'A test.')).toBe('v. To evaluate.');
  });
});

describe('removeMeaning — regression guards', () => {
  it('[RG-FORMAT] duplicate meanings — removes ALL matching (documented choice)', () => {
    expect(removeMeaning('n. dog · v. dog · n. cat', 'dog')).toBe('n. cat');
  });

  it.each([
    'n. a test · v. to carry out a test',
    'First definition · Second definition',
    'n. A test. · v. To evaluate.',
  ])('[RG-FORMAT] round-trip stability: %s', (input) => {
    expect(stringifyMeanings(parseDefinition(input).meanings)).toBe(input);
  });

  it('[RG-FORMAT] parseDefinition unchanged: two POS meanings still parse correctly', () => {
    const result = parseDefinition('n. a test · v. run');
    expect(result.meanings).toHaveLength(2);
    expect(result.meanings[0].pos).toBe('n.');
    expect(result.meanings[1].pos).toBe('v.');
  });
});

describe('getQuizMeaning / getQuizExample after removal — regression guards', () => {
  it('[RG-QUIZ] after removing first meaning, index 0 selects the surviving first meaning', () => {
    const result = removeMeaning('n. a feline · v. to categorize', 'a feline');
    const word = { definition: result, quizMeaningIndex: 0 };
    const meaning = getQuizMeaning(word);
    expect(meaning.pos).toBe('v.');
    expect(meaning.text).toBe('to categorize');
  });

  it('[RG-QUIZ] stale out-of-bounds index stays safe (falls back to index 0, no crash)', () => {
    const word = { definition: 'v. to categorize', quizMeaningIndex: 1 };
    const meaning = getQuizMeaning(word);
    expect(meaning.pos).toBe('v.');
    expect(meaning.text).toBe('to categorize');
  });
});
