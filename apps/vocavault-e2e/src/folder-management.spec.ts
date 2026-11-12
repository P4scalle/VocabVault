import { test, expect, Page } from '@playwright/test';

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Seed a set of uncategorized words (no folders). The Folders tab lets the user
 * create folders and assign these words.
 */
async function seedWords(page: Page) {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const words = [
      { word: 'Aberration', definition: 'A departure from normal' },
      { word: 'Benevolent', definition: 'Well meaning' },
      { word: 'Candor', definition: 'Honest and open' },
      { word: 'Diligent', definition: 'Having care and effort' },
    ];
    const stored = words.map((w, i) => ({
      id: `fm-word-${i}`,
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

/** Open the Folders tab on the dictionary page (requires at least one word to exist). */
async function openFoldersTab(page: Page) {
  await page.goto('/dictionary');
  await expect(page.getByRole('heading', { name: 'Dictionary', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Folders/ }).click();
}

/** A folder header row is the collapsible button carrying aria-expanded. */
function folderHeader(page: Page, name: string) {
  return page.locator('button[aria-expanded]').filter({ hasText: name });
}

/** Create a folder from the Folders tab. */
async function createFolder(page: Page, name: string) {
  await page.getByRole('button', { name: /Create Your First Folder|New Folder/ }).click();
  const nameInput = page.getByRole('textbox', { name: 'Folder name' });
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  // The new folder's header row is the deterministic signal it was created.
  // (The transient "Folder created!" toast is verified in a dedicated test.)
  await expect(folderHeader(page, name)).toBeVisible();
}

test.describe('Folder Management — Create', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);
    await openFoldersTab(page);
  });

  test('empty folders tab shows the create prompt', async ({ page }) => {
    await expect(page.getByTestId('folders-empty-state')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Your First Folder/ })).toBeVisible();
  });

  test('creating a folder shows it in the list with a zero count', async ({ page }) => {
    await createFolder(page, 'Science');
    await expect(page.getByText('Folder created!')).toBeVisible();
    await expect(folderHeader(page, 'Science')).toBeVisible();
    // New folder starts empty
    await expect(page.getByTestId('folders-empty-state')).toBeHidden();
  });

  test('the folder form create button is disabled until a name is typed', async ({ page }) => {
    await page.getByRole('button', { name: /Create Your First Folder/ }).click();
    const create = page.getByRole('button', { name: 'Create', exact: true });
    await expect(create).toBeDisabled();

    await page.getByRole('textbox', { name: 'Folder name' }).fill('Travel');
    await expect(create).toBeEnabled();
  });

  test('can create multiple folders', async ({ page }) => {
    await createFolder(page, 'Science');
    await createFolder(page, 'History');
    await expect(folderHeader(page, 'Science')).toBeVisible();
    await expect(folderHeader(page, 'History')).toBeVisible();
  });
});

test.describe('Folder Management — Rename', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);
    await openFoldersTab(page);
    await createFolder(page, 'Draft Name');
  });

  test('renaming a folder updates its label', async ({ page }) => {
    // Folder is auto-expanded after creation — open its options menu
    await page.getByRole('button', { name: 'Folder options' }).click();
    // The overflow menu is a plain button popover (not role="menu"/"menuitem") —
    // it intentionally avoids an unmet roving-focus ARIA contract, so the Rename
    // action is a button, matched by its accessible name.
    await page.getByRole('button', { name: /Rename/ }).click();

    const nameInput = page.getByRole('textbox', { name: 'Folder name' });
    await expect(nameInput).toHaveValue('Draft Name');
    await nameInput.fill('Final Name');
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByText('Folder updated!')).toBeVisible();
    await expect(folderHeader(page, 'Final Name')).toBeVisible();
    await expect(folderHeader(page, 'Draft Name')).toBeHidden();
  });
});

test.describe('Folder Management — Assign words', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);
    await openFoldersTab(page);
    await createFolder(page, 'My Folder');
  });

  test('the word picker adds selected words to the folder', async ({ page }) => {
    // Expanded empty folder offers a "Pick words to add" button
    await page.getByRole('button', { name: /Pick words to add/ }).click();

    // Bottom-sheet word picker
    await expect(page.getByRole('heading', { name: /Add to My Folder/ })).toBeVisible();

    // Pick two words via their role=checkbox rows
    await page.getByRole('checkbox', { name: /Aberration/ }).click();
    await page.getByRole('checkbox', { name: /Benevolent/ }).click();

    // Confirm button label reflects selection count
    await page.getByRole('button', { name: /Add 2 words/ }).click();

    await expect(page.getByText(/2 words added to My Folder/)).toBeVisible();
    // Folder count badge now shows 2 assigned words
    await expect(folderHeader(page, 'My Folder')).toContainText('2');
  });

  test('Select all in the picker adds every assignable word', async ({ page }) => {
    await page.getByRole('button', { name: /Pick words to add/ }).click();
    await expect(page.getByRole('heading', { name: /Add to My Folder/ })).toBeVisible();

    await page.getByRole('checkbox', { name: /Select all/ }).click();
    // 4 seeded words are all assignable
    await page.getByRole('button', { name: /Add 4 words/ }).click();

    await expect(page.getByText(/4 words added to My Folder/)).toBeVisible();
    await expect(folderHeader(page, 'My Folder')).toContainText('4');
  });
});

test.describe('Folder Management — Delete with undo', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);
    await openFoldersTab(page);
    await createFolder(page, 'Trash Me');
  });

  test('deleting an empty folder removes it and offers undo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.getByRole('button', { name: 'Folder options' }).click();
    const deleteBtn = page.getByRole('button', { name: /Hold to delete Trash Me/ });
    await deleteBtn.click(); // confirming
    await expect(deleteBtn).toHaveClass(/vv-hold-button--confirming/);
    await deleteBtn.click(); // confirmed

    await expect(page.getByText('Folder deleted')).toBeVisible();
    await expect(folderHeader(page, 'Trash Me')).toBeHidden();
  });

  test('undo restores a deleted folder', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.getByRole('button', { name: 'Folder options' }).click();
    const deleteBtn = page.getByRole('button', { name: /Hold to delete Trash Me/ });
    await deleteBtn.click();
    await expect(deleteBtn).toHaveClass(/vv-hold-button--confirming/);
    await deleteBtn.click();

    await expect(page.getByText('Folder deleted')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();

    await expect(folderHeader(page, 'Trash Me')).toBeVisible();
  });
});
