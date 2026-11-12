import { Word, QuizDirection, DEFAULT_QUIZ_DIRECTION, formatMeaning, getQuizMeaning, getQuizExample } from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';

const VALID_DIRECTIONS: readonly QuizDirection[] = [
  'definition-to-word',
  'word-to-definition',
  'example-to-definition',
  'mixed',
];

/** Coerces any invalid/undefined direction to DEFAULT_QUIZ_DIRECTION */
export function normalizeDirection(direction: QuizDirection): QuizDirection {
  return VALID_DIRECTIONS.includes(direction) ? direction : DEFAULT_QUIZ_DIRECTION;
}

export function getPromptLabel(direction: QuizDirection): string {
  const normalized = normalizeDirection(direction);
  const labels: Record<string, string> = {
    'definition-to-word': 'What word matches this definition?',
    'word-to-definition': 'What is the definition of',
    'example-to-definition': 'What is the definition for this example?',
  };
  return labels[normalized] ?? labels['definition-to-word'];
}

export function getPrompt(word: Word, direction: QuizDirection): string {
  const normalized = normalizeDirection(direction);
  switch (normalized) {
    case 'word-to-definition':
      return word.word;
    case 'example-to-definition':
      return getQuizExample(word) ?? formatMeaning(getQuizMeaning(word));
    case 'definition-to-word':
      return formatMeaning(getQuizMeaning(word));
    case 'mixed':
      return formatMeaning(getQuizMeaning(word));
  }
}

export function getAnswer(word: Word, direction: QuizDirection): string {
  const normalized = normalizeDirection(direction);
  switch (normalized) {
    case 'definition-to-word':
      return word.word;
    case 'word-to-definition':
      return formatMeaning(getQuizMeaning(word));
    case 'example-to-definition':
      return formatMeaning(getQuizMeaning(word));
    case 'mixed':
      return formatMeaning(getQuizMeaning(word));
  }
}

/** For mixed mode: pick a random valid direction for a given word */
export function resolveDirection(
  word: Word,
  direction: QuizDirection
): Exclude<QuizDirection, 'mixed'> {
  const normalized = normalizeDirection(direction);
  if (normalized !== 'mixed') return normalized as Exclude<QuizDirection, 'mixed'>;
  const candidates: Array<Exclude<QuizDirection, 'mixed'>> = [
    'definition-to-word',
    'word-to-definition',
  ];
  if (word.examples.length > 0) candidates.push('example-to-definition');
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export interface QuizItem {
  word: Word;
  prompt: string;
  answer: string;
  promptLabel: string;
  resolvedDirection: Exclude<QuizDirection, 'mixed'>;
}

/** Build a single quiz item with prompt/answer resolved for a direction */
export function buildQuizItem(word: Word, direction: QuizDirection): QuizItem {
  const resolved = resolveDirection(word, direction);
  return {
    word,
    prompt: getPrompt(word, resolved),
    answer: getAnswer(word, resolved),
    promptLabel: getPromptLabel(resolved),
    resolvedDirection: resolved,
  };
}

/** Filter words valid for a direction + show toast if any were skipped */
export function filterAndNotify(
  words: Word[],
  direction: QuizDirection,
  toast: ToastService
): Word[] {
  if (direction !== 'example-to-definition') return words;
  const filtered = words.filter((w) => w.examples.length > 0);
  const skipped = words.length - filtered.length;
  if (skipped > 0) {
    toast.show(`${skipped} word${skipped !== 1 ? 's' : ''} skipped (no examples)`);
  }
  return filtered;
}

/** Column labels for Match quiz -- data-driven, no switch statement needed */
export const COLUMN_LABELS: Record<
  Exclude<QuizDirection, 'mixed'>,
  { left: string; right: string }
> = {
  'definition-to-word': { left: 'Definitions', right: 'Words' },
  'word-to-definition': { left: 'Words', right: 'Definitions' },
  'example-to-definition': { left: 'Examples', right: 'Definitions' },
};
