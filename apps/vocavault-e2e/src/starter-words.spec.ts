import { test, expect, Page } from '@playwright/test';

// Runs across every configured project (desktop Chromium/Firefox/WebKit +
// Mobile Chrome/Safari), so this covers the add hint and starter words on
// all device form factors.

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

// Canned dictionary response so the test never depends on the live API.
async function mockDictionary(page: Page) {
  await page.route('**/api.dictionaryapi.dev/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          word: 'serendipity',
          phonetics: [{ text: '/ˌsɛrənˈdɪpɪti/' }],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: 'A happy accident.' }] },
          ],
        },
      ]),
    }),
  );
}

test.describe('Starter words & first-run add hint', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockDictionary(page);
  });

  test('empty dictionary offers starter words and adds one on tap', async ({ page }) => {
    await page.goto('/dictionary');

    const starter = page.getByTestId('starter-words');
    await expect(starter).toBeVisible();
    await expect(starter.getByRole('button').first()).toBeEnabled();

    await starter.getByRole('button').first().click();

    // Once a word exists, the empty-state block (and its starter chips) is gone
    await expect(page.getByTestId('starter-words')).toBeHidden();
    // Scope to the word card so we don't also match the "Added ..." toast
    await expect(page.locator('lib-word-card').filter({ hasText: 'Serendipity' })).toBeVisible();
  });

  test('add button pulses while empty and stops after the first word', async ({ page }) => {
    await page.goto('/home');
    // Wait for the shell to render before asserting on the hint (avoids a load-time race).
    await expect(page.locator('lib-adaptive-nav nav')).toBeVisible();
    // At least one add control (mobile FAB or desktop pill) carries the hint.
    await expect(page.locator('.vv-add-hint').first()).toBeAttached();

    await page.goto('/dictionary');
    await page.getByTestId('starter-words').getByRole('button').first().click();
    await expect(page.getByTestId('starter-words')).toBeHidden();
    // Confirm the word actually landed before leaving, so the hint state is settled.
    await expect(page.locator('lib-word-card').first()).toBeVisible();

    await page.goto('/home');
    await expect(page.locator('lib-adaptive-nav nav')).toBeVisible();
    await expect(page.locator('.vv-add-hint')).toHaveCount(0);
  });
});
