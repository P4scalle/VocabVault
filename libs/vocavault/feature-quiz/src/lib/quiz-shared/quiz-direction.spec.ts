import { describe, it, expect, vi } from 'vitest';
import {
  normalizeDirection,
  getPrompt,
  getAnswer,
  getPromptLabel,
  resolveDirection,
  buildQuizItem,
  filterAndNotify,
  COLUMN_LABELS,
} from './quiz-direction';
import { Word, MasteryLevel, DEFAULT_QUIZ_DIRECTION, QuizDirection } from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';

function makeWord(overrides: Partial<Word> = {}): Word {
  return {
    id: '1',
    word: 'cat',
    pronunciation: '/kaet/',
    definition: 'a small animal',
    examples: ['The cat sat'],
    masteryLevel: MasteryLevel.New,
    createdAt: new Date(),
    updatedAt: new Date(),
    interval: 0,
    easeFactor: 2.5,
    reviewCount: 0,
    ...overrides,
  };
}

describe('normalizeDirection', () => {
  it('returns DEFAULT_QUIZ_DIRECTION for undefined', () => {
    expect(normalizeDirection(undefined as unknown as QuizDirection)).toBe(DEFAULT_QUIZ_DIRECTION);
  });

  it('returns DEFAULT_QUIZ_DIRECTION for null', () => {
    expect(normalizeDirection(null as unknown as QuizDirection)).toBe(DEFAULT_QUIZ_DIRECTION);
  });

  it('returns DEFAULT_QUIZ_DIRECTION for empty string', () => {
    expect(normalizeDirection('' as unknown as QuizDirection)).toBe(DEFAULT_QUIZ_DIRECTION);
  });

  it('returns DEFAULT_QUIZ_DIRECTION for garbage value', () => {
    expect(normalizeDirection('garbage' as unknown as QuizDirection)).toBe(DEFAULT_QUIZ_DIRECTION);
  });

  it('passes through definition-to-word unchanged', () => {
    expect(normalizeDirection('definition-to-word')).toBe('definition-to-word');
  });

  it('passes through word-to-definition unchanged', () => {
    expect(normalizeDirection('word-to-definition')).toBe('word-to-definition');
  });

  it('passes through example-to-definition unchanged', () => {
    expect(normalizeDirection('example-to-definition')).toBe('example-to-definition');
  });

  it('passes through mixed unchanged', () => {
    expect(normalizeDirection('mixed')).toBe('mixed');
  });
});

describe('getPrompt', () => {
  const word = makeWord();

  it('returns definition for definition-to-word', () => {
    expect(getPrompt(word, 'definition-to-word')).toBe('a small animal');
  });

  it('returns word for word-to-definition', () => {
    expect(getPrompt(word, 'word-to-definition')).toBe('cat');
  });

  it('returns first example for example-to-definition', () => {
    expect(getPrompt(word, 'example-to-definition')).toBe('The cat sat');
  });

  it('falls back to definition when no examples for example-to-definition', () => {
    const noEx = makeWord({ examples: [] });
    expect(getPrompt(noEx, 'example-to-definition')).toBe('a small animal');
  });

  it('falls back to DEFAULT_QUIZ_DIRECTION (definition) for undefined direction', () => {
    // DEFAULT is definition-to-word: prompt = the definition
    expect(getPrompt(word, undefined as unknown as QuizDirection)).toBe('a small animal');
  });

  it('falls back to DEFAULT_QUIZ_DIRECTION (definition) for empty string direction', () => {
    expect(getPrompt(word, '' as unknown as QuizDirection)).toBe('a small animal');
  });

  it('falls back to DEFAULT_QUIZ_DIRECTION (definition) for garbage direction', () => {
    expect(getPrompt(word, 'garbage' as unknown as QuizDirection)).toBe('a small animal');
  });
});

