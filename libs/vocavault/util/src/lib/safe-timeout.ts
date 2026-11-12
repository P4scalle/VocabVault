import { DestroyRef, inject } from '@angular/core';

/**
 * Creates a timeout function that auto-cleans on component destroy.
 * Returns a cancel function for each timeout created.
 */
export function useSafeTimeout(): (fn: () => void, ms: number) => () => void {
  const destroyRef = inject(DestroyRef);
  const timers = new Set<ReturnType<typeof setTimeout>>();

  destroyRef.onDestroy(() => timers.forEach(clearTimeout));

  return (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return () => {
      clearTimeout(id);
      timers.delete(id);
    };
  };
}
