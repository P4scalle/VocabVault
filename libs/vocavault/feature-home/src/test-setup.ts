import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

// jsdom lacks matchMedia — stub it for components like ProgressBubble
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: () => { /* mock: no-op */ },
    removeListener: () => { /* mock: no-op */ },
    addEventListener: () => { /* mock: no-op */ },
    removeEventListener: () => { /* mock: no-op */ },
    dispatchEvent: () => false,
  }) as MediaQueryList;
}

// jsdom lacks IntersectionObserver — stub it for scroll-spy components
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe() { /* mock: no-op */ }
    unobserve() { /* mock: no-op */ }
    disconnect() { /* mock: no-op */ }
  };
}

setupTestBed();
