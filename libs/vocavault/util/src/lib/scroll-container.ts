/**
 * Shared scroll-container contract.
 *
 * The shell's <main> element uses this ID. Every consumer that needs to
 * scroll or observe scroll must go through getScrollContainer() so there
 * is exactly ONE place to update if the shell layout changes.
 */
export const SCROLL_CONTAINER_ID = 'main-content';

/** Returns the app's main scroll container, or null during SSR / before render. */
export function getScrollContainer(): HTMLElement | null {
  return typeof document !== 'undefined' ? document.getElementById(SCROLL_CONTAINER_ID) : null;
}
