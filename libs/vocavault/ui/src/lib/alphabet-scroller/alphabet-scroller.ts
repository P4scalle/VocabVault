import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { getScrollContainer } from '@vocavault/util';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

@Component({
  selector: 'lib-alphabet-scroller',
  imports: [],
  templateUrl: './alphabet-scroller.html',
  styleUrl: './alphabet-scroller.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.top.px]': 'topOffset()',
    '[style.right.px]': 'rightOffset()',
  },
})
export class AlphabetScroller {
  readonly validLetters = input<string[]>([]);
  readonly activeLetter = input<string>('');
  /** Reference element; scroller top is clamped to never go above this element's top */
  readonly anchorEl = input<HTMLElement | null>(null);

  readonly letterSelected = output<string>();
  readonly scrubbingChange = output<boolean>();

  protected readonly scrubbing = signal(false);
  protected readonly scrubLetter = signal('');
  protected readonly hoveredLetter = signal('');
  protected readonly focusedIndex = signal(0);
  protected readonly isLandscapeCondensed = signal(false);

  /**
   * Dynamic top offset: the scroller starts at whichever is lower,
   * the CSS minimum (header height) or the word list's current top edge.
   * This ensures the scroller aligns with the word list when at the top,
   * and stays below the header when scrolled down.
   */
  readonly topOffset = signal(56); // default: 3.5rem = 56px (mobile header)
  /** Dynamic right offset: on desktop, aligns with the word list's right edge */
  readonly rightOffset = signal(0);

  /** O(1) lookup instead of O(n) .includes() per letter per CD cycle */
  protected readonly validSet = computed(() => new Set(this.validLetters()));

  readonly alphabet = ALPHABET;

  private readonly letterButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('letterBtn');

  // Cached geometry: snapshot on pointerdown, reused on every pointermove
  private cachedFirstTop = 0;
  private cachedTotalHeight = 0;

  // rAF handle for batched letterSelected emissions
  private pendingEmitRaf = 0;

  // Haptic throttle
  private lastVibrateTime = 0;

  protected readonly bubbleTop = computed(() => {
    if (!this.scrubbing() || !this.scrubLetter()) return '50%';
    const idx = ALPHABET.indexOf(this.scrubLetter());
    if (this.cachedTotalHeight <= 0) return '50%';
    const letterHeight = this.cachedTotalHeight / ALPHABET.length;
    return `${this.cachedFirstTop + idx * letterHeight + letterHeight / 2}px`;
  });

  // Bound handlers for pointer capture (stable references, created once)
  private readonly onCapturedMove = (e: PointerEvent) => this.handlePointerMove(e);
  private readonly onCapturedUp = (e: PointerEvent) => this.handlePointerUp(e);

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const mq = matchMedia('(max-height: 420px)');
      this.isLandscapeCondensed.set(mq.matches);
      const handler = (e: MediaQueryListEvent) => this.isLandscapeCondensed.set(e.matches);
      mq.addEventListener('change', handler);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', handler));

      // Track word list position to dynamically offset the scroller.
      // Throttled to one rAF per paint frame to avoid layout thrashing on 120Hz devices.
      this.updateOffsets();
      let rafId = 0;
      const scheduleUpdate = () => {
        if (!rafId) {
          rafId = requestAnimationFrame(() => {
            this.updateOffsets();
            rafId = 0;
          });
        }
      };
      const scrollContainer = getScrollContainer();
      const scrollTarget = scrollContainer ?? window;
      scrollTarget.addEventListener('scroll', scheduleUpdate, { passive: true } as AddEventListenerOptions);
      window.addEventListener('resize', scheduleUpdate, { passive: true });

      // ResizeObserver on anchor: catches layout shifts from banners/filters
      // appearing/disappearing without a scroll or resize event.
      let ro: ResizeObserver | null = null;
      const anchor = this.anchorEl();
      if (anchor) {
        ro = new ResizeObserver(scheduleUpdate);
        ro.observe(anchor);
      }

