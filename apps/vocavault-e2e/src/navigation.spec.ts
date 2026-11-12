import { test, expect, Page } from '@playwright/test';

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('default route redirects to home', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/home/);
  });

  test('nav links navigate between pages', async ({ page }) => {
    await page.goto('/home');

    // Use visible links (desktop top navbar is the last nav element)
    await page.getByRole('link', { name: 'Dictionary' }).last().click();
    await expect(page).toHaveURL(/\/dictionary/);

    await page.getByRole('link', { name: 'Quiz' }).last().click();
    await expect(page).toHaveURL(/\/quiz/);

    await page.getByRole('link', { name: 'Progress' }).last().click();
    await expect(page).toHaveURL(/\/progress/);

    await page.getByRole('link', { name: 'Home' }).last().click();
    await expect(page).toHaveURL(/\/home/);
  });
});

test.describe('Toast Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('toast appears and auto-dismisses', async ({ page }) => {
    await page.goto('/dictionary');
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await page.getByRole('textbox', { name: /Term/ }).fill('test');
    await page.getByRole('textbox', { name: /Definition/ }).fill('test def');
    await page.getByRole('button', { name: 'Add Term' }).click();

    // Toast is visible
    const toast = page.getByText('Term added!');
    await expect(toast).toBeVisible();

    // Toast auto-dismisses after 3 seconds
    await expect(toast).not.toBeVisible({ timeout: 5000 });
  });

  test('REGRESSION: toast does not duplicate on single action', async ({ page }) => {
    await page.goto('/dictionary');
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await page.getByRole('textbox', { name: /Term/ }).fill('test');
    await page.getByRole('textbox', { name: /Definition/ }).fill('test def');
    await page.getByRole('button', { name: 'Add Term' }).click();

    // Only one toast should appear
    const toasts = page.getByText('Term added!');
    await expect(toasts).toHaveCount(1);
  });
});

test.describe('Data Persistence', () => {
  test('words persist across page reloads', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/dictionary');

    // Add a word
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await page.getByRole('textbox', { name: /Term/ }).fill('persistent');
    await page.getByRole('textbox', { name: /Definition/ }).fill('stays after reload');
    await page.getByRole('button', { name: 'Add Term' }).click();
    // Navigate back to list to see the word
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.getByText('persistent')).toBeVisible();

    // Reload the page
    await page.reload();

    // Word should still be there
    await expect(page.getByText('persistent')).toBeVisible();
    await expect(page.getByText('stays after reload')).toBeVisible();
  });
});
