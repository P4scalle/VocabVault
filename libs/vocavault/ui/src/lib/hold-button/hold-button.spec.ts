import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HoldButton } from './hold-button';

describe('HoldButton', () => {
  let fixture: ComponentFixture<HoldButton>;
  let component: HoldButton;

  beforeEach(async () => {
    vi.useFakeTimers();

    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });

    await TestBed.configureTestingModule({
      imports: [HoldButton],
    }).compileComponents();

    fixture = TestBed.createComponent(HoldButton);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should create successfully', () => {
    expect(component).toBeTruthy();
  });

  it('should apply ariaLabel input to the button', () => {
    fixture.componentRef.setInput('ariaLabel', 'Delete item');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Delete item');
  });

  describe('keyboard confirm flow', () => {
    it('should enter confirming state on first Enter press', () => {
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(component['confirming']()).toBe(true);
    });

    it('should confirm on second Enter press', () => {
      const emitted: void[] = [];
      component.confirmed.subscribe(() => emitted.push(undefined));

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(emitted.length).toBe(1);
      expect(component['confirming']()).toBe(false);
    });

    it('should trigger confirm flow with Space key', () => {
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      fixture.detectChanges();

      expect(component['confirming']()).toBe(true);
    });

    it('should emit confirmed output on keyboard double-press with Space', () => {
      const emitted: void[] = [];
      component.confirmed.subscribe(() => emitted.push(undefined));

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      fixture.detectChanges();

      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      fixture.detectChanges();

      expect(emitted.length).toBe(1);
    });

    it('should reset confirming state after 3 seconds timeout', () => {
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(component['confirming']()).toBe(true);

      vi.advanceTimersByTime(3000);

      expect(component['confirming']()).toBe(false);
    });
  });

  describe('content slots', () => {
    it('should show default content initially (not confirming)', () => {
      const content = fixture.nativeElement.querySelector('.vv-hold-button__content');
      expect(content).not.toBeNull();
      expect(component['confirming']()).toBe(false);
      expect(component['holding']()).toBe(false);
    });

    it('should show confirm content when confirming', () => {
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      expect(component['confirming']()).toBe(true);
      expect(button.classList.contains('vv-hold-button--confirming')).toBe(true);
    });
  });

  describe('SVG progress ring', () => {
    it('should render SVG border-trace rect instead of fill bar', () => {
      expect(fixture.nativeElement.querySelector('.vv-hold-ring')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('rect.vv-hold-ring__progress')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('rect.vv-hold-ring__track')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.vv-hold-button__fill')).toBeNull();
    });
  });

  describe('pointer capture', () => {
    it('should call setPointerCapture on pointerdown', () => {
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      const event = new PointerEvent('pointerdown', { bubbles: true, pointerId: 42 });
      const spy = vi.spyOn(button, 'setPointerCapture');
      button.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith(42);
    });
  });

  describe('haptic feedback', () => {
    it('should vibrate on hold start', () => {
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      expect(navigator.vibrate).toHaveBeenCalledWith(10);
    });

    it('should vibrate pattern on hold complete', () => {
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      vi.advanceTimersByTime(800);
      expect(navigator.vibrate).toHaveBeenCalledWith([10, 40, 10]);
    });
  });

  describe('toast hint once', () => {
    it('should show toast hint only once across multiple cancelled holds', () => {
      const toastSpy = vi.spyOn(component['toast'], 'show');
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

      // First cancel
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      expect(toastSpy).toHaveBeenCalledTimes(1);

      // Second cancel
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2 }));
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      expect(toastSpy).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('aria-live announcement', () => {
    it('should announce Deleted via aria-live on completion', () => {
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      vi.advanceTimersByTime(800);
      fixture.detectChanges();
      const liveRegion = fixture.nativeElement.querySelector('[aria-live="assertive"]');
      expect(liveRegion.textContent.trim()).toBe('Deleted');
    });
  });

  describe('hold completion and cancellation', () => {
    it('should emit confirmed after hold duration', () => {
      const emitted: void[] = [];
      component.confirmed.subscribe(() => emitted.push(undefined));
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      vi.advanceTimersByTime(800);
      expect(emitted.length).toBe(1);
    });

    it('should cancel hold on pointerup before duration completes', () => {
      const emitted: void[] = [];
      component.confirmed.subscribe(() => emitted.push(undefined));
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      vi.advanceTimersByTime(400);
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      vi.advanceTimersByTime(800);
      expect(emitted.length).toBe(0);
    });
  });
});
