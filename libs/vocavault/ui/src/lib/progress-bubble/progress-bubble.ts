import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'lib-progress-bubble',
  imports: [],
  templateUrl: './progress-bubble.html',
  styleUrl: './progress-bubble.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBubble {
  readonly value = input.required<number>();
  readonly max = input<number>(100);
  readonly color = input<string>('#3A7CA5');
  readonly label = input<string>('');
  readonly size = input<number>(64);

  private readonly destroyRef = inject(DestroyRef);
  private readonly bubble = viewChild<ElementRef<HTMLElement>>('bubble');

  /** Toggled by IntersectionObserver: true when bubble is in viewport */
  protected readonly filled = signal(false);

  protected readonly pct = computed(() => {
    const m = this.max();
    return m > 0 ? Math.min(100, (this.value() / m) * 100) : 0;
  });

  constructor() {
    afterNextRender(() => {
      const el = this.bubble()?.nativeElement;
      if (!el) return;

      const observer = new IntersectionObserver(
        (entries) => this.filled.set(entries[0].isIntersecting),
        { threshold: 0.5 }
      );
      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
