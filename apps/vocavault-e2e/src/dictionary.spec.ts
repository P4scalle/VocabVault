import { test, expect, Page } from '@playwright/test';

// Helper: clear localStorage before each test for isolation
async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}

// Helper: add a term using the shell "+" → Word flow (works when words already exist)
async function addTermViaShell(page: Page, term: string, definition: string) {
  await page.getByRole('button', { name: 'Add word or quiz' }).click();
  await page.getByRole('button', { name: 'Word Add a new word to your' }).click();
  await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();
  await page.getByRole('textbox', { name: /Term/ }).fill(term);
  await page.getByRole('textbox', { name: /Definition/ }).fill(definition);
  await page.getByRole('button', { name: 'Add Term' }).click();
  await expect(page.getByText('Term added!').first()).toBeVisible();
  // Navigate back to list
  await page.getByRole('button', { name: 'Go back' }).click();
  await expect(page.getByRole('heading', { name: 'Dictionary' })).toBeVisible();
}

test.describe('Dictionary — Add Term', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.goto('/dictionary');
  });

  test('shows empty state when no terms exist', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Your dictionary is empty' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Your First Term' })).toBeVisible();
  });

  test('opens add form from empty state button', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Term/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Definition/ })).toBeVisible();
  });

  test('submit button is disabled until term AND definition are filled', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    const submitBtn = page.getByRole('button', { name: 'Add Term' });

    // Both empty → disabled
    await expect(submitBtn).toBeDisabled();

    // Only term → still disabled
    await page.getByRole('textbox', { name: /Term/ }).fill('hello');
    await expect(submitBtn).toBeDisabled();

    // Clear term, only definition → still disabled
    await page.getByRole('textbox', { name: /Term/ }).clear();
    await page.getByRole('textbox', { name: /Definition/ }).fill('a greeting');
    await expect(submitBtn).toBeDisabled();

    // Both filled → enabled
    await page.getByRole('textbox', { name: /Term/ }).fill('hello');
    await expect(submitBtn).toBeEnabled();
  });

  test('adds a term and shows toast, stays in add mode', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await page.getByRole('textbox', { name: /Term/ }).fill('ephemeral');
    await page.getByRole('textbox', { name: /Definition/ }).fill('lasting for a short time');
    await page.getByRole('button', { name: 'Add Term' }).click();

    // Should show toast
    await expect(page.getByText('Term added!').first()).toBeVisible();
    // Should stay in add mode with cleared form
    await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();

    // Navigate back to list to verify the term was saved
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.getByRole('heading', { name: 'Dictionary' })).toBeVisible();
    await expect(page.getByText('ephemeral')).toBeVisible();
    await expect(page.getByText('lasting for a short time')).toBeVisible();
  });

  test('REGRESSION: adding a term does NOT create duplicates', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await page.getByRole('textbox', { name: /Term/ }).fill('unique-word');
    await page.getByRole('textbox', { name: /Definition/ }).fill('should appear once');
    await page.getByRole('button', { name: 'Add Term' }).click();

    // Navigate back to list
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.getByRole('heading', { name: 'Dictionary' })).toBeVisible();

    // Count occurrences — must be exactly 1
    const cards = page.locator('lib-word-card');
    await expect(cards).toHaveCount(1);
  });

  test('form clears after adding a term (stay in add mode)', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await page.getByRole('textbox', { name: /Term/ }).fill('love');
    await page.getByRole('textbox', { name: /Definition/ }).fill('strong affection');

    // Add an example
    const exampleInput = page.getByRole('textbox', { name: 'Example sentence' }).first();
    await exampleInput.fill('I love you');

    await page.getByRole('button', { name: 'Add Term' }).click();

    // Should stay on add form (not return to list)
    await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();

    // All fields should be cleared
    await expect(page.getByRole('textbox', { name: /Term/ })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: /Definition/ })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: /Pronunciation/ })).toHaveValue('');

    // Examples should be reset to a single empty input
    const examples = page.getByRole('textbox', { name: 'Example sentence' });
    await expect(examples).toHaveCount(1);
    await expect(examples.first()).toHaveValue('');

    // Term input should be focused for next word
    await expect(page.getByRole('textbox', { name: /Term/ })).toBeFocused();
  });

  test('REGRESSION: examples do not persist between adding terms', async ({ page }) => {
    // Add first term with examples
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await page.getByRole('textbox', { name: /Term/ }).fill('love');
    await page.getByRole('textbox', { name: /Definition/ }).fill('strong affection');
    const exampleInput = page.getByRole('textbox', { name: 'Example sentence' }).first();
    await exampleInput.fill('I love you');
    await page.getByRole('button', { name: 'Add Term' }).click();

    // Should stay in add mode with clean form
    await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();

    // Fill second term — examples should NOT contain "I love you"
    await page.getByRole('textbox', { name: /Term/ }).fill('special');
    await page.getByRole('textbox', { name: /Definition/ }).fill('unique');

    // Verify only one empty example input exists, no leftover from previous term
    const examples = page.getByRole('textbox', { name: 'Example sentence' });
    await expect(examples).toHaveCount(1);
    await expect(examples.first()).toHaveValue('');
  });

  test('can add multiple terms sequentially without duplicates', async ({ page }) => {
    // Add first term via empty state
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await page.getByRole('textbox', { name: /Term/ }).fill('word-one');
    await page.getByRole('textbox', { name: /Definition/ }).fill('definition one');
    await page.getByRole('button', { name: 'Add Term' }).click();
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.locator('lib-word-card')).toHaveCount(1);

    // Add second term via shell "+" button → Word
    await addTermViaShell(page, 'word-two', 'definition two');
    await expect(page.locator('lib-word-card')).toHaveCount(2);

    // Add third term via shell "+" button again
    await addTermViaShell(page, 'word-three', 'definition three');
    await expect(page.locator('lib-word-card')).toHaveCount(3);
  });
});

