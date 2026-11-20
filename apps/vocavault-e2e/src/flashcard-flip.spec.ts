import { test, expect, Page } from '@playwright/test';
import { openAddSheet } from './helpers';

/**
 * Regression guard for the flashcard 3D flip.
 *
 * Bug (commit bd68117): the two card faces were switched from absolute
 * positioning to a CSS grid stack (grid-area: 1/1) + overflow:hidden to let the
 * card auto-size. On iOS Safari that stops backface-visibility from culling the
 * rotated back face, so the back bled through the front, MIRRORED.
 *
 * No headless/CI engine reproduces that iOS-only compositing bug (Chromium,
 * Firefox and even desktop WebKit cull the back face correctly), so a pixel
 * screenshot is NOT a reliable guard. Instead we lock in the CSS CONTRACT that
 * makes the flip correct on every engine: absolutely-positioned faces, backface
 * culling enabled, the back face rotated, and a preserve-3d parent. Computed
 * style values are identical across engines, so these assertions are stable.
 *
 * If someone again moves the faces to grid/flow positioning or drops
 * backface-visibility, these tests fail immediately.
 */

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
    await openAddSheet(page);
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

async function launchFlashcard(page: Page, words: Array<[string, string]>) {
  await page.goto('/dictionary');
  for (let i = 0; i < words.length; i++) {
    await addWord(page, words[i][0], words[i][1], i === 0);
  }
  await page.goto('/quiz/create');
  await page.getByLabel('Name').fill('Flip Regression Quiz');
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).check();
  }
  await page.getByRole('button', { name: 'Create Quiz Set' }).click();
  await page.getByRole('button', { name: /^Flashcard/ }).click();
  await expect(page).toHaveURL(/\/play\?mode=flashcard/);
  await expect(page.locator('.flashcard')).toBeVisible();
}

test.describe('Flashcard flip: CSS contract that keeps iOS Safari backface culling correct', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('both faces are absolutely positioned with backface culling enabled', async ({ page }) => {
    await launchFlashcard(page, [['ephemeral', 'lasting for a very short time']]);

    const front = page.locator('.flashcard__front');
    const back = page.locator('.flashcard__back');
    const inner = page.locator('.flashcard__inner');

    // The invariant that broke on iOS: faces MUST be positioned layers.
    await expect(front).toHaveCSS('position', 'absolute');
    await expect(back).toHaveCSS('position', 'absolute');

    // Backface culling must be on for both faces.
    await expect(front).toHaveCSS('backface-visibility', 'hidden');
    await expect(back).toHaveCSS('backface-visibility', 'hidden');

    // The 3D context must be preserved and the back face rotated away.
    await expect(inner).toHaveCSS('transform-style', 'preserve-3d');
    await expect(back).toHaveCSS('transform', /matrix3d|matrix\(-1/);
  });

  test('card height does not jump when flipped (stable, footer never pushed off-screen)', async ({ page }) => {
    await launchFlashcard(page, [['ephemeral', 'lasting for a very short time']]);

    const card = page.locator('.flashcard');
    const beforeH = await card.evaluate((el) => el.getBoundingClientRect().height);

    await card.click(); // flip
    await expect(page.getByText('ephemeral')).toBeVisible();
    const afterH = await card.evaluate((el) => el.getBoundingClientRect().height);

    // Height is driven by a fixed clamp, not content, so it must not change on flip.
    expect(Math.abs(afterH - beforeH)).toBeLessThanOrEqual(1);
  });

  test('long content stays inside the card and scrolls instead of bleeding out', async ({ page }) => {
    const longDefinition =
      'A deliberately very long definition used to force overflow. ' +
      'It repeats several clauses so the natural content height exceeds the '.repeat(6) +
      'fixed height of the flashcard, which must cap the card and scroll internally.';
    // Default flashcard direction is definition-to-word, so the long definition
    // is the FRONT prompt, visible without flipping.
    await launchFlashcard(page, [['loquacious', longDefinition]]);

    const cardH = await page.locator('.flashcard').evaluate((el) => el.getBoundingClientRect().height);
    const viewportH = await page.evaluate(() => window.innerHeight);

    // The card must never exceed the viewport (keeps the sticky footer in view).
    expect(cardH).toBeLessThanOrEqual(viewportH);

    // The internal scroll region owns the overflow: with this much text it must
    // actually be scrollable, proving content is contained + scrolls, not bleeding.
    const scroll = page.locator('.flashcard__front .flashcard__scroll');
    const { scrollH, clientH, overflowY } = await scroll.evaluate((el) => ({
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(overflowY).toBe('auto');
    expect(scrollH).toBeGreaterThan(clientH);
  });
});
