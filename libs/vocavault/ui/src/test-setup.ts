import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

// Stub matchMedia unconditionally. Several ui components (and CDK pulled in via
// A11yModule) call the legacy MediaQueryList.addListener, which some test
// environments (e.g. the Linux CI runner) don't provide — a bare/absent
// matchMedia then throws "addListener is not a function". A complete stub keeps
// it consistent across platforms.
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
