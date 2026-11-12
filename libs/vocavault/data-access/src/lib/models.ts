export enum MasteryLevel {
  New = 'new',
  Learning = 'learning',
  Review = 'review',
  Mastered = 'mastered',
}

export type FlagReason = 'confusing' | 'wrong' | 'needs-context' | 'too-easy';

export interface WordFlag {
  reason?: FlagReason;
  flaggedAt: Date;
}

export interface Word {
  id: string;
  word: string;
  pronunciation: string;
  definition: string;
  examples: string[];
  folderId?: string;
  incomplete?: boolean;
  flag?: WordFlag;
  quizMeaningIndex?: number;
  masteryLevel: MasteryLevel;
  createdAt: Date;
  updatedAt: Date;
  lastReviewedAt?: Date;
  nextReviewDate?: Date;
  interval: number;
  easeFactor: number;
  reviewCount: number;
}

export interface SpacedRepetitionUpdate {
  lastReviewedAt: Date;
  nextReviewDate: Date;
  interval: number;
  easeFactor: number;
  reviewCount: number;
}

export const SR_DEFAULTS = {
  interval: 0,
  easeFactor: 2.5,
  reviewCount: 0,
} as const;

export const SR_INITIAL_INTERVALS = [1, 3, 7, 14, 30] as const;
export const SR_EASE_MIN = 1.3;
export const SR_EASE_MAX = 2.5;
export const SR_EASE_STEP = 0.1;
export const SR_EASE_PENALTY = 0.2;

/** Max new (never-reviewed) words introduced per day. Anki-proven default. */
export const SR_NEW_WORDS_PER_DAY = 20;

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}

import { PRESET_COLORS, PRESET_COLOR_NAMES } from '@vocavault/util';

/** Domain alias — re-exports the single source of truth from @vocavault/util */
export const FOLDER_COLORS = PRESET_COLORS;
export const FOLDER_COLOR_NAMES = PRESET_COLOR_NAMES;

export type QuizSetSource = 'import' | 'manual';

export interface QuizSet {
  id: string;
  name: string;
  description: string;
  wordIds: string[];
  source?: QuizSetSource;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizResult {
  id: string;
  quizSetId: string;
  score: number;
  totalQuestions: number;
  accuracy: number;
  wordResults: Array<{ wordId: string; correct: boolean }>;
  direction?: QuizDirection;
  completedAt: Date;
}

export type QuizMode = 'flashcard' | 'multiple-choice' | 'type' | 'match';

export const QUIZ_MODE_LABELS: Record<QuizMode, string> = {
  flashcard: 'Flashcard',
  'multiple-choice': 'Multiple Choice',
  type: 'Type / Write',
  match: 'Match',
};

export type QuizDirection = 'definition-to-word' | 'word-to-definition' | 'example-to-definition' | 'mixed';

export const QUIZ_DIRECTION_LABELS: Record<QuizDirection, string> = {
  'definition-to-word': 'Definition \u2192 Word',
  'word-to-definition': 'Word \u2192 Definition',
  'example-to-definition': 'Example \u2192 Definition',
  'mixed': 'Mixed',
};

export const DEFAULT_QUIZ_DIRECTION: QuizDirection = 'definition-to-word';

export interface MasteryConfig {
  label: string;
  color: string;
  badgeClass: string;
}

export const MASTERY_CONFIG: Record<MasteryLevel, MasteryConfig> = {
  [MasteryLevel.New]: { label: 'New', color: '#F4C89F', badgeClass: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
  [MasteryLevel.Learning]: { label: 'Learning', color: '#F4A89F', badgeClass: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' },
  [MasteryLevel.Review]: { label: 'Review', color: '#A8D4A8', badgeClass: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  [MasteryLevel.Mastered]: { label: 'Mastered', color: '#7FC4D9', badgeClass: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
};

export interface QuizResultsState {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: string[];
  mode: QuizMode;
  direction?: QuizDirection;
  flaggedWordIds?: string[];
}

export const MASTERY_WEIGHTS: Record<MasteryLevel, number> = {
  [MasteryLevel.New]: 0,
  [MasteryLevel.Learning]: 33,
  [MasteryLevel.Review]: 66,
  [MasteryLevel.Mastered]: 100,
} as const;

export const TEMP_QUIZ_ID = '__smart_review__' as const;

export const MASTERY_PROGRESSION: Record<MasteryLevel, MasteryLevel> = {
  [MasteryLevel.New]: MasteryLevel.Learning,
  [MasteryLevel.Learning]: MasteryLevel.Review,
  [MasteryLevel.Review]: MasteryLevel.Mastered,
  [MasteryLevel.Mastered]: MasteryLevel.Mastered,
};

export const MASTERY_REGRESSION: Record<MasteryLevel, MasteryLevel> = {
  [MasteryLevel.New]: MasteryLevel.Learning,
  [MasteryLevel.Learning]: MasteryLevel.Learning,
  [MasteryLevel.Review]: MasteryLevel.Learning,
  [MasteryLevel.Mastered]: MasteryLevel.Review,
};

export interface Environment {
  envName: string;
  production: boolean;
  apiBaseUrl: string;
  persistenceMode: 'action';
  sentryDsn: string;
}
