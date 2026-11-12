import { afterNextRender, effect, Signal, signal, untracked } from '@angular/core';

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Creates an animated signal that smoothly transitions to the target value.
 * Must be called in an injection context (constructor or field initializer).
 * Respects prefers-reduced-motion. Animation starts after first render.
 *
 * If `trigger` is provided, animation waits until it becomes true
 * (e.g. when element scrolls into view).
 */
export function animatedValue(
  target: Signal<number>,
  opts: { duration?: number; easing?: (t: number) => number; trigger?: Signal<boolean> } = {}
): Signal<number> {
  const { duration = 800, easing = easeOutCubic, trigger } = opts;
  const current = signal(0);
  const rendered = signal(false);

  afterNextRender(() => rendered.set(true));

  effect(() => {
    const end = target();
    if (!rendered()) return;
    if (trigger && !trigger()) return;

    // Read current value without tracking to avoid circular dependency
    const start = untracked(() => current());

    if (end === start) return;

    if (prefersReducedMotion() || end === 0) {
      current.set(end);
      return;
    }

    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      current.set(Math.round(start + (end - start) * easing(p)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  return current.asReadonly();
}
