import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
// Dedicated e2e port (4300) so a manually-running dev server on 4200 can never
// be silently reused in place of the freshly-built static artifact.
const E2E_PORT = 4300;
const baseURL = process.env['BASE_URL'] || `http://localhost:${E2E_PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  /* Retry once: under full parallel load the slow emulated-mobile projects
     occasionally brush the per-test timeout. A pass-on-retry is reported as
     "flaky" (suite still green); a genuine failure fails both attempts. */
  retries: 1,
  use: {
    baseURL,
    /* Collect trace only on failure for debugging */
    trace: 'retain-on-failure',
    /* Screenshots only on failure, keeps test-results/ clean on pass */
    screenshot: 'only-on-failure',
    /* Video only on failure */
    video: 'retain-on-failure',
  },
  /* Visual regression snapshot settings */
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: 'disabled',
    },
  },
  /* Serve the PRODUCTION build statically — not the dev server. The dev server
     compiles lazy routes on first navigation, and under full parallel load
     (10 workers × 5 engines) those on-demand compiles starve the slow emulated
     WebKit projects into timeouts. A pre-built static artifact removes the
     compile entirely: deterministic, and faster overall.
     reuseExistingServer:false + a dedicated port guarantees every run tests a
     freshly-built bundle, never a stale/wrong leftover server. */
  webServer: {
    command: `npx nx run vocavault:serve-static --port=${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    cwd: workspaceRoot,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      // Emulated mobile is the slowest tier under parallel load; give it the
      // same headroom as Mobile Safari so it can't brush the 30s default.
      timeout: 60_000,
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      // Emulated mobile WebKit is the slowest project (~25s/test near the 30s
      // default under full parallel load); give it headroom to avoid timeouts.
      timeout: 60_000,
    },
  ],
});