test.describe('Dictionary — Add via Shell Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('shell "+" → Word opens add form on dictionary page', async ({ page }) => {
    await page.goto('/dictionary');
    await page.getByRole('button', { name: 'Add word or quiz' }).click();
    await page.getByRole('button', { name: 'Word Add a new word to your' }).click();

    await expect(page).toHaveURL(/\/dictionary\?addWord=true/);
    await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();
  });

  test('REGRESSION: shell "+" → Word opens form even when already on dictionary', async ({ page }) => {
    await page.goto('/dictionary');
    await expect(page.getByRole('heading', { name: 'Dictionary', exact: true })).toBeVisible();

    // Use shell add button while already on dictionary
    await page.getByRole('button', { name: 'Add word or quiz' }).click();
    const wordAction = page.getByRole('button', { name: 'Word Add a new word to your' });
    await expect(wordAction).toBeVisible();
    await wordAction.click();

    // Form must open
    await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();
  });

  test('REGRESSION: shell "+" → Word opens form from a different page', async ({ page }) => {
    await page.goto('/quiz');
    await page.getByRole('button', { name: 'Add word or quiz' }).click();
    await page.getByRole('button', { name: 'Word Add a new word to your' }).click();

    // Should navigate to dictionary with form open
    await expect(page).toHaveURL(/\/dictionary\?addWord=true/);
    await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();
  });

  test('query param is cleared after saving', async ({ page }) => {
    await page.goto('/dictionary?addWord=true');
    await page.getByRole('textbox', { name: /Term/ }).fill('test');
    await page.getByRole('textbox', { name: /Definition/ }).fill('test def');
    await page.getByRole('button', { name: 'Add Term' }).click();

    // URL should no longer have addWord param
    await expect(page).not.toHaveURL(/addWord/);
  });
});

