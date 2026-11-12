import { test, expect } from '@playwright/test';

/**
 * Visual regression tests, separate from functional E2E.
 *
 * These tests capture baseline screenshots and compare future runs pixel-by-pixel.
 * Run: npx playwright test visual.spec.ts
 * Update baselines: npx playwright test visual.spec.ts --update-snapshots
 *
 * Baselines live in src/visual.spec.ts-snapshots/ and MUST be committed to git.
 * The test-results/ directory (failure diffs) is gitignored.
 *
 * Determinism: each test waits for the route's stable heading to be visible
 * before capturing. toHaveScreenshot auto-retries until the rendered page is
 * pixel-stable and screenshot animations are disabled via playwright.config.ts,
 * so no fixed timeout is needed.
 */

test.describe('Visual regression @visual', () => {
  test('home page', async ({ page }) => {
    await page.goto('/home');
    await expect(page.getByRole('heading', { name: 'Welcome to VocaVault!' })).toBeVisible();

    await expect(page).toHaveScreenshot('home.png', { fullPage: true });
  });

  test('dictionary page', async ({ page }) => {
    await page.goto('/dictionary');
    await expect(page.getByRole('heading', { name: 'Dictionary', exact: true })).toBeVisible();

    await expect(page).toHaveScreenshot('dictionary.png', { fullPage: true });
  });

  test('quiz page', async ({ page }) => {
    await page.goto('/quiz');
    await expect(page.getByRole('heading', { name: 'Quizzes', exact: true })).toBeVisible();

    await expect(page).toHaveScreenshot('quiz.png', { fullPage: true });
  });

  test('progress page', async ({ page }) => {
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();

    await expect(page).toHaveScreenshot('progress.png', { fullPage: true });
  });

  test('not found page', async ({ page }) => {
    await page.goto('/some-nonexistent-route');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();

    await expect(page).toHaveScreenshot('not-found.png', { fullPage: true });
  });
});
