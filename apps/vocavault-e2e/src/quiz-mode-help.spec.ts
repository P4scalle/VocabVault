import { test, expect, Page } from '@playwright/test';

// Verifies the in-quiz "what to do" help: an info "i" button beside the quiz
// title that opens a responsive drawer (bottom sheet on mobile, dialog on
// desktop) with kind, mode-specific instructions. Also guards that the flag
// control stays on single-word modes (flashcard) after it was removed from the
// multi-word modes (multiple choice, match).

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

// Add starter words, build a quiz from them, and open the flashcard play screen.
// Reuses the selectors proven in user-journey/guided-first-quiz specs.
async function openFlashcardPlay(page: Page) {
  await page.goto('/dictionary');
  await page.getByTestId('starter-words').getByRole('button').first().click();
  await expect(page.getByTestId('starter-words')).toBeHidden();

  await page.goto('/quiz/create');
  await page.getByLabel('Name').fill('Help Quiz');
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).check();
  }
  await page.getByRole('button', { name: 'Create Quiz Set' }).click();
  await expect(page).toHaveURL(/\/quiz\//);

  await page.getByRole('button', { name: /^Flashcard/ }).click();
  await expect(page).toHaveURL(/\/play\?mode=flashcard/);
}

test.describe('Quiz mode help', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('info button beside the title opens the how-to drawer', async ({ page }) => {
    await openFlashcardPlay(page);

    const info = page.getByRole('button', { name: 'How this quiz works' });
    await expect(info).toBeVisible();

    await info.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Kind, mode-specific copy for flashcard mode.
    await expect(dialog).toContainText('Tap a card to flip it');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('flashcard mode keeps its flag control', async ({ page }) => {
    await openFlashcardPlay(page);
    await expect(page.locator('lib-quiz-flag-banner')).toBeVisible();
  });
});
