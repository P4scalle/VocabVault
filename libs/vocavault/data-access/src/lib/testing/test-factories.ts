import { Word, MasteryLevel, SR_DEFAULTS, QuizSet, Folder, QuizResult, FOLDER_COLORS } from '../models';

export function makeWord(overrides?: Partial<Word>): Word {
  return {
    id: crypto.randomUUID(),
    word: 'test',
    pronunciation: '',
    definition: 'a test word',
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

export function makeQuizSet(overrides?: Partial<QuizSet>): QuizSet {
  return {
    id: crypto.randomUUID(),
    name: 'Test Quiz',
    description: '',
    wordIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeFolder(overrides?: Partial<Folder>): Folder {
  return {
    id: crypto.randomUUID(),
    name: 'Test Folder',
    color: FOLDER_COLORS[0],
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeQuizResult(overrides?: Partial<QuizResult>): QuizResult {
  return {
    id: crypto.randomUUID(),
    quizSetId: 'qs-1',
    score: 5,
    totalQuestions: 10,
    accuracy: 50,
    wordResults: [],
    completedAt: new Date(),
    ...overrides,
  };
}

export function stubMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => { /* mock: no-op */ },
      removeListener: () => { /* mock: no-op */ },
      addEventListener: () => { /* mock: no-op */ },
      removeEventListener: () => { /* mock: no-op */ },
      dispatchEvent: () => false,
    }),
  });
}
