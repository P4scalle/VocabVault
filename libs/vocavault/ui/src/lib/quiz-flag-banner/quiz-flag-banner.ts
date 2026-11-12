import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';

@Component({
  selector: 'lib-quiz-flag-banner',
  imports: [],
  templateUrl: './quiz-flag-banner.html',
  styleUrl: './quiz-flag-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizFlagBanner {
  /** Current word ID being displayed in the quiz */
  readonly wordId = input.required<string>();
  /** Current word label to display */
  readonly wordLabel = input<string>('');
  /** Set of flagged word IDs -- two-way binding with parent */
  readonly flaggedIds = model.required<Set<string>>();
  /** Emitted when a flag is toggled (wordId, isFlagged) */
  readonly flagToggled = output<{ wordId: string; flagged: boolean }>();

  protected readonly isFlagged = computed(() =>
    this.flaggedIds().has(this.wordId())
  );

  protected toggle(): void {
    const id = this.wordId();
    const current = this.flaggedIds();
    const next = new Set(current);
    const wasFlagged = next.has(id);
    if (wasFlagged) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.flaggedIds.set(next);
    this.flagToggled.emit({ wordId: id, flagged: !wasFlagged });
  }
}
