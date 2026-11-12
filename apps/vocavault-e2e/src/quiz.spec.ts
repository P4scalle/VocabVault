import { test, expect, Page } from '@playwright/test';

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}

async function seedWords(page: Page, count = 4) {
  await page.goto('/dictionary');
  const words = [
    ['ephemeral', 'lasting for a short time'],
    ['sonder', 'the realization that each passerby has a complex life'],
    ['petrichor', 'the smell of earth after rain'],
    ['luminous', 'giving off light; bright'],
  ];
  for (let i = 0; i < count; i++) {
    const [term, def] = words[i];
    if (i === 0) {
      await page.getByRole('button', { name: 'Add Your First Term' }).click();
    } else {
      await page.getByRole('button', { name: 'Add word or quiz' }).click();
      await page.getByRole('button', { name: 'Word Add a new word to your' }).click();
    }
    await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();
    await page.getByRole('textbox', { name: /Term/ }).fill(term);
    await page.getByRole('textbox', { name: /Definition/ }).fill(def);
    await page.getByRole('button', { name: 'Add Term' }).click();
    await expect(page.getByText('Term added!').first()).toBeVisible();
    // Navigate back to list
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.getByRole('heading', { name: 'Dictionary' })).toBeVisible();
  }
}

test.describe('Quiz: Create Quiz Set', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page, 2);
    await page.goto('/quiz');
  });

  test('shows empty state when no quiz sets exist', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'No quiz sets yet' })).toBeVisible();
  });

  test('shell "+" → Quiz navigates to create page', async ({ page }) => {
    await page.getByRole('button', { name: 'Add word or quiz' }).click();
    await page.getByRole('button', { name: 'Quiz Create a new quiz set.' }).click();
    await expect(page).toHaveURL(/\/quiz\/create/);
  });

  test('can create a quiz set with selected words', async ({ page }) => {
    await page.goto('/quiz/create');

    // Fill quiz set name
    await page.getByLabel('Name').fill('My First Quiz');

    // Select words via checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    // Save
    await page.getByRole('button', { name: 'Create Quiz Set' }).click();

    // Should redirect to quiz detail with toast
    await expect(page.getByText('Quiz created!')).toBeVisible();
    await expect(page).toHaveURL(/\/quiz\//);
  });

  test('REGRESSION: quiz create only creates one set', async ({ page }) => {
    await page.goto('/quiz/create');
    await page.getByLabel('Name').fill('Single Quiz');

    // Select first word
    await page.locator('input[type="checkbox"]').first().check();

    await page.getByRole('button', { name: 'Create Quiz Set' }).click();
    await expect(page).toHaveURL(/\/quiz\//);

    // Go to quiz list and verify only one card
    await page.goto('/quiz');
    const quizCards = page.locator('lib-quiz-set-card');
    await expect(quizCards).toHaveCount(1);
  });
});

test.describe('Quiz: Delete Quiz Set', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page, 2);
    // Create a quiz set
    await page.goto('/quiz/create');
    await page.getByLabel('Name').fill('Delete Me');
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByRole('button', { name: 'Create Quiz Set' }).click();
    await expect(page).toHaveURL(/\/quiz\//);
    // Navigate to quiz list for delete test
    await page.goto('/quiz');
  });

  test('deleting a quiz set removes it and shows toast', async ({ page }) => {
    // Hold-button: double-press Enter to confirm (keyboard path)
    // Enable reduced motion so hold-button uses instant keyboard confirm path
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const deleteBtn = page.getByRole('button', { name: /Hold to delete Delete Me/ });
    await deleteBtn.click(); // first click → confirming
    await expect(deleteBtn).toHaveClass(/vv-hold-button--confirming/); // wait for confirm state
    await deleteBtn.click(); // second click → confirmed
    await expect(page.getByText('Quiz set deleted')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No quiz sets yet' })).toBeVisible();
  });
});
