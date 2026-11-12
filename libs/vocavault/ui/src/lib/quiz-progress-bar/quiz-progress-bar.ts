import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'lib-quiz-progress-bar',
  imports: [],
  templateUrl: './quiz-progress-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizProgressBar {
  readonly label = input<string>('');
  readonly current = input.required<number>();
  readonly total = input.required<number>();

  protected readonly pct = computed(() => {
    const t = this.total();
    if (t <= 0) return 0;
    const raw = (this.current() / t) * 100;
    return Math.max(0, Math.min(100, isNaN(raw) ? 0 : raw));
  });
}
