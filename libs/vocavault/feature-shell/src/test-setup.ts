import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

// Stub matchMedia for JSDOM (used by AdaptiveNav)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => { /* mock: no-op */ },
    removeListener: () => { /* mock: no-op */ },
    addEventListener: () => { /* mock: no-op */ },
    removeEventListener: () => { /* mock: no-op */ },
    dispatchEvent: () => false,
  }),
});

setupTestBed();
