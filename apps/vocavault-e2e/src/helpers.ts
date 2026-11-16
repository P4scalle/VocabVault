import { Page } from '@playwright/test';

/**
 * Open the add sheet via whichever "+" trigger the current viewport exposes:
 * the mobile FAB ("Open add options") or the desktop pill ("Add word or quiz").
 * Only one is in the accessibility tree per viewport, so branch on visibility.
 */
export async function openAddSheet(page: Page): Promise<void> {
  const mobileFab = page.getByRole('button', { name: 'Open add options' });
  if (await mobileFab.isVisible()) {
    await mobileFab.click();
  } else {
    await page.getByRole('button', { name: 'Add word or quiz' }).click();
  }
}
