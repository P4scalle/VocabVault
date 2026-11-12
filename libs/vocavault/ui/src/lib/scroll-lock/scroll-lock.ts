/**
 * Shared scroll-lock utility.
 *
 * Tracks multiple consumers via a reference count so that overlapping
 * overlays (e.g. bottom-sheet inside action-drawer) don't fight over
 * document.body overflow.
 */
let lockCount = 0;
let previousOverflow: string | null = null;
let previousPaddingRight: string | null = null;

export function acquireScrollLock(doc: Document): void {
  if (lockCount === 0) {
    const body = doc.body;
    const html = doc.documentElement;
    const win = doc.defaultView;

    previousOverflow = body.style.overflow;
    previousPaddingRight = body.style.paddingRight;

    const scrollbarWidth = win
      ? Math.max(0, win.innerWidth - html.clientWidth)
      : 0;

    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  lockCount++;
}

export function releaseScrollLock(doc: Document): void {
  if (lockCount === 0) return;
  lockCount--;
  if (lockCount > 0) return;

  const body = doc.body;
  body.style.overflow = previousOverflow ?? '';
  body.style.paddingRight = previousPaddingRight ?? '';
  previousOverflow = null;
  previousPaddingRight = null;
}
