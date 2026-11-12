import { test, expect, Page, Locator } from '@playwright/test';

// ─── Viewport presets ───────────────────────────────────────────────
const MOBILE = { width: 375, height: 812 }; // iPhone 12
const SMALL_PHONE = { width: 320, height: 568 }; // iPhone SE
const TABLET = { width: 768, height: 1024 }; // iPad
const DESKTOP = { width: 1280, height: 900 };

// ─── Helpers ────────────────────────────────────────────────────────

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}

/** Return a locator's bounding box, throwing if the element has none. */
async function boxOf(locator: Locator, label = 'element') {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label} has no bounding box`);
  return box;
}

/**
 * Seed many words across 4+ letter groups so the alphabet scroller renders.
 * Seeds localStorage THEN reloads the page so Angular picks up the data.
 */
async function seedManyWords(page: Page) {
  const words = [
    ['aberration', 'A departure from what is normal'],
    ['alacrity', 'Brisk and cheerful readiness'],
    ['benevolent', 'Well meaning and kindly'],
    ['brevity', 'Concise and exact use of words'],
    ['candor', 'The quality of being open and honest'],
    ['capricious', 'Given to sudden changes of mood'],
    ['diligent', 'Having or showing care in work'],
    ['ephemeral', 'Lasting for a very short time'],
    ['fervent', 'Having or displaying passionate intensity'],
    ['gregarious', 'Fond of company; sociable'],
    ['harbinger', 'A person or thing that announces the approach of another'],
    ['innocuous', 'Not harmful or offensive'],
    ['jubilant', 'Feeling or expressing great happiness'],
    ['kinetic', 'Relating to or resulting from motion'],
    ['luminous', 'Giving off light; bright'],
    ['magnanimous', 'Generous or forgiving'],
    ['nefarious', 'Wicked or criminal'],
    ['obsequious', 'Obedient or attentive to an excessive degree'],
    ['pernicious', 'Having a harmful effect'],
    ['querulous', 'Complaining in a whiny manner'],
    ['resilient', 'Able to recover quickly from difficulties'],
    ['sanguine', 'Optimistic or positive'],
    ['tenacious', 'Holding firmly to something'],
    ['ubiquitous', 'Present everywhere'],
    ['vivacious', 'Attractively lively and animated'],
    ['whimsical', 'Playfully quaint or fanciful'],
  ];
  await page.evaluate((ws) => {
    const stored = ws.map(([w, d], i) => ({
      id: `test-${i}`,
      word: w,
      pronunciation: '',
      definition: d,
      examples: [],
      masteryLevel: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 0,
    }));
    localStorage.setItem('vv_words', JSON.stringify(stored));
  }, words);
}

/** Seed a small set of words (fewer than 3 letter groups, no alphabet scroller) */
async function seedFewWords(page: Page) {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const words = [
      { word: 'apple', definition: 'A fruit' },
      { word: 'avocado', definition: 'Another fruit' },
      { word: 'apricot', definition: 'Yet another fruit' },
    ];
    const stored = words.map((w, i) => ({
      id: `test-${i}`,
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

// ─── Bottom Nav Visibility on Dictionary ────────────────────────────

test.describe('Dictionary: Bottom Nav Visibility (Mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.setViewportSize(MOBILE);
  });

  test('bottom nav is visible on empty dictionary', async ({ page }) => {
    await page.goto('/dictionary');

    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();

    // Verify it's at the bottom of viewport
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThan(MOBILE.height - 20);
  });

  test('bottom nav is visible with word list (no scroller)', async ({ page }) => {
    await seedFewWords(page);
    await page.goto('/dictionary');

    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();

    // Nav should contain navigation links
    await expect(page.locator('lib-adaptive-nav').getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.locator('lib-adaptive-nav').getByRole('link', { name: 'Quiz' })).toBeVisible();
  });

  test('bottom nav is visible when alphabet scroller is shown', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    // Alphabet scroller should be present
    const scroller = page.locator('lib-alphabet-scroller');
    await expect(scroller).toBeVisible();

    // Bottom nav must still be visible
    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();

    // Check that nav is positioned at the bottom
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();
    expect((navBox?.y ?? 0) + (navBox?.height ?? 0)).toBeGreaterThan(MOBILE.height - 20);
  });

  test('bottom nav is visible after scrolling through word list', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    // Wait for the word list to render before scrolling it
    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();

    // Scroll the main content container (not window; shell uses overflow-y-auto on <main>)
    await page.evaluate(() => document.getElementById('main-content')?.scrollTo(0, 2000));

    // Nav is fixed-position, so it stays visible and pinned to the bottom after scroll
    await expect(nav).toBeVisible();
    const box = await nav.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThan(MOBILE.height - 20);
  });

  test('bottom nav is visible in select mode', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    // Enter select mode
    await page.getByRole('button', { name: 'Select words to manage' }).click();

    // Select toolbar should appear
    await expect(page.getByText('0 selected')).toBeVisible();

    // Bottom nav must still be visible underneath
    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();
  });

  test('bottom nav is NOT obscured by the alphabet scroller', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    const nav = page.locator('lib-adaptive-nav nav');
    const scroller = page.locator('lib-alphabet-scroller');

    await expect(nav).toBeVisible();
    await expect(scroller).toBeVisible();

    const navBox = await nav.boundingBox();
    const scrollerBox = await scroller.boundingBox();

    expect(navBox).not.toBeNull();
    expect(scrollerBox).not.toBeNull();

    // The scroller's bottom edge should be at or above the nav's top edge
    // (scroller bottom = scrollerBox.y + scrollerBox.height, nav top = navBox.y)
    expect(
      (scrollerBox?.y ?? 0) + (scrollerBox?.height ?? 0),
      'Alphabet scroller overlaps the bottom nav'
    ).toBeLessThanOrEqual((navBox?.y ?? 0) + 2); // 2px tolerance
  });

  test('bottom nav is hidden during add word flow (expected)', async ({ page }) => {
    await page.goto('/dictionary');

    // Start add flow
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();

    // Nav should be hidden in focus mode
    const nav = page.locator('lib-adaptive-nav');
    await expect(nav).toBeHidden();
  });

  test('bottom nav reappears after canceling add flow', async ({ page }) => {
    await page.goto('/dictionary');

    // Enter add flow
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();

    // Cancel
    await page.getByRole('button', { name: 'Go back' }).click();

    // Nav must be visible again
    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();
  });

  test('bottom nav reappears after saving a word and going back', async ({ page }) => {
    await page.goto('/dictionary');

    // Add a word
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await page.getByRole('textbox', { name: /Term/ }).fill('test');
    await page.getByRole('textbox', { name: /Definition/ }).fill('test def');
    await page.getByRole('button', { name: 'Add Term' }).click();
    // Navigate back to list
    await page.getByRole('button', { name: 'Go back' }).click();

    // Nav must be visible after returning to list view
    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();
  });

  test('bottom nav reappears after editing a word', async ({ page }) => {
    await seedFewWords(page);
    await page.goto('/dictionary');

    // Click a word to edit
    await page.getByText('apple').click();
    await expect(page.getByRole('heading', { name: /Edit Term/ })).toBeVisible();

    // Nav should be hidden during edit
    await expect(page.locator('lib-adaptive-nav')).toBeHidden();

    // Cancel edit
    await page.getByRole('button', { name: 'Go back' }).click();

    // Nav must be visible again
    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();
  });
});

// ─── Navigation FROM Dictionary ─────────────────────────────────────

test.describe('Dictionary: Navigate Away via Bottom Nav (Mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.setViewportSize(MOBILE);
  });

  test('can navigate from dictionary to home via bottom nav', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    // Use the bottom nav link specifically (not any "Home" link)
    const navHome = page.locator('lib-adaptive-nav').getByRole('link', { name: 'Home' });
    await expect(navHome).toBeVisible();
    await navHome.click();

    await expect(page).toHaveURL(/\/home/);
  });

  test('can navigate from dictionary to quiz via bottom nav', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    const navQuiz = page.locator('lib-adaptive-nav').getByRole('link', { name: 'Quiz' });
    await expect(navQuiz).toBeVisible();
    await navQuiz.click();

    await expect(page).toHaveURL(/\/quiz/);
  });

  test('can navigate from dictionary to progress via bottom nav', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    const navProgress = page.locator('lib-adaptive-nav').getByRole('link', { name: 'Progress' });
    await expect(navProgress).toBeVisible();
    await navProgress.click();

    await expect(page).toHaveURL(/\/progress/);
  });

  test('can navigate away even when alphabet scroller is active', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    // Verify scroller is shown
    await expect(page.locator('lib-alphabet-scroller')).toBeVisible();

    // Navigate to Home
    const navHome = page.locator('lib-adaptive-nav').getByRole('link', { name: 'Home' });
    await navHome.click();
    await expect(page).toHaveURL(/\/home/);
  });

  test('can navigate away from select mode', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    // Enter select mode
    await page.getByRole('button', { name: 'Select words to manage' }).click();
    await expect(page.getByText('0 selected')).toBeVisible();

    // Navigate to Quiz from bottom nav
    const navQuiz = page.locator('lib-adaptive-nav').getByRole('link', { name: 'Quiz' });
    await expect(navQuiz).toBeVisible();
    await navQuiz.click();

    await expect(page).toHaveURL(/\/quiz/);
  });

  test('nav links in bottom bar are not blocked by alphabet scroller pointer events', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    // Check that clicking the left-side nav links (Home, Dictionary) still works.
    // These are far from the alphabet scroller (which is on the right).
    const navHome = page.locator('lib-adaptive-nav').getByRole('link', { name: 'Home' });
    await expect(navHome).toBeVisible();
    const homeBox = await boxOf(navHome, 'Home nav link');

    // Verify the nav link is actually clickable (not intercepted)
    // Use page.mouse.click at the exact center of the Home link
    await page.mouse.click(
      homeBox.x + homeBox.width / 2,
      homeBox.y + homeBox.height / 2
    );

    await expect(page).toHaveURL(/\/home/);
  });
});

// ─── Bottom Nav Visibility on Dictionary (Small Phone) ──────────────

test.describe('Dictionary: Bottom Nav on Small Phone', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.setViewportSize(SMALL_PHONE);
  });

  test('bottom nav is visible with many words on small phone', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();
  });

  test('can navigate away on small phone with scroller', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    const navHome = page.locator('lib-adaptive-nav').getByRole('link', { name: 'Home' });
    await navHome.click();
    await expect(page).toHaveURL(/\/home/);
  });
});

// ─── Bottom Nav Visibility on Dictionary (Tablet) ───────────────────

test.describe('Dictionary: Side Rail Nav on Tablet', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.setViewportSize(TABLET);
  });

  test('side rail nav is visible with many words', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();
  });

  test('can navigate from dictionary to home via side rail', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    const navHome = page.locator('lib-adaptive-nav').getByRole('link', { name: 'Home' });
    await expect(navHome).toBeVisible();
    await navHome.click();
    await expect(page).toHaveURL(/\/home/);
  });

  test('side rail nav is visible during select mode', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    // Enter select mode
    await page.getByRole('button', { name: 'Select words to manage' }).click();

    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();
  });
});

// ─── Alphabet Scroller: Letter Navigation ────────────────────────────

/**
 * Helper: tap a scroller letter. The scroller nav re-enables pointer events
 * (pointer-events:auto) within the pointer-events:none host, so a normal click
 * hit-tests to the button, no force needed. The component navigates on
 * pointerdown (fired by click). Scroll settling is asserted by the caller via
 * expect.poll, so no fixed timeout is required.
 */
async function tapScrollerLetter(page: Page, letter: string) {
  const btn = page.locator('lib-alphabet-scroller button').getByText(letter, { exact: true });
  await btn.click();
}

/** Helper: get main-content scrollTop */
async function getMainScrollTop(page: Page): Promise<number> {
  return page.evaluate(() => document.getElementById('main-content')?.scrollTop ?? 0);
}

/** Helper: check if a data-letter section is in the visible area of main */
async function isLetterSectionVisible(page: Page, letter: string): Promise<boolean> {
  return page.evaluate((l) => {
    const el = document.querySelector(`[data-letter="${l}"]`);
    const main = document.getElementById('main-content');
    if (!el || !main) return false;
    const elRect = el.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    return elRect.top >= mainRect.top - 10 && elRect.top < mainRect.bottom;
  }, letter);
}

/** Helper: measure a letter header's top vs the main content's start (null if not found) */
async function getLetterPositions(
  page: Page,
  letter: string,
): Promise<{ elTop: number; contentStart: number } | null> {
  return page.evaluate((l) => {
    const el = document.querySelector(`[data-letter="${l}"]`);
    const main = document.getElementById('main-content');
    if (!el || !main) return null;
    const padding = parseFloat(getComputedStyle(main).paddingTop) || 0;
    return {
      elTop: el.getBoundingClientRect().top,
      contentStart: main.getBoundingClientRect().top + padding,
    };
  }, letter);
}

test.describe('Dictionary: Letter Scroll Navigation (Mobile)', () => {
  // Reduced motion makes the "scroll to top" (letter A) path instant too,
  // so scroll position settles synchronously and can be asserted deterministically.
  test.use({ reducedMotion: 'reduce' });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.setViewportSize(MOBILE);
  });

  test('clicking a letter scrolls to that section', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    await expect(page.locator('lib-alphabet-scroller')).toBeVisible();

    await tapScrollerLetter(page, 'M');

    await expect.poll(() => getMainScrollTop(page)).toBeGreaterThan(0);
    await expect.poll(() => isLetterSectionVisible(page, 'M')).toBe(true);
  });

  test('clicking A after scrolling down returns to top', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    await expect(page.locator('lib-alphabet-scroller')).toBeVisible();

    // Scroll to W first
    await tapScrollerLetter(page, 'W');
    await expect.poll(() => getMainScrollTop(page)).toBeGreaterThan(0);

    // Click A, should scroll back near top
    await tapScrollerLetter(page, 'A');
    await expect.poll(() => isLetterSectionVisible(page, 'A')).toBe(true);
  });

  test('letter header is not hidden behind mobile header after scroll', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    await expect(page.locator('lib-alphabet-scroller')).toBeVisible();

    await tapScrollerLetter(page, 'H');

    // Poll the position read until the scroll/layout fully settles. Even with
    // reducedMotion the browser can take a frame or two to settle layout under
    // parallel load, so a single point-in-time read races. expect.poll retries
    // the full measurement until the (unweakened) ≥ invariant holds.
    await expect
      .poll(async () => {
        const positions = await getLetterPositions(page, 'H');
        expect(positions).not.toBeNull();
        // Return the signed gap; invariant is gap >= -2 once layout settles.
        return (positions?.elTop ?? 0) - (positions?.contentStart ?? 0);
      })
      .toBeGreaterThanOrEqual(-2);
  });
});

test.describe('Dictionary: Letter Scroll Navigation (Desktop)', () => {
  test.use({ reducedMotion: 'reduce' });

  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.setViewportSize(DESKTOP);
  });

  test('clicking a letter scrolls to that section on desktop', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    await expect(page.locator('lib-alphabet-scroller')).toBeVisible();

    await tapScrollerLetter(page, 'T');

    await expect.poll(() => getMainScrollTop(page)).toBeGreaterThan(0);
    await expect.poll(() => isLetterSectionVisible(page, 'T')).toBe(true);
  });

  test('letter header is not hidden behind desktop navbar (lg:pt-20)', async ({ page }) => {
    await seedManyWords(page);
    await page.goto('/dictionary');

    await expect(page.locator('lib-alphabet-scroller')).toBeVisible();

    // This was the exact bug: desktop has 80px padding-top
    await tapScrollerLetter(page, 'A');

    // Poll until scroll/layout settles (same rationale as the mobile sibling).
    await expect
      .poll(async () => {
        const positions = await getLetterPositions(page, 'A');
        expect(positions).not.toBeNull();
        return (positions?.elTop ?? 0) - (positions?.contentStart ?? 0);
      })
      .toBeGreaterThanOrEqual(-2);
  });
});
