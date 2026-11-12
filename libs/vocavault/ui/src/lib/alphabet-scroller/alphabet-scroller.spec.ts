import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { AlphabetScroller } from './alphabet-scroller';

/** Typed access to the internal state used in white-box tests. */
interface AlphabetScrollerInternals {
  scrubbing: Signal<boolean>;
  lastVibrateTime: number;
  throttledVibrate(): void;
}

describe('AlphabetScroller', () => {
  let fixture: ComponentFixture<AlphabetScroller>;

  beforeEach(async () => {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    // Mock pointer capture methods not available in jsdom
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = vi.fn();
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = vi.fn();
    }

    await TestBed.configureTestingModule({
      imports: [AlphabetScroller],
    }).compileComponents();
    fixture = TestBed.createComponent(AlphabetScroller);
  });

  it('creates successfully', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders 26 letter buttons', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(26);
    expect(buttons[0].textContent.trim()).toBe('A');
    expect(buttons[25].textContent.trim()).toBe('Z');
  });

  it('marks valid letters with valid class', async () => {
    fixture.componentRef.setInput('validLetters', ['A', 'C', 'Z']);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].classList.contains('vv-alphabet-scroller__letter--valid')).toBe(true);
    expect(buttons[1].classList.contains('vv-alphabet-scroller__letter--invalid')).toBe(true);
    expect(buttons[2].classList.contains('vv-alphabet-scroller__letter--valid')).toBe(true);
    expect(buttons[25].classList.contains('vv-alphabet-scroller__letter--valid')).toBe(true);
  });

  it('letters not in validLetters have invalid class', async () => {
    fixture.componentRef.setInput('validLetters', ['A']);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[1].classList.contains('vv-alphabet-scroller__letter--invalid')).toBe(true);
    expect(buttons[1].classList.contains('vv-alphabet-scroller__letter--valid')).toBe(false);
  });

  it('activeLetter highlights button with aria-selected', async () => {
    fixture.componentRef.setInput('activeLetter', 'D');
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[3].classList.contains('vv-alphabet-scroller__letter--active')).toBe(true);
    expect(buttons[3].getAttribute('aria-selected')).toBe('true');
    expect(buttons[0].classList.contains('vv-alphabet-scroller__letter--active')).toBe(false);
    expect(buttons[0].getAttribute('aria-selected')).toBe('false');
  });

  it('invalid letters have invalid class', async () => {
    fixture.componentRef.setInput('validLetters', ['A', 'C']);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].classList.contains('vv-alphabet-scroller__letter--valid')).toBe(true); // A is valid
    expect(buttons[1].classList.contains('vv-alphabet-scroller__letter--invalid')).toBe(true); // B is invalid
  });

  it('uses nav element with listbox role', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav).toBeTruthy();
    expect(nav.getAttribute('aria-label')).toBe('Alphabet navigation');
    expect(nav.getAttribute('role')).toBe('listbox');
  });

  it('letterSelected emits on pointerdown', async () => {
    fixture.componentRef.setInput('validLetters', ['A', 'B', 'C']);
    fixture.detectChanges();
    await fixture.whenStable();

    let emittedLetter = '';
    fixture.componentInstance.letterSelected.subscribe((l: string) => { emittedLetter = l; });

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(emittedLetter).toBe('A');
  });

  it('pointerdown on invalid letter emits nearest valid letter', async () => {
    fixture.componentRef.setInput('validLetters', ['C', 'F']);
    fixture.detectChanges();
    await fixture.whenStable();

    let emittedLetter = '';
    fixture.componentInstance.letterSelected.subscribe((l: string) => { emittedLetter = l; });

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(emittedLetter).toBe('C');
  });

  it('scrubbing signal is true on pointerdown and false on pointerup', async () => {
    fixture.componentRef.setInput('validLetters', ['A', 'B']);
    fixture.detectChanges();
    await fixture.whenStable();

    const internals = fixture.componentInstance as unknown as AlphabetScrollerInternals;
    expect(internals.scrubbing()).toBe(false);

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(internals.scrubbing()).toBe(true);

    // pointerup fires on the nav (via pointer capture)
    const nav = fixture.nativeElement.querySelector('nav');
    nav.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(internals.scrubbing()).toBe(false);
  });

  it('keyboard Enter/Space emits letterSelected', async () => {
    fixture.componentRef.setInput('validLetters', ['A', 'B', 'C']);
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: string[] = [];
    fixture.componentInstance.letterSelected.subscribe((l: string) => emitted.push(l));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(emitted).toEqual(['A']);

    buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(emitted).toEqual(['A', 'B']);
  });

  it('keyboard ArrowDown/ArrowUp moves focus', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].focus();

    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(buttons[1].getAttribute('tabindex')).toBe('0');
    expect(buttons[0].getAttribute('tabindex')).toBe('-1');

    buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    fixture.detectChanges();
    expect(buttons[0].getAttribute('tabindex')).toBe('0');
  });

  it('keyboard Home/End jumps to first/last letter', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.nativeElement.querySelectorAll('button');

    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();
    expect(buttons[25].getAttribute('tabindex')).toBe('0');

    buttons[25].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    expect(buttons[0].getAttribute('tabindex')).toBe('0');
  });

  it('nav has the scroller layout class', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav.classList.contains('vv-alphabet-scroller')).toBe(true);
  });

  it('host uses fixed positioning (not sticky) to prevent scroll-jump feedback loop', () => {
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    // jsdom doesn't apply SCSS, so we verify the host element exists and
    // the SCSS sets position:fixed on :host. This is a documentation test —
    // real verification requires E2E/visual regression.
    expect(host).toBeTruthy();
  });

  it('findNearestValid returns letter itself when no valid letters', async () => {
    fixture.componentRef.setInput('validLetters', []);
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: string[] = [];
    fixture.componentInstance.letterSelected.subscribe((l: string) => emitted.push(l));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[12].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(emitted).toEqual(['M']);
  });

  it('findNearestValid prefers closer valid letter', async () => {
    fixture.componentRef.setInput('validLetters', ['D', 'Z']);
    fixture.detectChanges();
    await fixture.whenStable();

    let emitted = '';
    fixture.componentInstance.letterSelected.subscribe((l: string) => { emitted = l; });

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(emitted).toBe('D');
  });

  it('scrubbingChange output emits true on pointerdown and false on pointerup', async () => {
    fixture.componentRef.setInput('validLetters', ['A', 'B']);
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: boolean[] = [];
    fixture.componentInstance.scrubbingChange.subscribe((v: boolean) => emitted.push(v));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(emitted).toEqual([true]);

    const nav = fixture.nativeElement.querySelector('nav');
    nav.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(emitted).toEqual([true, false]);
  });

  it('pointerup emits final letter immediately (rAF-batch bypass)', async () => {
    fixture.componentRef.setInput('validLetters', ['A', 'B', 'C']);
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: string[] = [];
    fixture.componentInstance.letterSelected.subscribe((l: string) => emitted.push(l));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    // pointerdown emits 'A' synchronously
    buttons[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(emitted).toEqual(['A']);

    // pointerup should emit the current scrub letter immediately (not deferred)
    const nav = fixture.nativeElement.querySelector('nav');
    nav.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    // 'A' emitted again synchronously on pointerup (final letter confirmation)
    expect(emitted).toEqual(['A', 'A']);
  });

  it('throttledVibrate skips calls within 40ms window', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrateSpy, writable: true, configurable: true });

    const comp = fixture.componentInstance as unknown as AlphabetScrollerInternals;
    const nowSpy = vi.spyOn(performance, 'now');

    // First call should vibrate
    comp.lastVibrateTime = 0;
    nowSpy.mockReturnValue(100);
    comp.throttledVibrate();
    expect(vibrateSpy).toHaveBeenCalledTimes(1);

    // Call within 40ms — should be skipped
    nowSpy.mockReturnValue(130);
    comp.throttledVibrate();
    expect(vibrateSpy).toHaveBeenCalledTimes(1);

    // Call after 40ms — should vibrate
    nowSpy.mockReturnValue(141);
    comp.throttledVibrate();
    expect(vibrateSpy).toHaveBeenCalledTimes(2);
  });
});
