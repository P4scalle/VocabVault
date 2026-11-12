import { test, expect, Page } from '@playwright/test';

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Seed words directly into localStorage so quiz creation is fast and deterministic.
 */
async function seedWords(page: Page) {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const words = [
      { word: 'ephemeral', definition: 'lasting for a short time' },
      { word: 'sonder', definition: 'the realization others have complex lives' },
      { word: 'petrichor', definition: 'the smell of earth after rain' },
      { word: 'luminous', definition: 'giving off light; bright' },
    ];
    const stored = words.map((w, i) => ({
      id: `qm-word-${i}`,
      word: w.word,
      pronunciation: '',
      definition: w.definition,
      examples: [],
      masteryLevel: 'new',
      createdAt: now,
      updatedAt: now,
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 0,
    }));
    localStorage.setItem('vv_words', JSON.stringify(stored));
  });
}

async function createQuizSet(page: Page, name: string, wordCount = 2) {
  await page.goto('/quiz/create');
  await expect(page.getByRole('heading', { name: 'New Quiz Set' })).toBeVisible();
  await page.getByLabel('Name').fill(name);
  const checkboxes = page.locator('input[type="checkbox"]');
  for (let i = 0; i < wordCount; i++) {
    await checkboxes.nth(i).check();
  }
  await page.getByRole('button', { name: 'Create Quiz Set' }).click();
  await expect(page).toHaveURL(/\/quiz\/[^/]+$/);
  await expect(page.getByText('Quiz created!')).toBeVisible();
}

test.describe('Quiz Management — Create', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);
    await page.goto('/quiz');
  });

  test('create page shows the New Quiz Set heading and disabled save', async ({ page }) => {
    await page.goto('/quiz/create');
    await expect(page.getByRole('heading', { name: 'New Quiz Set' })).toBeVisible();
    // Save is disabled until a name AND at least one word are chosen
    await expect(page.getByRole('button', { name: 'Create Quiz Set' })).toBeDisabled();
  });

  test('save enables only after name and a word are selected', async ({ page }) => {
    await page.goto('/quiz/create');
    const save = page.getByRole('button', { name: 'Create Quiz Set' });

    await page.getByLabel('Name').fill('Partial');
    await expect(save).toBeDisabled(); // name but no words

    await page.locator('input[type="checkbox"]').first().check();
    await expect(save).toBeEnabled(); // now both present
  });

  test('creating a set navigates to detail and lists it on the quiz page', async ({ page }) => {
    await createQuizSet(page, 'Vocabulary One');
    await expect(page.getByRole('heading', { name: 'Vocabulary One' })).toBeVisible();

    await page.goto('/quiz');
    // goto re-bootstraps the app on the static server; under full-suite parallel
    // load the list can exceed the default 5s budget before the card renders.
    await expect(page.locator('lib-quiz-set-card')).toHaveCount(1, { timeout: 15000 });
    await expect(page.getByText('Vocabulary One')).toBeVisible();
  });

  test('Select All selects every available word', async ({ page }) => {
    await page.goto('/quiz/create');
    await page.getByLabel('Name').fill('All Words');
    await page.getByRole('button', { name: 'Select All' }).click();

    const checkboxes = page.locator('input[type="checkbox"]');
    const total = await checkboxes.count();
    for (let i = 0; i < total; i++) {
      await expect(checkboxes.nth(i)).toBeChecked();
    }
    // Count badge reflects 4 of 4 seeded words
    await expect(page.getByText('4 of 4 selected')).toBeVisible();
  });
});

test.describe('Quiz Management — Edit', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);
    await createQuizSet(page, 'Editable Set', 2);
  });

  test('pencil on detail opens the edit form pre-filled', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit quiz set' }).click();
    await expect(page).toHaveURL(/\/quiz\/[^/]+\/edit$/);
    await expect(page.getByRole('heading', { name: 'Edit Quiz Set' })).toBeVisible();
    await expect(page.getByLabel('Name')).toHaveValue('Editable Set');
  });

  test('renaming a set persists the new name', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit quiz set' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Quiz Set' })).toBeVisible();

    await page.getByLabel('Name').fill('Renamed Set');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText('Quiz updated!')).toBeVisible();
    await expect(page).toHaveURL(/\/quiz\/[^/]+$/);
    await expect(page.getByRole('heading', { name: 'Renamed Set' })).toBeVisible();

    // Still exactly one set after an edit — no duplicate
    await page.goto('/quiz');
    await expect(page.locator('lib-quiz-set-card')).toHaveCount(1);
    await expect(page.getByText('Renamed Set')).toBeVisible();
  });

  test('adding more words via edit updates the word count', async ({ page }) => {
    // Detail shows "2 words" initially
    await expect(page.getByText('2 words')).toBeVisible();

    await page.getByRole('button', { name: 'Edit quiz set' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Quiz Set' })).toBeVisible();

    // Select all 4 seeded words, then save
    await page.getByRole('button', { name: 'Select All' }).click();
    await expect(page.getByText('4 of 4 selected')).toBeVisible();
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText('Quiz updated!')).toBeVisible();
    await expect(page.getByText('4 words')).toBeVisible();
  });

  test('canceling the edit returns to detail without changes', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit quiz set' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Quiz Set' })).toBeVisible();

    await page.getByLabel('Name').fill('Should Not Persist');
    await page.getByRole('button', { name: /Go back/ }).click();

    await expect(page).toHaveURL(/\/quiz\/[^/]+$/);
    await expect(page.getByRole('heading', { name: 'Editable Set' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Should Not Persist' })).toBeHidden();
  });
});

test.describe('Quiz Management — Delete with undo', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);
    await createQuizSet(page, 'Doomed Set', 2);
  });

  test('deleting from the edit form removes the set and offers undo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Edit quiz set' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Quiz Set' })).toBeVisible();

    const deleteBtn = page.getByRole('button', { name: /Hold to delete quiz set/ });
    await deleteBtn.click(); // confirming
    await expect(deleteBtn).toHaveClass(/vv-hold-button--confirming/);
    await deleteBtn.click(); // confirmed

    await expect(page.getByText('Quiz deleted')).toBeVisible();
    await expect(page).toHaveURL(/\/quiz$/);
    await expect(page.getByRole('heading', { name: 'No quiz sets yet' })).toBeVisible();
  });

  test('undo after delete restores the set', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Edit quiz set' }).click();

    const deleteBtn = page.getByRole('button', { name: /Hold to delete quiz set/ });
    await deleteBtn.click();
    await expect(deleteBtn).toHaveClass(/vv-hold-button--confirming/);
    await deleteBtn.click();

    await expect(page.getByText('Quiz deleted')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();

    // Restored set reappears in the list
    await page.goto('/quiz');
    await expect(page.locator('lib-quiz-set-card')).toHaveCount(1);
    await expect(page.getByText('Doomed Set')).toBeVisible();
  });
});
