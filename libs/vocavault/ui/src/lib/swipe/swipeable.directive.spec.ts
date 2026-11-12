import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwipeableDirective, SwipeDirection } from './swipeable.directive';

// ── Test host ────────────────────────────────────────────────

@Component({
  template: `<div
    libSwipeable
    [axis]="axis()"
    (swiped)="lastSwiped = $event"
    (swipeProgress)="lastProgress = $event"
  ></div>`,
  imports: [SwipeableDirective],
})
class TestHost {
  readonly axis = signal<'horizontal' | 'vertical'>('horizontal');
  lastSwiped: SwipeDirection | null = null;
  lastProgress = 0;
}

// ── Helpers ──────────────────────────────────────────────────

function pointer(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, {
    clientX: x,
    clientY: y,
    pointerId: 1,
    bubbles: true,
  });
}

function swipeGesture(
  el: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): void {
  el.dispatchEvent(pointer('pointerdown', startX, startY));
  el.dispatchEvent(pointer('pointermove', endX, endY));
  el.dispatchEvent(pointer('pointerup', endX, endY));
}

// ── Tests ────────────────────────────────────────────────────

describe('SwipeableDirective', () => {
  let host: TestHost;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    host = fixture.componentInstance;
    el = fixture.nativeElement.querySelector('[libSwipeable]');
  });

  // ── Horizontal axis (default, backward compat) ─────────

  describe('axis=horizontal (default)', () => {
    it('emits "left" for left swipe exceeding threshold', () => {
      swipeGesture(el, 200, 100, 100, 100);
      expect(host.lastSwiped).toBe('left');
    });

    it('emits "right" for right swipe exceeding threshold', () => {
      swipeGesture(el, 100, 100, 200, 100);
      expect(host.lastSwiped).toBe('right');
    });

    it('does not emit for movement below threshold', () => {
      swipeGesture(el, 100, 100, 130, 100);
      expect(host.lastSwiped).toBeNull();
    });

    it('cancels tracking when vertical movement exceeds horizontal', () => {
      el.dispatchEvent(pointer('pointerdown', 100, 100));
      el.dispatchEvent(pointer('pointermove', 105, 150));
      expect(host.lastProgress).toBe(0);

      el.dispatchEvent(pointer('pointerup', 200, 150));
      expect(host.lastSwiped).toBeNull();
    });

    it('has touch-action pan-y', () => {
      expect(el.style.touchAction).toBe('pan-y');
    });
  });

  // ── Vertical axis ──────────────────────────────────────

  describe('axis=vertical', () => {
    beforeEach(() => {
      host.axis.set('vertical');
      TestBed.flushEffects();
    });

    it('emits "down" for downward swipe exceeding threshold', () => {
      swipeGesture(el, 100, 100, 100, 200);
      expect(host.lastSwiped).toBe('down');
    });

    it('emits "up" for upward swipe exceeding threshold', () => {
      swipeGesture(el, 100, 200, 100, 100);
      expect(host.lastSwiped).toBe('up');
    });

    it('does not emit for movement below threshold', () => {
      swipeGesture(el, 100, 100, 100, 130);
      expect(host.lastSwiped).toBeNull();
    });

    it('cancels tracking when horizontal movement exceeds vertical', () => {
      el.dispatchEvent(pointer('pointerdown', 100, 100));
      el.dispatchEvent(pointer('pointermove', 150, 105));
      expect(host.lastProgress).toBe(0);

      el.dispatchEvent(pointer('pointerup', 150, 200));
      expect(host.lastSwiped).toBeNull();
    });

    it('has touch-action pan-x', () => {
      expect(el.style.touchAction).toBe('pan-x');
    });
  });

  // ── swipeProgress emission ─────────────────────────────

  describe('swipeProgress', () => {
    it('emits normalized progress during horizontal move', () => {
      el.dispatchEvent(pointer('pointerdown', 100, 100));
      el.dispatchEvent(pointer('pointermove', 125, 100));
      expect(host.lastProgress).toBeCloseTo(0.5, 1);
    });

    it('emits negative progress for leftward horizontal move', () => {
      el.dispatchEvent(pointer('pointerdown', 100, 100));
      el.dispatchEvent(pointer('pointermove', 75, 100));
      expect(host.lastProgress).toBeCloseTo(-0.5, 1);
    });

    it('emits normalized progress during vertical move', () => {
      host.axis.set('vertical');
      TestBed.flushEffects();

      el.dispatchEvent(pointer('pointerdown', 100, 100));
      el.dispatchEvent(pointer('pointermove', 100, 125));
      expect(host.lastProgress).toBeCloseTo(0.5, 1);
    });

    it('emits 0 on release', () => {
      el.dispatchEvent(pointer('pointerdown', 100, 100));
      el.dispatchEvent(pointer('pointermove', 175, 100));
      expect(host.lastProgress).not.toBe(0);

      el.dispatchEvent(pointer('pointerup', 175, 100));
      expect(host.lastProgress).toBe(0);
    });

    it('clamps at 1', () => {
      el.dispatchEvent(pointer('pointerdown', 100, 100));
      el.dispatchEvent(pointer('pointermove', 300, 100));
      expect(host.lastProgress).toBe(1);
    });
  });

  // ── pointercancel ──────────────────────────────────────

  describe('pointercancel', () => {
    it('resets tracking and emits progress 0', () => {
      el.dispatchEvent(pointer('pointerdown', 100, 100));
      el.dispatchEvent(pointer('pointermove', 175, 100));
      expect(host.lastProgress).not.toBe(0);

      el.dispatchEvent(pointer('pointercancel', 175, 100));
      expect(host.lastProgress).toBe(0);
      expect(host.lastSwiped).toBeNull();
    });
  });
});
