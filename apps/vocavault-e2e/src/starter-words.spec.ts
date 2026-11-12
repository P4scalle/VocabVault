import { test, expect, Locator, Page } from '@playwright/test';

// Runs across every configured project (desktop Chromium/Firefox/WebKit +
// Mobile Chrome/Safari), so this covers the add hint and starter words on
// all device form factors.

// Assert an element is GENUINELY running a CSS animation, not merely carrying the
// class. A class-presence check is a false positive if the keyframe is dead,
// clipped, or disabled; this reads the real computed style in the browser.
export async function expectAnimating(locator: Locator, keyframe: string) {
  const anim = await locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { name: cs.animationName, duration: cs.animationDuration };
  });
  expect(anim.name, `expected animation "${keyframe}" but got "${anim.name}"`).toContain(keyframe);
  expect(anim.duration).not.toBe('0s');
}

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

// Canned dictionary response so the test never depends on the live API.
async function mockDictionary(page: Page) {
  await page.route('**/api.dictionaryapi.dev/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          word: 'serendipity',
          phonetics: [{ text: '/ˌsɛrənˈdɪpɪti/' }],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: 'A happy accident.' }] },
          ],
        },
      ]),
    }),
  );
}

test.describe('Starter words & first-run add hint', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockDictionary(page);
  });

  test('empty dictionary offers starter words and adds one on tap', async ({ page }) => {
    await page.goto('/dictionary');

    const starter = page.getByTestId('starter-words');
    await expect(starter).toBeVisible();
    await expect(starter.getByRole('button').first()).toBeEnabled();

    await starter.getByRole('button').first().click();

    // Once a word exists, the empty-state block (and its starter chips) is gone
    await expect(page.getByTestId('starter-words')).toBeHidden();
    // Scope to the word card so we don't also match the "Added ..." toast
    await expect(page.locator('lib-word-card').filter({ hasText: 'Serendipity' })).toBeVisible();
  });

  test('add button pulses for the first word, then guides toward the first quiz', async ({ page }) => {
    // The add-button hint lives off-home (home has its own welcome banner), so
    // assert it on /dictionary.
    await page.goto('/dictionary');
    // Wait for the shell to render before asserting on the hint (avoids a load-time race).
    await expect(page.locator('lib-adaptive-nav nav')).toBeVisible();
    // Empty dictionary: at least one add control (mobile FAB or desktop pill)
    // pulses and points at adding the first word. Assert it is ACTUALLY animating,
    // not just that the class is present.
    const pulse = page.locator('.vv-cue-pulse').first();
    await expect(pulse).toBeVisible();
    await expectAnimating(pulse, 'vv-cue-pulse-ring');
    const tooltip = page.locator('.vv-cue-tooltip').first();
    await expect(tooltip).toContainText('Add your first word');
    await expectAnimating(tooltip, 'vv-cue-tooltip-bounce');

    await page.getByTestId('starter-words').getByRole('button').first().click();
    await expect(page.getByTestId('starter-words')).toBeHidden();
    // Confirm the word actually landed before asserting the next state.
    await expect(page.locator('lib-word-card').first()).toBeVisible();

    // Still on /dictionary: a quizzable word now exists but no quiz, so the hint
    // persists and steers to building the first quiz — and keeps animating.
    await expect(page.locator('.vv-cue-pulse').first()).toBeVisible();
    await expectAnimating(page.locator('.vv-cue-pulse').first(), 'vv-cue-pulse-ring');
    await expect(page.locator('.vv-cue-tooltip').first()).toContainText('build your first quiz');

    // Home shows the onboarding banner instead, so the FAB hint is suppressed there.
    await page.goto('/home');
    await expect(page.locator('lib-adaptive-nav nav')).toBeVisible();
    await expect(page.locator('.vv-cue-pulse')).toHaveCount(0);
  });
});