test.describe('Dictionary — Edit & Delete', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.goto('/dictionary');
    // Seed a word
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await page.getByRole('textbox', { name: /Term/ }).fill('ephemeral');
    await page.getByRole('textbox', { name: /Definition/ }).fill('lasting briefly');
    await page.getByRole('button', { name: 'Add Term' }).click();
    // Navigate back to list to see the word
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.getByText('ephemeral')).toBeVisible();
  });

  test('clicking a word card opens edit form with pre-filled data', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit ephemeral' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Term' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Term/ })).toHaveValue('ephemeral');
    await expect(page.getByRole('textbox', { name: /Definition/ })).toHaveValue('lasting briefly');
  });

  test('editing a word updates it without creating a duplicate', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit ephemeral' }).click();
    await page.getByRole('textbox', { name: /Definition/ }).clear();
    await page.getByRole('textbox', { name: /Definition/ }).fill('updated definition');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText('updated definition')).toBeVisible();
    await expect(page.getByText('lasting briefly')).toBeHidden();
    // Still only 1 card
    await expect(page.locator('lib-word-card')).toHaveCount(1);
    await expect(page.getByText('Term updated!')).toBeVisible();
  });

  test('deleting a word from the card removes it', async ({ page }) => {
    // Enable reduced motion so hold-button uses instant keyboard confirm path
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const deleteBtn = page.getByRole('button', { name: /Hold to delete ephemeral/ });
    await deleteBtn.click(); // first click → confirming state (instant via reduced motion)
    await expect(deleteBtn).toHaveClass(/vv-hold-button--confirming/); // wait for confirm state
    await deleteBtn.click(); // second click → confirmed
    await expect(page.getByRole('heading', { name: 'Your dictionary is empty' })).toBeVisible();
    await expect(page.getByText('Term deleted')).toBeVisible();
  });

  test('deleting a word from the edit form removes it', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit ephemeral' }).click();
    // Hold-button: double-press Enter to confirm
    const deleteBtn = page.getByRole('button', { name: /Hold to delete term/ });
    await deleteBtn.press('Enter');
    await deleteBtn.press('Enter');
    await expect(page.getByRole('heading', { name: 'Your dictionary is empty' })).toBeVisible();
  });

  test('cancel from add form returns to list without changes', async ({ page }) => {
    await page.getByRole('button', { name: 'Add word or quiz' }).click();
    await page.getByRole('button', { name: 'Word Add a new word to your' }).click();
    await page.getByRole('textbox', { name: /Term/ }).fill('should-not-save');
    await page.getByRole('button', { name: 'Go back' }).click();

    // Back to list, no new card
    await expect(page.locator('lib-word-card')).toHaveCount(1);
    await expect(page.getByText('should-not-save')).toBeHidden();
  });
});

test.describe('Dictionary — Search', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.goto('/dictionary');
    // Seed first word via empty state
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await page.getByRole('textbox', { name: /Term/ }).fill('apple');
    await page.getByRole('textbox', { name: /Definition/ }).fill('a fruit');
    await page.getByRole('button', { name: 'Add Term' }).click();
    // Navigate back to list
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.getByRole('heading', { name: 'Dictionary' })).toBeVisible();
    // Seed second word via shell "+" button
    await addTermViaShell(page, 'zebra', 'an animal');
  });

  test('search filters words by term', async ({ page }) => {
    await page.getByLabel('Search dictionary words').fill('apple');
    await expect(page.locator('lib-word-card')).toHaveCount(1);
    await expect(page.getByText('apple')).toBeVisible();
    await expect(page.getByText('zebra')).toBeHidden();
  });

  test('search filters words by word prefix', async ({ page }) => {
    // Search matches word names (not definitions) via prefix matching
    await page.getByLabel('Search dictionary words').fill('zeb');
    await expect(page.locator('lib-word-card')).toHaveCount(1);
    await expect(page.getByText('zebra')).toBeVisible();
  });

  test('clearing search shows all words', async ({ page }) => {
    await page.getByLabel('Search dictionary words').fill('apple');
    await expect(page.locator('lib-word-card')).toHaveCount(1);
    await page.getByLabel('Search dictionary words').clear();
    await expect(page.locator('lib-word-card')).toHaveCount(2);
  });

  test('no results shows appropriate message', async ({ page }) => {
    await page.getByLabel('Search dictionary words').fill('xyznonexistent');
    await expect(page.getByText('No words found')).toBeVisible();
  });
});
