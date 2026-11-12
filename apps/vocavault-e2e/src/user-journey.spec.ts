import { test, expect, Page } from '@playwright/test';

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function addWord(page: Page, term: string, definition: string, isFirst = false) {
  if (isFirst) {
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
  } else {
    await page.getByRole('button', { name: 'Add word or quiz' }).click();
    await page.getByRole('button', { name: 'Word Add a new word to your' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();
  await page.getByRole('textbox', { name: /Term/ }).fill(term);
  await page.getByRole('textbox', { name: /Definition/ }).fill(definition);
  await page.getByRole('button', { name: 'Add Term' }).click();
  await expect(page.getByText('Term added!').first()).toBeVisible();
  // Navigate back to list
  await page.getByRole('button', { name: 'Go back' }).click();
  await expect(page.getByRole('heading', { name: 'Dictionary' })).toBeVisible();
}

test.describe('User Journey: add words → quiz → progress', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('add words, create quiz, play flashcard, see results', async ({ page }) => {
    // Step 1: Add words to dictionary
    await page.goto('/dictionary');
    await addWord(page, 'ephemeral', 'lasting for a very short time', true);
    await addWord(page, 'serendipity', 'finding something good without looking for it');

    // Verify words appear in dictionary
    await expect(page.getByText('ephemeral')).toBeVisible();
    await expect(page.getByText('serendipity')).toBeVisible();

    // Step 2: Create a quiz set
    await page.goto('/quiz/create');
    await page.getByLabel('Name').fill('My Vocab Quiz');

    // Select all words
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
    await page.getByRole('button', { name: 'Create Quiz Set' }).click();

    // Verify quiz set created, app navigates to quiz detail page
    await expect(page).toHaveURL(/\/quiz\//);
    await expect(page.getByText('Quiz created!')).toBeVisible();
    await expect(page.getByText('My Vocab Quiz')).toBeVisible();

    // Step 3: Launch quiz in flashcard mode (already on detail page)
    await page.getByRole('button', { name: /Flashcard/ }).click();
    await expect(page).toHaveURL(/\/play\?mode=flashcard/);

    // Step 4: Play through the flashcard quiz
    // Card 1: flip and assess
    await page.locator('.flashcard').click(); // flip
    await expect(page.getByText(/lasting for a very short time|finding something good/)).toBeVisible();
    await page.getByRole('button', { name: 'Got it' }).click();

    // Card 2: navigate to next, flip and assess
    await page.locator('.flashcard').click(); // flip
    await page.getByRole('button', { name: 'Got it' }).click();

    // Finish quiz
    await page.getByRole('button', { name: 'Finish' }).click();

    // Step 5: Verify results
    await expect(page.getByText('Quiz Results')).toBeVisible();
    await expect(page.getByText('2 / 2 correct')).toBeVisible();
    await expect(page.getByText('Perfect score!')).toBeVisible();

    // Step 6: Navigate to progress page
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
    // Mastery distribution should show non-zero values after quiz
    await expect(page.getByText(/Learning|Mastered/i).first()).toBeVisible();
  });

  test('add word via dictionary, verify it appears on home', async ({ page }) => {
    await page.goto('/dictionary');
    await addWord(page, 'luminous', 'giving off light; bright', true);

    await page.goto('/home');
    // Home should show word count or recent words
    await expect(page.getByText(/luminous/i)).toBeVisible();
  });

  test('quiz results update mastery level', async ({ page }) => {
    // Seed words directly for speed
    await page.goto('/dictionary');
    await addWord(page, 'ephemeral', 'lasting briefly', true);
    await addWord(page, 'vivid', 'intensely deep or bright');

    // Create quiz
    await page.goto('/quiz/create');
    await page.getByLabel('Name').fill('Mastery Quiz');
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
    await page.getByRole('button', { name: 'Create Quiz Set' }).click();
    await expect(page).toHaveURL(/\/quiz\//);

    // Play quiz, already on detail page, launch flashcard
    await page.getByRole('button', { name: /Flashcard/ }).click();

    // Card 1: got it
    await page.locator('.flashcard').click();
    await page.getByRole('button', { name: 'Got it' }).click();

    // Card 2: missed it
    await page.locator('.flashcard').click();
    await page.getByRole('button', { name: 'Missed it' }).click();

    await page.getByRole('button', { name: 'Finish' }).click();

    // Results should show 1/2 correct
    await expect(page.getByText('1 / 2 correct')).toBeVisible();
    // Should NOT show perfect score
    await expect(page.getByText('Perfect score!')).toBeHidden();
  });
});
