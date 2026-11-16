import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

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
  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npx nx run vocavault:serve',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
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
