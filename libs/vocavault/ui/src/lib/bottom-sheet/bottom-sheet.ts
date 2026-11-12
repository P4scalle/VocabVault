import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
  signal,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { acquireScrollLock, releaseScrollLock } from '../scroll-lock/scroll-lock';
import { SwipeableDirective } from '../swipe/swipeable.directive';

const MAX_DRAG_PX = 300;

@Component({
  selector: 'lib-bottom-sheet',
  templateUrl: './bottom-sheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SwipeableDirective, A11yModule],
  host: {
    '(document:keydown.escape)': 'close()',
  },
})
export class BottomSheet {
  private readonly doc = inject(DOCUMENT);
  readonly visible = model<boolean>(false);

  protected readonly dragOffset = signal(0);
  protected readonly dragging = signal(false);

  constructor() {
    effect((onCleanup) => {
      if (this.visible()) {
        acquireScrollLock(this.doc);
        onCleanup(() => releaseScrollLock(this.doc));
      }
    });
  }

  close(): void {
    this.dragOffset.set(0);
    this.dragging.set(false);
    this.visible.set(false);
  }

  protected onSwipeProgress(progress: number): void {
    const clamped = Math.max(0, progress);
    this.dragging.set(clamped > 0);
    this.dragOffset.set(clamped * MAX_DRAG_PX);
  }

  protected onSwiped(direction: string): void {
    if (direction === 'down') {
      this.close();
    }
  }

  protected get panelTransform(): string {
    const offset = this.dragOffset();
    return offset > 0 ? `translateY(${offset}px)` : '';
  }
}
