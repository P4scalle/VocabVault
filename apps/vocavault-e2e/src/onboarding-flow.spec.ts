import { test, expect, Page } from '@playwright/test';

// Runs on every configured project (desktop + mobile), covering the guided
// add-sheet gating and the "How it works" steps on all form factors.

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function mockDictionary(page: Page) {
  await page.route('**/api.dictionaryapi.dev/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          word: 'serendipity',
          phonetics: [{ text: '/x/' }],
          meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'A happy accident.' }] }],
        },
      ]),
    }),
  );
}

// The add control is a mobile FAB ("Open add options") or a desktop pill
// ("Add word or quiz") depending on viewport — open whichever is visible.
async function openAddSheet(page: Page) {
  const mobileFab = page.getByRole('button', { name: 'Open add options' });
  const desktopPill = page.getByRole('button', { name: 'Add word or quiz' });
  if (await mobileFab.isVisible()) {
    await mobileFab.click();
  } else {
    await desktopPill.click();
  }
}

test.describe('Onboarding guided flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('home shows the "How VocaVault works" steps when empty', async ({ page }) => {
    await page.goto('/home');
    const strip = page.getByTestId('how-it-works');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('Add words');
    await expect(strip).toContainText('Practice');
    await expect(strip).toContainText('Master');
  });

  test('add sheet locks Quiz & Folder and steers to Word at 0 words', async ({ page }) => {
    await page.goto('/home');
    await openAddSheet(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: /^Quiz/ })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: /^Folder/ })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: /^Word/ })).toBeEnabled();
    await expect(dialog).toContainText('unlock quizzes and folders');
    await expect(dialog).toContainText('Start here');
  });

  test('Quiz unlocks after the first word is added', async ({ page }) => {
    await mockDictionary(page);
    await page.goto('/dictionary');
    await page.getByTestId('starter-words').getByRole('button').first().click();
    await expect(page.getByTestId('starter-words')).toBeHidden();

    await openAddSheet(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: /^Quiz/ })).toBeEnabled();
    await expect(dialog).not.toContainText('unlock quizzes and folders');
  });
});
