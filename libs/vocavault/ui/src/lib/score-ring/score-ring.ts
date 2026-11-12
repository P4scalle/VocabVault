import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { animatedValue } from '@vocavault/util';
import { CircularProgress } from '../circular-progress/circular-progress';

@Component({
  selector: 'lib-score-ring',
  imports: [CircularProgress],
  templateUrl: './score-ring.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreRing {
  readonly value = input.required<number>();
  readonly max = input<number>(100);
  readonly size = input<number>(140);
  readonly strokeWidth = input<number>(18);
  readonly suffix = input<string>('');

  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly visible = signal(false);
  protected readonly animated = animatedValue(this.value, { trigger: this.visible });

  constructor() {
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            this.visible.set(true);
            observer.disconnect();
          }
        },
        { threshold: 0.3 }
      );
      observer.observe(this.host.nativeElement);
    });
  }
}
