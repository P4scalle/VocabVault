import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ToastService } from '../toast/toast.service';

const HOLD_DURATION_MS = 800;
const REVERSE_DURATION_MS = 200;
const STROKE_W = 2.5;
const BORDER_RADIUS = 8;

@Component({
  selector: 'lib-hold-button',
  imports: [],
  templateUrl: './hold-button.html',
  styleUrl: './hold-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.touch-action]': '"none"',
  },
})
export class HoldButton {
  private readonly toast = inject(ToastService);

  readonly ariaLabel = input<string>('');
  readonly styleClass = input<string>('');
  readonly holdDuration = input<number>(HOLD_DURATION_MS);
  readonly holdHint = input<string>('Hold to delete');

  readonly confirmed = output<void>();

  protected readonly holding = signal(false);
  protected readonly confirming = signal(false);
  protected readonly completed = signal(false);
  protected readonly progress = signal(0);

  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private animationFrameId: number | null = null;
  private holdStartTime = 0;
  private hintShown = false;
  private perimeter = 0;

  private readonly svgEl = viewChild<ElementRef<SVGSVGElement>>('holdSvg');
  private readonly trackEl = viewChild<ElementRef<SVGRectElement>>('ringTrack');
  private readonly progressEl = viewChild<ElementRef<SVGRectElement>>('ringProgress');

  protected onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    if (this.prefersReducedMotion()) {
      this.handleKeyboardConfirm();
      return;
    }
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    navigator.vibrate?.(10);

    this.holding.set(true);
    this.completed.set(false);
    this.progress.set(0);

    this.measureAndAnimate();

    this.holdStartTime = performance.now();
    this.animateProgress();

    this.holdTimer = setTimeout(() => {
      this.stopAnimationFrame();
      this.progress.set(100);
      navigator.vibrate?.([10, 40, 10]);
      this.completed.set(true);
      this.holding.set(false);
      this.confirmed.emit();
      this.resetRing();
    }, this.holdDuration());
  }

  protected onPointerUp(): void {
    if (!this.holding()) return;
    this.cancelHold();
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.handleKeyboardConfirm();
    }
  }

  private handleKeyboardConfirm(): void {
    if (this.confirming()) {
      this.confirming.set(false);
      this.confirmed.emit();
    } else {
      this.confirming.set(true);
      setTimeout(() => this.confirming.set(false), 3000);
    }
  }

  private cancelHold(): void {
    this.holding.set(false);
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.stopAnimationFrame();
    this.reverseRing();
    if (!this.hintShown) {
      this.hintShown = true;
      this.toast.show(this.holdHint(), 'info', 1500);
    }
  }

  private measureAndAnimate(): void {
    const svg = this.svgEl()?.nativeElement;
    const track = this.trackEl()?.nativeElement;
    const prog = this.progressEl()?.nativeElement;
    const btn = svg?.parentElement;
    if (!svg || !track || !prog || !btn) return;

    const { width, height } = btn.getBoundingClientRect();
    const offset = STROKE_W / 2;
    const innerW = width - STROKE_W;
    const innerH = height - STROKE_W;
    const r = Math.min(BORDER_RADIUS, innerW / 2, innerH / 2);

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    for (const el of [track, prog]) {
      el.setAttribute('x', `${offset}`);
      el.setAttribute('y', `${offset}`);
      el.setAttribute('width', `${innerW}`);
      el.setAttribute('height', `${innerH}`);
      el.setAttribute('rx', `${r}`);
    }

    this.perimeter = 2 * (innerW - 2 * r) + 2 * (innerH - 2 * r) + 2 * Math.PI * r;

    prog.style.strokeDasharray = `${this.perimeter}`;
    prog.style.transition = 'none';
    prog.style.strokeDashoffset = `${this.perimeter}`;
    void prog.getBoundingClientRect();
    prog.style.transition = `stroke-dashoffset ${this.holdDuration()}ms linear`;
    prog.style.strokeDashoffset = '0';
  }

  private animateProgress(): void {
    const elapsed = performance.now() - this.holdStartTime;
    const pct = Math.min(100, (elapsed / this.holdDuration()) * 100);
    this.progress.set(Math.round(pct));
    if (pct < 100) {
      this.animationFrameId = requestAnimationFrame(() => this.animateProgress());
    }
  }

  private stopAnimationFrame(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private reverseRing(): void {
    const el = this.progressEl()?.nativeElement;
    if (el && this.perimeter) {
      const computed = getComputedStyle(el);
      const currentOffset = parseFloat(computed.strokeDashoffset) || this.perimeter;
      el.style.transition = 'none';
      el.style.strokeDashoffset = `${currentOffset}`;
      void el.getBoundingClientRect();
      el.style.transition = `stroke-dashoffset ${REVERSE_DURATION_MS}ms ease-out`;
      el.style.strokeDashoffset = `${this.perimeter}`;
    }
  }

  private resetRing(): void {
    const el = this.progressEl()?.nativeElement;
    if (el && this.perimeter) {
      el.style.transition = 'none';
      el.style.strokeDashoffset = `${this.perimeter}`;
    }
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
