import { QuizMode } from './models';

export interface QuizModeInfo {
  label: string;
  value: QuizMode;
  iconClass: string;
  colorClass: string;
}

export const QUIZ_MODES: readonly QuizModeInfo[] = [
  { label: 'Flashcard', value: 'flashcard', iconClass: 'pi pi-clone', colorClass: 'bg-violet-100 text-violet-700' },
  { label: 'Multiple Choice', value: 'multiple-choice', iconClass: 'pi pi-list-check', colorClass: 'bg-blue-100 text-blue-700' },
  { label: 'Write', value: 'type', iconClass: 'pi pi-pencil', colorClass: 'bg-amber-100 text-amber-700' },
  { label: 'Match', value: 'match', iconClass: 'pi pi-arrow-right-arrow-left', colorClass: 'bg-emerald-100 text-emerald-700' },
] as const;

export const QUIZ_MODE_MAP: Record<string, QuizModeInfo> = Object.fromEntries(
  QUIZ_MODES.map((m) => [m.value, m])
);