      this.destroyRef.onDestroy(() => {
        scrollTarget.removeEventListener('scroll', scheduleUpdate);
        window.removeEventListener('resize', scheduleUpdate);
        cancelAnimationFrame(rafId);
        ro?.disconnect();
      });
    });
  }

  private getMinTop(): number {
    // Mobile header is 3.5rem (56px), tablet has no header, desktop has 4rem
    return window.innerWidth >= 1024 ? 64 : window.innerWidth >= 768 ? 0 : 56;
  }

  private updateOffsets(): void {
    const anchor = this.anchorEl();
    if (!anchor) {
      this.topOffset.set(this.getMinTop());
      this.rightOffset.set(0);
      return;
    }
    // Top: clamp to header height or word list top (whichever is lower)
    const anchorTop = anchor.getBoundingClientRect().top;
    this.topOffset.set(Math.max(this.getMinTop(), anchorTop));

    // Right: distance from anchor's right edge to viewport right.
    // On mobile this is ~0 (content fills width), on desktop it hugs the content.
    const anchorRight = anchor.getBoundingClientRect().right;
    this.rightOffset.set(Math.max(0, window.innerWidth - anchorRight));
  }

  protected isCondensedHidden(index: number): boolean {
    return this.isLandscapeCondensed() && index % 2 === 1;
  }

  protected getTabIndex(index: number): number {
    return index === this.focusedIndex() ? 0 : -1;
  }

  private throttledVibrate(): void {
    const now = performance.now();
    if (now - this.lastVibrateTime > 40) {
      this.lastVibrateTime = now;
      navigator.vibrate?.(1);
    }
  }

  protected onPointerDown(event: PointerEvent, letter: string): void {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const nav = target.closest('nav');
    if (!nav) return;

    // Capture all pointer events to the nav, works even when finger drifts outside
    nav.setPointerCapture(event.pointerId);
    nav.addEventListener('pointermove', this.onCapturedMove);
    nav.addEventListener('pointerup', this.onCapturedUp);
    nav.addEventListener('pointercancel', this.onCapturedUp);
    nav.addEventListener('lostpointercapture', this.onCapturedUp);

    this.scrubbing.set(true);
    this.scrubbingChange.emit(true);

    // Snapshot button geometry once, reused on every pointermove (Fix 1)
    const buttons = this.letterButtons();
    if (buttons.length) {
      const firstRect = buttons[0].nativeElement.getBoundingClientRect();
      const lastRect = buttons[buttons.length - 1].nativeElement.getBoundingClientRect();
      this.cachedFirstTop = firstRect.top;
      this.cachedTotalHeight = lastRect.bottom - firstRect.top;
    }

    const nearest = this.findNearestValid(letter);
    this.scrubLetter.set(nearest);
    this.letterSelected.emit(nearest);

    // Initial vibrate, always fires on touch start
    this.lastVibrateTime = performance.now();
    navigator.vibrate?.(1);
  }

  private handlePointerMove(event: PointerEvent): void {
    const letter = this.getLetterFromY(event.clientY);
    const nearest = this.findNearestValid(letter);
    if (nearest !== this.scrubLetter()) {
      this.scrubLetter.set(nearest);
      // rAF-batch the emission so the host doesn't re-render on every pointermove (Fix 2)
      if (!this.pendingEmitRaf) {
        this.pendingEmitRaf = requestAnimationFrame(() => {
          this.pendingEmitRaf = 0;
          this.letterSelected.emit(this.scrubLetter());
        });
      }
      this.throttledVibrate();
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    target.releasePointerCapture?.(event.pointerId);
    target.removeEventListener('pointermove', this.onCapturedMove);
    target.removeEventListener('pointerup', this.onCapturedUp);
    target.removeEventListener('pointercancel', this.onCapturedUp);
    target.removeEventListener('lostpointercapture', this.onCapturedUp);

    // Cancel pending rAF and emit final letter immediately (Fix 2)
    cancelAnimationFrame(this.pendingEmitRaf);
    this.pendingEmitRaf = 0;
    const finalLetter = this.scrubLetter();
    if (finalLetter) this.letterSelected.emit(finalLetter);

    this.scrubbing.set(false);
    this.scrubLetter.set('');
    this.scrubbingChange.emit(false);
  }

  protected onKeyDown(event: KeyboardEvent, index: number): void {
    const step = this.isLandscapeCondensed() ? 2 : 1;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const next = Math.min(index + step, 25);
        this.focusedIndex.set(next);
        this.letterButtons()[next]?.nativeElement.focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev = Math.max(index - step, 0);
        this.focusedIndex.set(prev);
        this.letterButtons()[prev]?.nativeElement.focus();
        break;
      }
      case 'Home': {
        event.preventDefault();
        this.focusedIndex.set(0);
        this.letterButtons()[0]?.nativeElement.focus();
        break;
      }
      case 'End': {
        event.preventDefault();
        this.focusedIndex.set(25);
        this.letterButtons()[25]?.nativeElement.focus();
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const nearest = this.findNearestValid(ALPHABET[index]);
        this.letterSelected.emit(nearest);
        break;
      }
    }
  }

  private getLetterFromY(y: number): string {
    // Use cached geometry instead of calling getBoundingClientRect on every move (Fix 1)
    if (this.cachedTotalHeight <= 0) return ALPHABET[0];
    const ratio = Math.max(0, Math.min(1, (y - this.cachedFirstTop) / this.cachedTotalHeight));
    const index = Math.round(ratio * (ALPHABET.length - 1));
    return ALPHABET[Math.max(0, Math.min(25, index))];
  }

  private findNearestValid(letter: string): string {
    const valid = this.validSet();
    if (!valid.size) return letter;
    if (valid.has(letter)) return letter;

    const idx = ALPHABET.indexOf(letter);
    for (let offset = 1; offset <= 25; offset++) {
      const above = ALPHABET[idx + offset];
      if (above && valid.has(above)) return above;
      const below = ALPHABET[idx - offset];
      if (below && valid.has(below)) return below;
    }
    return this.validLetters()[0];
  }
}