describe('getAnswer', () => {
  const word = makeWord();

  it('returns word for definition-to-word', () => {
    expect(getAnswer(word, 'definition-to-word')).toBe('cat');
  });

  it('returns definition for word-to-definition', () => {
    expect(getAnswer(word, 'word-to-definition')).toBe('a small animal');
  });

  it('returns definition for example-to-definition', () => {
    expect(getAnswer(word, 'example-to-definition')).toBe('a small animal');
  });

  it('falls back to DEFAULT_QUIZ_DIRECTION (word) for undefined direction', () => {
    // DEFAULT is definition-to-word: answer = the word
    expect(getAnswer(word, undefined as unknown as QuizDirection)).toBe('cat');
  });

  it('falls back to DEFAULT_QUIZ_DIRECTION (word) for garbage direction', () => {
    expect(getAnswer(word, 'garbage' as unknown as QuizDirection)).toBe('cat');
  });
});

describe('getPromptLabel', () => {
  it('returns correct label for definition-to-word', () => {
    expect(getPromptLabel('definition-to-word')).toBe('What word matches this definition?');
  });

  it('returns correct label for word-to-definition', () => {
    expect(getPromptLabel('word-to-definition')).toBe('What is the definition of');
  });

  it('returns correct label for example-to-definition', () => {
    expect(getPromptLabel('example-to-definition')).toBe('What is the definition for this example?');
  });

  it('falls back to definition-to-word label for mixed', () => {
    expect(getPromptLabel('mixed')).toBe('What word matches this definition?');
  });
});

describe('resolveDirection', () => {
  const word = makeWord();
  const wordNoExamples = makeWord({ examples: [] });

  it('returns the direction as-is when not mixed', () => {
    expect(resolveDirection(word, 'definition-to-word')).toBe('definition-to-word');
    expect(resolveDirection(word, 'word-to-definition')).toBe('word-to-definition');
    expect(resolveDirection(word, 'example-to-definition')).toBe('example-to-definition');
  });

  it('returns a random valid direction for mixed with examples', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    expect(resolveDirection(word, 'mixed')).toBe('definition-to-word');

    vi.spyOn(Math, 'random').mockReturnValue(0.34);
    expect(resolveDirection(word, 'mixed')).toBe('word-to-definition');

    vi.spyOn(Math, 'random').mockReturnValue(0.67);
    expect(resolveDirection(word, 'mixed')).toBe('example-to-definition');

    vi.restoreAllMocks();
  });

  it('returns DEFAULT_QUIZ_DIRECTION for undefined direction', () => {
    expect(resolveDirection(word, undefined as unknown as QuizDirection)).toBe(DEFAULT_QUIZ_DIRECTION);
  });

  it('excludes example-to-definition for words without examples in mixed mode', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const result = resolveDirection(wordNoExamples, 'mixed');
    expect(result).not.toBe('example-to-definition');
    expect(['definition-to-word', 'word-to-definition']).toContain(result);
    vi.restoreAllMocks();
  });
});

describe('buildQuizItem', () => {
  const word = makeWord();

  it('returns correct composite for definition-to-word', () => {
    const item = buildQuizItem(word, 'definition-to-word');
    expect(item.prompt).toBe('a small animal');
    expect(item.answer).toBe('cat');
    expect(item.promptLabel).toBe('What word matches this definition?');
    expect(item.resolvedDirection).toBe('definition-to-word');
    expect(item.word).toBe(word);
  });

  it('returns correct composite for word-to-definition', () => {
    const item = buildQuizItem(word, 'word-to-definition');
    expect(item.prompt).toBe('cat');
    expect(item.answer).toBe('a small animal');
    expect(item.resolvedDirection).toBe('word-to-definition');
  });

  it('resolves mixed direction before building', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const item = buildQuizItem(word, 'mixed');
    expect(item.resolvedDirection).toBe('definition-to-word');
    vi.restoreAllMocks();
  });

  it('prompt !== answer for definition-to-word (word !== definition)', () => {
    const item = buildQuizItem(word, 'definition-to-word');
    expect(item.prompt).not.toBe(item.answer);
  });

  it('prompt !== answer for word-to-definition (word !== definition)', () => {
    const item = buildQuizItem(word, 'word-to-definition');
    expect(item.prompt).not.toBe(item.answer);
  });

  it('prompt !== answer for example-to-definition (example !== definition)', () => {
    const item = buildQuizItem(word, 'example-to-definition');
    expect(item.prompt).not.toBe(item.answer);
  });
});

