import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BottomSheet } from './bottom-sheet';

@Component({
  selector: 'lib-test-host',
  imports: [BottomSheet],
  template: `
    <lib-bottom-sheet [(visible)]="visible">
      <p class="projected">Projected content</p>
    </lib-bottom-sheet>
  `,
})
class TestHost {
  visible = false;
}

describe('BottomSheet', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
  });

  // cdkTrapFocusAutoCapture schedules focus on the next stable tick. Flush it
  // while the component is still attached, then destroy deterministically, so
  // that pending focus work can't surface in a later test as an unhandled
  // rejection under parallel load (the cause of flaky backdrop-click failures).
  afterEach(async () => {
    await fixture.whenStable();
    fixture.destroy();
  });

  it('should not render content when visible is false', () => {
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector('.fixed');
    expect(overlay).toBeNull();
  });

  it('should render overlay and panel when visible is true', () => {
    host.visible = true;
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector('.fixed');
    expect(overlay).not.toBeNull();

    const backdrop = fixture.nativeElement.querySelector('.bg-black\\/40');
    expect(backdrop).not.toBeNull();

    const panel = fixture.nativeElement.querySelector('.rounded-t-2xl');
    expect(panel).not.toBeNull();
  });

  it('should set visible to false on backdrop click', () => {
    host.visible = true;
    fixture.detectChanges();

    // The close handler lives on the backdrop (absolute inset-0), which covers
    // the overlay in a real browser; the panel stops propagation. Click the
    // backdrop to simulate a real "click outside the panel".
    const backdrop = fixture.nativeElement.querySelector('.bg-black\\/40') as HTMLElement;
    backdrop.click();
    fixture.detectChanges();

    expect(host.visible).toBe(false);
  });

  it('should not close when clicking inside the panel', () => {
    host.visible = true;
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.rounded-t-2xl') as HTMLElement;
    panel.click();
    fixture.detectChanges();

    expect(host.visible).toBe(true);
  });

  it('should project ng-content into the panel', () => {
    host.visible = true;
    fixture.detectChanges();

    const projected = fixture.nativeElement.querySelector('.projected');
    expect(projected).not.toBeNull();
    expect(projected.textContent).toContain('Projected content');
  });

  it('should render the mobile handle bar', () => {
    host.visible = true;
    fixture.detectChanges();

    const handle = fixture.nativeElement.querySelector('.rounded-full.bg-slate-300');
    expect(handle).not.toBeNull();
  });

  it('should close on Escape key', () => {
    host.visible = true;
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(host.visible).toBe(false);
  });

  // ── Swipe-to-dismiss ────────────────────────────────────

  describe('swipe-to-dismiss', () => {
    function pointer(type: string, x: number, y: number): PointerEvent {
      return new PointerEvent(type, {
        clientX: x,
        clientY: y,
        pointerId: 1,
        bubbles: true,
      });
    }

    function getHandle(): HTMLElement {
      return fixture.nativeElement.querySelector('[data-testid="drag-handle"]');
    }

    function getPanel(): HTMLElement {
      return fixture.nativeElement.querySelector('[data-testid="bottom-sheet-panel"]');
    }

    it('should close on swipe down past threshold', () => {
      host.visible = true;
      fixture.detectChanges();

      const handle = getHandle();
      handle.dispatchEvent(pointer('pointerdown', 100, 100));
      handle.dispatchEvent(pointer('pointermove', 100, 200));
      handle.dispatchEvent(pointer('pointerup', 100, 200));
      fixture.detectChanges();

      expect(host.visible).toBe(false);
    });

    it('should not close on swipe up', () => {
      host.visible = true;
      fixture.detectChanges();

      const handle = getHandle();
      handle.dispatchEvent(pointer('pointerdown', 100, 200));
      handle.dispatchEvent(pointer('pointermove', 100, 100));
      handle.dispatchEvent(pointer('pointerup', 100, 100));
      fixture.detectChanges();

      expect(host.visible).toBe(true);
    });

    it('should apply translateY during downward drag', () => {
      host.visible = true;
      fixture.detectChanges();

      const handle = getHandle();
      handle.dispatchEvent(pointer('pointerdown', 100, 100));
      handle.dispatchEvent(pointer('pointermove', 100, 130));
      fixture.detectChanges();

      const panel = getPanel();
      expect(panel.style.transform).toContain('translateY');
      const yValue = parseFloat(panel.style.transform.replace(/[^0-9.]/g, ''));
      expect(yValue).toBeGreaterThan(0);
    });

    it('should clamp negative progress (no upward drag)', () => {
      host.visible = true;
      fixture.detectChanges();

      const handle = getHandle();
      handle.dispatchEvent(pointer('pointerdown', 100, 100));
      handle.dispatchEvent(pointer('pointermove', 100, 70));
      fixture.detectChanges();

      const panel = getPanel();
      // Should not have translateY or it should be 0
      const transform = panel.style.transform;
      if (transform) {
        const yValue = parseFloat(transform.replace(/[^0-9.-]/g, ''));
        expect(yValue).toBe(0);
      }
    });

    it('should snap back when swipe does not meet threshold', () => {
      host.visible = true;
      fixture.detectChanges();

      const handle = getHandle();
      handle.dispatchEvent(pointer('pointerdown', 100, 100));
      handle.dispatchEvent(pointer('pointermove', 100, 120));
      handle.dispatchEvent(pointer('pointerup', 100, 120));
      fixture.detectChanges();

      expect(host.visible).toBe(true);
      const panel = getPanel();
      // After release without meeting threshold, panel snaps back
      expect(panel.style.transform).toBe('');
    });
  });
});
