import {
  Directive,
  ElementRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

const MIN_SWIPE_DISTANCE = 50;

@Directive({
  selector: '[libSwipeable]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerCancel()',
  },
})
export class SwipeableDirective {
  private readonly el = inject(ElementRef);

  readonly axis = input<'horizontal' | 'vertical'>('horizontal');
  readonly swiped = output<SwipeDirection>();
  readonly swipeProgress = output<number>();

  private startX = 0;
  private startY = 0;
  private tracking = false;

  constructor() {
    effect(() => {
      this.el.nativeElement.style.touchAction =
        this.axis() === 'vertical' ? 'pan-x' : 'pan-y';
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.tracking = true;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.tracking) return;

    const deltaX = event.clientX - this.startX;
    const deltaY = event.clientY - this.startY;

    const isVertical = this.axis() === 'vertical';
    const primaryDelta = isVertical ? deltaY : deltaX;
    const crossDelta = isVertical ? deltaX : deltaY;

    // Cancel if cross-axis movement exceeds primary axis (user is scrolling)
    if (Math.abs(crossDelta) > Math.abs(primaryDelta) && Math.abs(crossDelta) > 10) {
      this.tracking = false;
      this.swipeProgress.emit(0);
      return;
    }

    const progress = Math.min(Math.abs(primaryDelta) / MIN_SWIPE_DISTANCE, 1);
    this.swipeProgress.emit(primaryDelta > 0 ? progress : -progress);
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.tracking) return;
    this.tracking = false;

    const deltaX = event.clientX - this.startX;
    const deltaY = event.clientY - this.startY;

    const isVertical = this.axis() === 'vertical';
    const primaryDelta = isVertical ? deltaY : deltaX;
    const crossDelta = isVertical ? deltaX : deltaY;

    this.swipeProgress.emit(0);

    if (Math.abs(primaryDelta) > MIN_SWIPE_DISTANCE && Math.abs(primaryDelta) > Math.abs(crossDelta)) {
      if (isVertical) {
        this.swiped.emit(primaryDelta > 0 ? 'down' : 'up');
      } else {
        this.swiped.emit(primaryDelta > 0 ? 'right' : 'left');
      }
    }
  }

  protected onPointerCancel(): void {
    if (!this.tracking) return;
    this.tracking = false;
    this.swipeProgress.emit(0);
  }
}
