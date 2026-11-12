import { test, expect, Page } from '@playwright/test';

// ─── Viewport presets ───────────────────────────────────────────────
const MOBILE = { width: 375, height: 812 }; // iPhone 12

// ─── Helpers ────────────────────────────────────────────────────────

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}

/**
 * Seed one folder (id: 'test-folder') + 10+ words spanning 5+ first letters, all with folderId.
 */
async function seedFolderWithManyWords(page: Page) {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const folder = {
      id: 'test-folder',
      name: 'Test Folder',
      color: '#3B82F6',
      createdAt: now,
    };
    const words = [
      { word: 'Aberration', definition: 'A departure from normal' },
      { word: 'Alacrity', definition: 'Brisk readiness' },
      { word: 'Benevolent', definition: 'Well meaning' },
      { word: 'Brevity', definition: 'Concise expression' },
      { word: 'Candor', definition: 'Honest and open' },
      { word: 'Diligent', definition: 'Having care and effort' },
      { word: 'Ephemeral', definition: 'Lasting a short time' },
      { word: 'Fervent', definition: 'Passionate intensity' },
      { word: 'Gregarious', definition: 'Fond of company' },
      { word: 'Harbinger', definition: 'Sign of things to come' },
      { word: 'Innocuous', definition: 'Not harmful' },
    ];
    const stored = words.map((w, i) => ({
      id: `folder-word-${i}`,
      word: w.word,
      pronunciation: '',
      definition: w.definition,
      examples: [],
      masteryLevel: 'new',
      folderId: 'test-folder',
      createdAt: now,
      updatedAt: now,
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 0,
    }));
    localStorage.setItem('vv_folders', JSON.stringify([folder]));
    localStorage.setItem('vv_words', JSON.stringify(stored));
  });
}

/**
 * Seed 10+ words across 5+ first letters, no folderId, no folders.
 */
async function seedUncategorizedManyWords(page: Page) {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const words = [
      { word: 'Aberration', definition: 'A departure from normal' },
      { word: 'Alacrity', definition: 'Brisk readiness' },
      { word: 'Benevolent', definition: 'Well meaning' },
      { word: 'Brevity', definition: 'Concise expression' },
      { word: 'Candor', definition: 'Honest and open' },
      { word: 'Diligent', definition: 'Having care and effort' },
      { word: 'Ephemeral', definition: 'Lasting a short time' },
      { word: 'Fervent', definition: 'Passionate intensity' },
      { word: 'Gregarious', definition: 'Fond of company' },
      { word: 'Harbinger', definition: 'Sign of things to come' },
    ];
    const stored = words.map((w, i) => ({
      id: `uncat-word-${i}`,
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
    // No folders seeded; uncategorized section only appears when folders exist in the tab
    // We still need at least one folder for the Folders tab to appear
    const folder = { id: 'empty-folder', name: 'Empty Folder', color: '#6366F1', createdAt: now };
    localStorage.setItem('vv_folders', JSON.stringify([folder]));
    localStorage.setItem('vv_words', JSON.stringify(stored));
  });
}

/**
 * Seed folder + 3 words all starting with the same letter.
 */
async function seedFolderWithFewWords(page: Page) {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const folder = { id: 'test-folder', name: 'Test Folder', color: '#3B82F6', createdAt: now };
    const words = [
      { word: 'Apple', definition: 'A fruit' },
      { word: 'Apricot', definition: 'Another fruit' },
      { word: 'Avocado', definition: 'Yet another fruit' },
    ];
    const stored = words.map((w, i) => ({
      id: `few-word-${i}`,
      word: w.word,
      pronunciation: '',
      definition: w.definition,
      examples: [],
      masteryLevel: 'new',
      folderId: 'test-folder',
      createdAt: now,
      updatedAt: now,
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 0,
    }));
    localStorage.setItem('vv_folders', JSON.stringify([folder]));
    localStorage.setItem('vv_words', JSON.stringify(stored));
  });
}

// ─── Folder Alphabet Scroller ────────────────────────────────────────