describe('getPrompt (single meaning)', () => {
  it('returns formatted single meaning for definition-to-word on multi-meaning word', () => {
    const word = makeWord({ definition: 'n. a feline · v. to categorize' });
    expect(getPrompt(word, 'definition-to-word')).toBe('n. a feline');
  });

  it('uses quizMeaningIndex to select second meaning', () => {
    const word = makeWord({ definition: 'n. a feline · v. to categorize', quizMeaningIndex: 1 });
    expect(getPrompt(word, 'definition-to-word')).toBe('v. to categorize');
  });

  it('returns quiz example for example-to-definition with quizMeaningIndex=1', () => {
    const word = makeWord({
      definition: 'n. a feline · v. to categorize',
      examples: ['The cat sat', 'Categorize these items'],
      quizMeaningIndex: 1,
    });
    expect(getPrompt(word, 'example-to-definition')).toBe('Categorize these items');
  });

  it('falls back to formatted meaning when no examples for example-to-definition', () => {
    const word = makeWord({ definition: 'n. a feline', examples: [] });
    expect(getPrompt(word, 'example-to-definition')).toBe('n. a feline');
  });
});

describe('getAnswer (single meaning)', () => {
  it('returns formatted single meaning for word-to-definition on multi-meaning word', () => {
    const word = makeWord({ definition: 'n. a feline · v. to categorize' });
    expect(getAnswer(word, 'word-to-definition')).toBe('n. a feline');
  });

  it('uses quizMeaningIndex to select second meaning in answer', () => {
    const word = makeWord({ definition: 'n. a feline · v. to categorize', quizMeaningIndex: 1 });
    expect(getAnswer(word, 'word-to-definition')).toBe('v. to categorize');
  });

  it('returns formatted single meaning for example-to-definition', () => {
    const word = makeWord({ definition: 'n. a feline · v. to categorize', quizMeaningIndex: 1 });
    expect(getAnswer(word, 'example-to-definition')).toBe('v. to categorize');
  });
});

describe('buildQuizItem (single meaning)', () => {
  it('uses single meaning in prompt/answer for multi-meaning word', () => {
    const word = makeWord({ definition: 'n. a feline · v. to categorize' });
    const item = buildQuizItem(word, 'definition-to-word');
    expect(item.prompt).toBe('n. a feline');
    expect(item.answer).toBe('cat');
  });
});

describe('filterAndNotify', () => {
  const withExamples = makeWord({ id: '1', examples: ['ex1'] });
  const noExamples = makeWord({ id: '2', examples: [] });
  const mockToast = { show: vi.fn() } as unknown as ToastService;

  it('returns all words unchanged for definition-to-word', () => {
    const result = filterAndNotify([withExamples, noExamples], 'definition-to-word', mockToast);
    expect(result).toHaveLength(2);
    expect(mockToast.show).not.toHaveBeenCalled();
  });

  it('returns all words unchanged for word-to-definition', () => {
    mockToast.show.mockClear();
    const result = filterAndNotify([withExamples, noExamples], 'word-to-definition', mockToast);
    expect(result).toHaveLength(2);
    expect(mockToast.show).not.toHaveBeenCalled();
  });

  it('filters words without examples for example-to-definition', () => {
    mockToast.show.mockClear();
    const result = filterAndNotify([withExamples, noExamples], 'example-to-definition', mockToast);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(withExamples);
  });

  it('shows toast with skip count for example-to-definition', () => {
    mockToast.show.mockClear();
    filterAndNotify([withExamples, noExamples], 'example-to-definition', mockToast);
    expect(mockToast.show).toHaveBeenCalledWith('1 word skipped (no examples)');
  });

  it('does not show toast when no words are skipped', () => {
    mockToast.show.mockClear();
    filterAndNotify([withExamples], 'example-to-definition', mockToast);
    expect(mockToast.show).not.toHaveBeenCalled();
  });
});

describe('COLUMN_LABELS', () => {
  it('has correct labels for definition-to-word', () => {
    expect(COLUMN_LABELS['definition-to-word']).toEqual({ left: 'Definitions', right: 'Words' });
  });

  it('has correct labels for word-to-definition', () => {
    expect(COLUMN_LABELS['word-to-definition']).toEqual({ left: 'Words', right: 'Definitions' });
  });

  it('has correct labels for example-to-definition', () => {
    expect(COLUMN_LABELS['example-to-definition']).toEqual({ left: 'Examples', right: 'Definitions' });
  });
});
