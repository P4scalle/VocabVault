import { computed, Injectable, signal, Signal } from '@angular/core';

/**
 * Controls shell chrome visibility (header, nav, FAB). Components request focus
 * mode to hide the chrome during active states; the shell reads `focusMode`.
 *
 * `focusMode` is derived (pull-based), not pushed. The shell is an ancestor and
 * is change-detected before its descendants, so pushing focus state from a child
 * (e.g. via effect) let the shell read a stale value. A computed is recomputed on
 * read, so the shell always sees the current state in the same change-detection pass.
 *
 * Two ways to request focus, OR'd together. Use ONE per component:
 *  - enterFocus()/leaveFocus(): for components focused their whole lifetime
 *    (enter on init, leave on destroy). Idempotent boolean.
 *  - registerFocusWhile(source): for components that toggle focus while alive,
 *    driven by a signal (e.g. hasUnsavedChanges). Returns an unregister function
 *    the caller must invoke on destroy.
 */
@Injectable({ providedIn: 'root' })
export class ChromeService {
  private readonly imperativeFocus = signal(false);
  private readonly sources = signal<readonly Signal<boolean>[]>([]);

  readonly focusMode = computed(() => this.imperativeFocus() || this.sources().some((s) => s()));

  enterFocus(): void {
    this.imperativeFocus.set(true);
  }

  leaveFocus(): void {
    this.imperativeFocus.set(false);
  }

  registerFocusWhile(source: Signal<boolean>): () => void {
    this.sources.update((list) => [...list, source]);
    return () => this.sources.update((list) => list.filter((s) => s !== source));
  }
}