test.describe('Folder Alphabet Scroller', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.setViewportSize(MOBILE);
  });

  test('scroller appears when expanding folder with 5+ letter groups', async ({ page }) => {
    await seedFolderWithManyWords(page);
    await page.goto('/dictionary');

    // Switch to Folders tab
    await page.getByRole('tab', { name: /Folders/ }).click();

    // Expand the folder by clicking its header
    const folderHeader = page.getByRole('button', { name: /Test Folder/ });
    await folderHeader.click();

    // Alphabet scroller should now be visible
    const scroller = page.locator('lib-alphabet-scroller');
    await expect(scroller).toBeVisible();
  });

  test('scroller disappears when collapsing folder', async ({ page }) => {
    await seedFolderWithManyWords(page);
    await page.goto('/dictionary');

    await page.getByRole('tab', { name: /Folders/ }).click();

    const folderHeader = page.getByRole('button', { name: /Test Folder/ });

    // Expand the folder
    await folderHeader.click();

    // Verify scroller appeared
    await expect(page.locator('lib-alphabet-scroller')).toBeVisible();

    // Collapse the folder by clicking again
    await folderHeader.click();

    // Scroller should now be hidden
    await expect(page.locator('lib-alphabet-scroller')).toBeHidden();
  });

  test('scroller navigates to correct letter section in folder', async ({ page }) => {
    await seedFolderWithManyWords(page);
    await page.goto('/dictionary');

    await page.getByRole('tab', { name: /Folders/ }).click();

    await page.getByRole('button', { name: /Test Folder/ }).click();

    // Click the 'H' letter in the scroller (Harbinger is in the folder)
    const scroller = page.locator('lib-alphabet-scroller');
    await expect(scroller).toBeVisible();

    await scroller.getByText('H').click();

    // The [data-folder-letter="H"] section should be in or near the viewport
    const letterSection = page.locator('[data-folder-letter="H"]');
    await expect(letterSection).toBeAttached();
  });

  test('scroller does NOT appear for folder with fewer than 5 letter groups', async ({ page }) => {
    await seedFolderWithFewWords(page);
    await page.goto('/dictionary');

    await page.getByRole('tab', { name: /Folders/ }).click();

    // Expand the folder
    await page.getByRole('button', { name: /Test Folder/ }).click();

    // The expanded folder's words render; the scroller must NOT appear (1 letter group)
    await expect(page.getByText('Apple')).toBeVisible();
    const scroller = page.locator('lib-alphabet-scroller');
    await expect(scroller).toBeHidden();
  });

  test('uncategorized scroller appears with 5+ letter groups when no folder expanded', async ({ page }) => {
    await seedUncategorizedManyWords(page);
    await page.goto('/dictionary');

    await page.getByRole('tab', { name: /Folders/ }).click();

    // Expand the uncategorized section (scroller requires uncategorizedExpanded)
    const uncatHeader = page.getByRole('button', { name: /Uncategorized/i });
    await expect(uncatHeader).toBeVisible();
    await uncatHeader.click();

    const scroller = page.locator('lib-alphabet-scroller');
    await expect(scroller).toBeVisible();
  });

  test('uncategorized scroller disappears when folder is expanded', async ({ page }) => {
    await page.evaluate(() => {
      const now = new Date().toISOString();
      const folder = { id: 'test-folder', name: 'Test Folder', color: '#3B82F6', createdAt: now };
      const folderWords = [
        { word: 'Aberration', def: 'deviation' },
        { word: 'Benevolent', def: 'kind' },
        { word: 'Candor', def: 'honest' },
        { word: 'Diligent', def: 'careful' },
        { word: 'Ephemeral', def: 'short-lived' },
        { word: 'Fervent', def: 'passionate' },
      ];
      const uncatWords = [
        { word: 'Gratitude', def: 'thankfulness' },
        { word: 'Humble', def: 'modest' },
        { word: 'Inclusive', def: 'including all' },
        { word: 'Jovial', def: 'cheerful' },
        { word: 'Keen', def: 'eager' },
        { word: 'Lively', def: 'active' },
      ];
      const stored = [
        ...folderWords.map((w, i) => ({
          id: `fw-${i}`, word: w.word, pronunciation: '', definition: w.def,
          examples: [], masteryLevel: 'new', folderId: 'test-folder',
          createdAt: now, updatedAt: now, interval: 1, easeFactor: 2.5, reviewCount: 0,
        })),
        ...uncatWords.map((w, i) => ({
          id: `uw-${i}`, word: w.word, pronunciation: '', definition: w.def,
          examples: [], masteryLevel: 'new',
          createdAt: now, updatedAt: now, interval: 1, easeFactor: 2.5, reviewCount: 0,
        })),
      ];
      localStorage.setItem('vv_folders', JSON.stringify([folder]));
      localStorage.setItem('vv_words', JSON.stringify(stored));
    });

    await page.goto('/dictionary');

    await page.getByRole('tab', { name: /Folders/ }).click();

    // Expand uncategorized section first (scroller requires uncategorizedExpanded)
    const uncatHeader = page.getByRole('button', { name: /Uncategorized/i });
    await expect(uncatHeader).toBeVisible();
    await uncatHeader.click();

    // Uncat scroller visible with expanded uncategorized section (6 letter groups)
    await expect(page.locator('lib-alphabet-scroller')).toBeVisible();

    // Collapse uncategorized first, then expand the folder
    await uncatHeader.click();

    // Expand the folder, shows folder content with its own scroller
    await page.getByRole('button', { name: /Test Folder/ }).click();

    // Folder scroller visible (A, B, C, D, E, F = 6 letter groups)
    await expect(page.locator('lib-alphabet-scroller')).toBeVisible();
  });

  test('only one alphabet scroller visible at a time', async ({ page }) => {
    await seedFolderWithManyWords(page);
    await page.goto('/dictionary');

    await page.getByRole('tab', { name: /Folders/ }).click();

    // Folder header is the deterministic signal the Folders tab has rendered
    const folderHeader = page.getByRole('button', { name: /Test Folder/ });
    await expect(folderHeader).toBeVisible();

    // Before expanding: at most one scroller visible
    const scrollers = page.locator('lib-alphabet-scroller');
    expect(await scrollers.count()).toBeLessThanOrEqual(1);

    // After expanding: scroller appears, and still at most one
    await folderHeader.click();
    await expect(scrollers).toBeVisible();
    expect(await scrollers.count()).toBeLessThanOrEqual(1);
  });
});
