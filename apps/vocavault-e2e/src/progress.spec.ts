import { test, expect, Page } from '@playwright/test';

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Seed four words, one at each mastery level. Progress stats are derived directly
 * from each word's masteryLevel, so this makes the displayed numbers deterministic:
 * wordsLearned = Review + Mastered = 2.
 */
async function seedMasteryWords(page: Page) {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const words = [
      { word: 'alpha', definition: 'the first', masteryLevel: 'new' },
      { word: 'beta', definition: 'the second', masteryLevel: 'learning' },
      { word: 'gamma', definition: 'the third', masteryLevel: 'review' },
      { word: 'delta', definition: 'the fourth', masteryLevel: 'mastered' },
    ];
    const stored = words.map((w, i) => ({
      id: `pg-word-${i}`,
      word: w.word,
      pronunciation: '',
      definition: w.definition,
      examples: [],
      masteryLevel: w.masteryLevel,
      createdAt: now,
      updatedAt: now,
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 0,
    }));
    localStorage.setItem('vv_words', JSON.stringify(stored));
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
  await page.getByRole('button', { name: 'Go back' }).click();
  await expect(page.getByRole('heading', { name: 'Dictionary' })).toBeVisible();
}

test.describe('Progress: empty state', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('shows the empty state when there are no words', async ({ page }) => {
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No progress yet' })).toBeVisible();
  });

  test('empty state disappears once a word exists', async ({ page }) => {
    await page.goto('/dictionary');
    await addWord(page, 'ephemeral', 'lasting briefly', true);

    await page.goto('/progress');
    await expect(page.getByTestId('empty-state')).toBeHidden();
    await expect(page.getByTestId('eloquence-card')).toBeVisible();
  });
});

test.describe('Progress: stats render from word mastery', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedMasteryWords(page);
    await page.goto('/progress');
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
  });

  test('eloquence card renders', async ({ page }) => {
    await expect(page.getByTestId('eloquence-card')).toBeVisible();
  });

  test('Words Learned reflects Review + Mastered counts', async ({ page }) => {
    // 1 review + 1 mastered = 2 learned
    const learned = page.locator('.vv-card', { hasText: 'Words Learned' });
    await expect(learned).toContainText('2');
  });

  test('Quizzes Taken is zero before any quiz is played', async ({ page }) => {
    const quizzes = page.locator('.vv-card', { hasText: 'Quizzes Taken' });
    await expect(quizzes).toContainText('0');
  });

  test('mastery breakdown lists all four levels with counts', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Mastery Breakdown' })).toBeVisible();
    const rows = page.getByTestId('mastery-row');
    await expect(rows).toHaveCount(4);
    // Each seeded level has exactly one word
    await expect(rows.filter({ hasText: 'New' })).toContainText('1');
    await expect(rows.filter({ hasText: 'Learning' })).toContainText('1');
    await expect(rows.filter({ hasText: 'Review' })).toContainText('1');
    await expect(rows.filter({ hasText: 'Mastered' })).toContainText('1');
  });

  test('expanding a mastery row reveals the word at that level', async ({ page }) => {
    const masteredRow = page.getByTestId('mastery-row').filter({ hasText: 'Mastered' });
    await masteredRow.click();
    // The mastered word "delta" is revealed under the expanded row
    await expect(page.getByText('delta')).toBeVisible();
  });
});

test.describe('Progress: updates after a quiz', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('taking a quiz increments Quizzes Taken', async ({ page }) => {
    // Add two words through the real UI
    await page.goto('/dictionary');
    await addWord(page, 'ephemeral', 'lasting for a very short time', true);
    await addWord(page, 'serendipity', 'a happy accident');

    // Progress before any quiz: zero quizzes taken
    await page.goto('/progress');
    await expect(page.locator('.vv-card', { hasText: 'Quizzes Taken' })).toContainText('0');

    // Create a quiz set with both words
    await page.goto('/quiz/create');
    await page.getByLabel('Name').fill('Progress Quiz');
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
    await page.getByRole('button', { name: 'Create Quiz Set' }).click();
    await expect(page).toHaveURL(/\/quiz\/[^/]+$/);

    // Play flashcards to completion
    await page.getByRole('button', { name: /Flashcard/ }).click();
    await expect(page).toHaveURL(/\/play\?mode=flashcard/);

    await page.locator('.flashcard').click();
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.locator('.flashcard').click();
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();

    await expect(page.getByText('Quiz Results')).toBeVisible();

    // Progress now shows one quiz taken
    await page.goto('/progress');
    await expect(page.locator('.vv-card', { hasText: 'Quizzes Taken' })).toContainText('1');
  });
});
