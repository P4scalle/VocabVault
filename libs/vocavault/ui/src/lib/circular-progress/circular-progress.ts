import { afterNextRender, ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

@Component({
  selector: 'lib-circular-progress',
  imports: [],
  templateUrl: './circular-progress.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CircularProgress {
  readonly value = input.required<number>();
  readonly max = input<number>(100);
  readonly size = input<number>(140);
  readonly strokeWidth = input<number>(18);
  readonly color = input<string>('var(--vv-color-brand, #3A7CA5)');
  readonly trackColor = input<string>('var(--vv-track-color, #A2C4C9)');

  protected readonly animated = signal(false);

  protected readonly viewBox = computed(() => `0 0 ${this.size()} ${this.size()}`);
  protected readonly center = computed(() => this.size() / 2);
  protected readonly radius = computed(() => this.center() - this.strokeWidth());
  protected readonly circumference = computed(() => 2 * Math.PI * this.radius());
  protected readonly innerRadius = computed(() => Math.max(0, this.radius() - this.strokeWidth() - 8));

  protected readonly dashOffset = computed(() => {
    if (!this.animated()) return this.circumference();
    const pct = this.max() > 0 ? this.value() / this.max() : 0;
    return this.circumference() - pct * this.circumference();
  });

  constructor() {
    afterNextRender(() => {
      requestAnimationFrame(() => this.animated.set(true));
    });
  }
}
