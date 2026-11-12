import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MasteryLevel, MASTERY_CONFIG, QuizService, QuizSet } from '@vocavault/data-access';
import { HoldButton } from '@vocavault/ui';

interface MasterySegment {
  level: MasteryLevel;
  count: number;
  pct: number;
  color: string;
  label: string;
}

const SEGMENT_COLORS: Record<MasteryLevel, string> = {
  [MasteryLevel.New]: 'bg-slate-300 dark:bg-slate-500',
  [MasteryLevel.Learning]: 'bg-amber-400 dark:bg-amber-500',
  [MasteryLevel.Review]: 'bg-blue-400 dark:bg-blue-500',
  [MasteryLevel.Mastered]: 'bg-emerald-400 dark:bg-emerald-500',
};

@Component({
  selector: 'lib-quiz-set-card',
  imports: [HoldButton],
  templateUrl: './quiz-set-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizSetCard {
  private readonly quizService = inject(QuizService);

  readonly quizSet = input.required<QuizSet>();
  readonly selected = output<QuizSet>();
  readonly deleteRequested = output<QuizSet>();

  protected readonly playableCount = computed(() => {
    const words = this.quizService.getWordsForQuizSet(this.quizSet().id);
    return words.filter(w => !w.incomplete).length;
  });

  protected readonly masteryAriaLabel = computed(
    () => 'Mastery: ' + this.masterySegments().map((s) => s.label).join(', '),
  );

  protected readonly masterySegments = computed((): MasterySegment[] => {
    const words = this.quizService.getWordsForQuizSet(this.quizSet().id);
    if (words.length === 0) return [];

    const counts: Record<MasteryLevel, number> = {
      [MasteryLevel.New]: 0,
      [MasteryLevel.Learning]: 0,
      [MasteryLevel.Review]: 0,
      [MasteryLevel.Mastered]: 0,
    };
    words.forEach((w) => counts[w.masteryLevel]++);

    const total = words.length;
    return [MasteryLevel.Mastered, MasteryLevel.Review, MasteryLevel.Learning, MasteryLevel.New]
      .filter((level) => counts[level] > 0)
      .map((level) => ({
        level,
        count: counts[level],
        pct: (counts[level] / total) * 100,
        color: SEGMENT_COLORS[level],
        label: `${MASTERY_CONFIG[level].label}: ${counts[level]}`,
      }));
  });

  protected onCardClick(): void {
    this.selected.emit(this.quizSet());
  }
}
