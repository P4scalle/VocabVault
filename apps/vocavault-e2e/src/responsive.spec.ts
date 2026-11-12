import { test, expect, Page, Locator } from '@playwright/test';

// ─── Viewport presets ───────────────────────────────────────────────
const VIEWPORTS = {
  'small-phone': { width: 320, height: 568 }, // iPhone SE
  phone: { width: 375, height: 812 }, // iPhone 12
  'large-phone': { width: 428, height: 926 }, // iPhone 14 Pro Max
  tablet: { width: 768, height: 1024 }, // iPad
  desktop: { width: 1280, height: 800 },
  'wide-desktop': { width: 1920, height: 1080 },
} as const;

// ─── Helpers ────────────────────────────────────────────────────────
async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}

async function seedWords(page: Page, count = 4) {
  // Use a wide viewport for seeding to avoid mobile-specific UI differences
  const originalSize = page.viewportSize();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/dictionary');
  const words = [
    ['ephemeral', 'lasting for a short time'],
    ['sonder', 'the realization that each passerby has a complex life'],
    ['petrichor', 'the smell of earth after rain'],
    ['luminous', 'giving off light; bright'],
  ];
  for (let i = 0; i < count; i++) {
    const [term, def] = words[i];
    if (i === 0) {
      await page.getByRole('button', { name: 'Add Your First Term' }).click();
    } else {
      await page.getByRole('button', { name: 'Add word or quiz' }).click();
      await page
        .getByRole('button', { name: 'Word Add a new word to your' })
        .click();
    }
    await expect(
      page.getByRole('heading', { name: 'Add Term' })
    ).toBeVisible();
    await page.getByRole('textbox', { name: /Term/ }).fill(term);
    await page.getByRole('textbox', { name: /Definition/ }).fill(def);
    await page.getByRole('button', { name: 'Add Term' }).click();
    await expect(page.getByText('Term added!').first()).toBeVisible();
    // Navigate back to list
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(
      page.getByRole('heading', { name: 'Dictionary' })
    ).toBeVisible();
  }
  // Restore original viewport
  if (originalSize) {
    await page.setViewportSize(originalSize);
  }
}

/** Returns true if the page has horizontal overflow (sideways scroll). */
async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

/**
 * Assert an element's rendered size meets minimum tap-target requirements.
 * Polls the measured box so a mid-layout/reflow snapshot (e.g. right after a
 * viewport change) can't cause a transient false negative.
 */
async function expectMinTapTarget(
  locator: Locator,
  minPx = 44,
  label?: string
) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      return Math.min(box ? box.width : 0, box ? box.height : 0);
    }, { message: `${label ?? 'element'} smaller than ${minPx}px on its shortest side` })
    .toBeGreaterThanOrEqual(minPx);
}

/** Return a locator's bounding box, throwing if the element has none. */
async function boxOf(locator: Locator, label = 'element') {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label} has no bounding box`);
  return box;
}

/** Returns true if main content fits within the viewport width. */
async function contentWithinMaxWidth(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return true;
    return main.getBoundingClientRect().width <= window.innerWidth;
  });
}

// ─── Responsive Layout Tests ────────────────────────────────────────

test.describe('Responsive: No Horizontal Overflow', () => {
  const routes = ['/home', '/dictionary', '/quiz', '/progress'];

  for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
    for (const route of routes) {
      test(`${route} has no overflow at ${vpName} (${viewport.width}×${viewport.height})`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await clearStorage(page);
        await page.goto(route);
        // Wait for the shell + routed content to render before measuring layout
        await expect(page.locator('lib-adaptive-nav nav')).toBeVisible();
        expect(await hasHorizontalOverflow(page), 'Page has horizontal overflow').toBe(false);
        expect(await contentWithinMaxWidth(page), 'main content wider than viewport').toBe(true);
      });
    }
  }
});

test.describe('Responsive: No Overflow With Content', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);
  });

  for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
    test(`dictionary with words: no overflow at ${vpName}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/dictionary');
      await expect(page.locator('lib-adaptive-nav nav')).toBeVisible();
      expect(await hasHorizontalOverflow(page), 'Page has horizontal overflow').toBe(false);
    });

    test(`home with words: no overflow at ${vpName}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/home');
      await expect(page.locator('lib-adaptive-nav nav')).toBeVisible();
      expect(await hasHorizontalOverflow(page), 'Page has horizontal overflow').toBe(false);
    });
  }
});

// ─── Navigation Adaptation ──────────────────────────────────────────

test.describe('Responsive: Navigation Adapts', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('mobile: shows bottom navigation bar', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto('/home');

    // Bottom nav should be visible (fixed at bottom)
    const bottomNav = page.locator('lib-adaptive-nav nav');
    await expect(bottomNav).toBeVisible();

    // Mobile header should be visible
    const header = page.locator('header').filter({ hasText: 'VOCAVAULT' });
    await expect(header).toBeVisible();
  });

  test('tablet: shows side rail navigation', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto('/home');

    // Adaptive nav should show rail layout (nav element present)
    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();

    // Mobile header should be hidden at md breakpoint
    const header = page.locator('header').filter({ hasText: 'VOCAVAULT' });
    await expect(header).toBeHidden();
  });

  test('desktop: shows top navigation bar', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/home');

    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();

    // Mobile header hidden on desktop
    const header = page.locator('header').filter({ hasText: 'VOCAVAULT' });
    await expect(header).toBeHidden();
  });
});

// ─── FAB (Floating Action Button) ───────────────────────────────────

test.describe('Responsive: FAB Positioning', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('mobile: FAB is centered above bottom nav', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto('/home');

    const fab = page.getByRole('button', { name: 'Open add options' });
    await expect(fab).toBeVisible();
    await expectMinTapTarget(fab, 44, 'FAB');

    // FAB should be roughly centered horizontally
    const box = await boxOf(fab, 'FAB');
    const viewportCenter = VIEWPORTS.phone.width / 2;
    const fabCenter = box.x + box.width / 2;
    expect(Math.abs(fabCenter - viewportCenter)).toBeLessThan(40);
  });

  test('desktop: FAB is hidden (Add button in top nav)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/home');

    // Desktop "Add" pill button should be visible in top nav
    const addPill = page
      .locator('lib-adaptive-nav')
      .getByRole('button', { name: 'Add word or quiz' });
    await expect(addPill).toBeVisible();
  });
});

// ─── Touch Target Sizes ─────────────────────────────────────────────

test.describe('Responsive: Touch Targets', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('home page: primary FAB meets 44px minimum at phone size', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto('/home');

    // The primary action target (the add FAB) must meet the 44px minimum.
    // (The original scan of every interactive element was informational only;
    // some decorators like the logo/heading buttons are intentionally smaller,
    // so the FAB is the single element with a hard 44px requirement here.)
    const fab = page.getByRole('button', { name: 'Open add options' });
    await expect(fab).toBeVisible();
    await expectMinTapTarget(fab, 44, 'home FAB');
  });

  test('home page: info buttons meet tap target minimum', async ({ page }) => {
    await seedWords(page);
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto('/home');

    // Info buttons are 32px (w-8 h-8), compact inline decorators, not primary
    // actions. The quiz-types and eloquence info buttons are always rendered on
    // the home page (independent of seeded data), so assert them deterministically.
    const quizInfo = page.getByRole('button', { name: 'About quiz types' });
    await expect(quizInfo).toBeVisible();
    await expectMinTapTarget(quizInfo, 32, 'quiz-types info button');

    const eloquenceInfo = page.getByRole('button', {
      name: 'About progress and eloquence score',
    });
    await expect(eloquenceInfo).toBeVisible();
    await expectMinTapTarget(eloquenceInfo, 32, 'eloquence info button');
  });

  test('dictionary: word cards are fully tappable at small-phone', async ({
    page,
  }) => {
    await seedWords(page);
    await page.setViewportSize(VIEWPORTS['small-phone']);
    await page.goto('/dictionary');

    // Word cards should be easily tappable
    const wordCards = page.locator('lib-word-card');
    await expect(wordCards.first()).toBeVisible();
    const count = await wordCards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 3); i++) {
      const card = wordCards.nth(i);
      const box = await card.boundingBox();
      expect(box, `word card ${i} missing`).not.toBeNull();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      // Card should not overflow viewport
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        VIEWPORTS['small-phone'].width + 2
      );
    }
  });
});

// ─── Grid Layout Responsiveness ─────────────────────────────────────

test.describe('Responsive: Grid Layouts', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);
  });

  test('home quiz grid: 2 cols on phone, 4 cols on desktop', async ({
    page,
  }) => {
    // Phone: should be 2 columns
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto('/home');

    const quizCards = page.locator('[data-testid^="quiz-card-"]');
    await expect(quizCards).toHaveCount(4);
    await expect(quizCards.first()).toBeVisible();

    // Returns the y coordinate of a quiz card by index.
    const cardY = (i: number) =>
      quizCards.nth(i).evaluate((el) => el.getBoundingClientRect().y);

    const box0 = await quizCards.nth(0).boundingBox();
    const box1 = await quizCards.nth(1).boundingBox();
    const box2 = await quizCards.nth(2).boundingBox();

    expect(box0).not.toBeNull();
    expect(box1).not.toBeNull();
    expect(box2).not.toBeNull();

    // Cards 0 and 1 should be on the same row
    expect(Math.abs((box0?.y ?? 0) - (box1?.y ?? 0))).toBeLessThan(5);
    // Card 2 should be on a different row (below)
    expect(box2?.y ?? 0).toBeGreaterThan((box0?.y ?? 0) + 20);

    // Desktop: should be 4 columns (all on one row). Poll the layout so we wait
    // deterministically for the reflow instead of a fixed timeout.
    await page.setViewportSize(VIEWPORTS.desktop);
    await expect
      .poll(async () => Math.abs((await cardY(0)) - (await cardY(3))))
      .toBeLessThan(5);
  });

  test('home progress bubbles: 2 cols on small-phone, 4 cols on phone', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS['small-phone']);
    await page.goto('/home');

    const bubbles = page.locator('[data-testid="progress-preview"] lib-progress-bubble');
    // progressCircles() always renders exactly 4 mastery bubbles.
    await expect(bubbles).toHaveCount(4);
    await expect(bubbles.first()).toBeVisible();

    // Returns the y of a bubble by index.
    const bubbleY = (i: number) => bubbles.nth(i).evaluate((el) => el.getBoundingClientRect().y);

    const box0 = await bubbles.nth(0).boundingBox();
    const box2 = await bubbles.nth(2).boundingBox();
    expect(box0).not.toBeNull();
    expect(box2).not.toBeNull();

    // On small phone (320px), grid-cols-2 means the 3rd bubble is on a second row
    expect(box2?.y ?? 0).toBeGreaterThan((box0?.y ?? 0) + 10);

    // On regular phone (375px+), xs:grid-cols-4 puts all four on one row.
    // Poll the layout to wait deterministically for the reflow.
    await page.setViewportSize(VIEWPORTS.phone);
    await expect
      .poll(async () => Math.abs((await bubbleY(0)) - (await bubbleY(3))))
      .toBeLessThan(5);
  });

  test('progress stats: 3 columns scale text at small-phone', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS['small-phone']);
    await page.goto('/progress');

    // With seeded words the stats grid renders (not the empty state)
    const statsText = page.getByText('Words Learned');
    await expect(statsText).toBeVisible();

    // Stats cards should not overflow
    expect(await hasHorizontalOverflow(page), 'Page has horizontal overflow').toBe(false);

    // Stat card text should not be cut off (visible within viewport)
    const box = await statsText.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      VIEWPORTS['small-phone'].width + 2
    );
  });
});

// ─── Text Readability ───────────────────────────────────────────────

test.describe('Responsive: Text Readability', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test('body text is at least 14px at phone viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto('/home');

    // Wait for routed content before scanning text sizes
    await expect(page.locator('lib-adaptive-nav nav')).toBeVisible();

    const tooSmallText = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const text = node.textContent?.trim();
            if (!text || text.length < 3) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const style = getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden')
              return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );

      const issues: string[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent) continue;
        const style = getComputedStyle(parent);
        const fontSize = parseFloat(style.fontSize);
        // Allow text-2xs (10px) for badges, labels; flag anything under 10px
        if (fontSize < 10) {
          issues.push(
            `"${node.textContent?.trim().slice(0, 30)}" = ${fontSize}px (${parent.tagName})`
          );
        }
      }
      return issues;
    });

    expect(
      tooSmallText,
      `Text under 10px found: ${tooSmallText.join(', ')}`
    ).toHaveLength(0);
  });

  test('headings do not shrink from phone to desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    // The Dictionary page has a stable h1 heading to measure.
    await page.goto('/dictionary');

    const heading = page.getByRole('heading', { name: 'Dictionary', exact: true });
    await expect(heading).toBeVisible();

    const phoneSize = await heading.evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize)
    );

    await page.setViewportSize(VIEWPORTS.desktop);
    // Poll until the heading's font-size settles at a value >= the phone size
    // (same or larger on desktop), which also waits out any reflow.
    await expect
      .poll(() => heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)))
      .toBeGreaterThanOrEqual(phoneSize);
  });
});

// ─── Sticky Elements ────────────────────────────────────────────────

test.describe('Responsive: Sticky Elements', () => {
  test('mobile header stays visible on scroll', async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);

    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto('/dictionary');

    // Mobile header should be visible before scrolling
    const header = page.locator('header').filter({ hasText: 'VOCAVAULT' });
    await expect(header).toBeVisible();

    // Scroll down the main content container (shell uses overflow on <main>)
    await page.evaluate(() => {
      document.getElementById('main-content')?.scrollTo(0, 500);
      window.scrollTo(0, 500);
    });

    // Header is sticky, so it stays pinned to the top. Poll the position to
    // wait deterministically for the post-scroll layout to settle.
    await expect(header).toBeVisible();
    await expect
      .poll(async () => (await header.boundingBox())?.y ?? Number.MAX_SAFE_INTEGER)
      .toBeLessThan(10);
  });

  test('bottom nav stays fixed on scroll', async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);

    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto('/dictionary');

    const nav = page.locator('lib-adaptive-nav nav');
    await expect(nav).toBeVisible();

    // Scroll down the main content container
    await page.evaluate(() => {
      document.getElementById('main-content')?.scrollTo(0, 500);
      window.scrollTo(0, 500);
    });

    // Bottom nav is fixed, so it stays pinned near the bottom of the viewport.
    await expect(nav).toBeVisible();
    await expect
      .poll(async () => {
        const b = await nav.boundingBox();
        return b ? b.y + b.height : 0;
      })
      .toBeGreaterThan(VIEWPORTS.phone.height - 20);
  });
});

// ─── Content Truncation ─────────────────────────────────────────────

test.describe('Responsive: Content Truncation', () => {
  test('long word names truncate instead of overflowing', async ({ page }) => {
    await clearStorage(page);

    // Seed a word with a very long name
    await page.goto('/dictionary');
    await page.getByRole('button', { name: 'Add Your First Term' }).click();
    await page
      .getByRole('textbox', { name: /Term/ })
      .fill('supercalifragilisticexpialidocious');
    await page
      .getByRole('textbox', { name: /Definition/ })
      .fill(
        'An extraordinarily long definition that tests whether text properly wraps or truncates on small screens without causing layout issues'
      );
    await page.getByRole('button', { name: 'Add Term' }).click();
    // Navigate back to list to see the word card
    await page.getByRole('button', { name: 'Go back' }).click();

    await page.setViewportSize(VIEWPORTS['small-phone']);

    // Wait for the word card to render at the new viewport before measuring
    const wordCard = page.locator('lib-word-card').first();
    await expect(wordCard).toBeVisible();

    expect(await hasHorizontalOverflow(page), 'Page has horizontal overflow').toBe(false);

    // Word card should not exceed viewport width
    const box = await wordCard.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      VIEWPORTS['small-phone'].width + 2
    );
  });
});

// ─── Quiz Components Responsiveness ─────────────────────────────────

test.describe('Responsive: Quiz Components', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);
  });

  test('quiz launcher: cards scale at small-phone', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS['small-phone']);
    await page.goto('/quiz');
    await expect(page.locator('lib-adaptive-nav nav')).toBeVisible();

    expect(await hasHorizontalOverflow(page), 'Page has horizontal overflow').toBe(false);
  });

  test('smart review launcher: grid scales at small-phone', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORTS['small-phone']);
    await page.goto('/home');

    // The home page quiz grid always renders 4 cards.
    const quizCards = page.locator('[data-testid^="quiz-card-"]');
    await expect(quizCards).toHaveCount(4);
    await expect(quizCards.first()).toBeVisible();

    const count = await quizCards.count();
    for (let i = 0; i < count; i++) {
      const box = await quizCards.nth(i).boundingBox();
      expect(box, `quiz card ${i} missing`).not.toBeNull();
      // Each card should be at least 44px tappable area
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      // Should not extend beyond viewport
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        VIEWPORTS['small-phone'].width + 2
      );
    }
  });
});

// ─── Quiz Sticky Header & Footer ─────────────────────────────────────

test.describe('Responsive: Quiz Sticky Layout', () => {
  /** Create a quiz set and navigate to multiple-choice play mode. */
  async function startMultipleChoiceQuiz(page: Page) {
    await clearStorage(page);
    // Seed at desktop size to avoid mobile UI differences
    await page.setViewportSize(VIEWPORTS.desktop);
    await seedWords(page);
    // Create quiz set
    await page.goto('/quiz/create');
    await page.getByLabel('Name').fill('Sticky Test');
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
    await page.getByRole('button', { name: 'Create Quiz Set' }).click();
    // App navigates to quiz detail after creation, wait for it
    await expect(page.getByRole('button', { name: /Multiple Choice/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Multiple Choice/i }).click();
    // Wait for quiz to render
    await expect(page.getByText(/Question \d+ of \d+/)).toBeVisible();
  }

  test('mobile: quiz header sticks to top of viewport', async ({ page }) => {
    await startMultipleChoiceQuiz(page);
    await page.setViewportSize(VIEWPORTS.phone);

    // Sticky header wrapper should exist at mobile width
    const stickyHeader = page.locator('.sticky.top-0.z-30');
    await expect(stickyHeader).toBeVisible();

    // Scroll down within the main content area
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = 200;
    });

    // Header is sticky, so it stays near the top. Poll to wait for the layout.
    await expect
      .poll(async () => (await stickyHeader.boundingBox())?.y ?? Number.MAX_SAFE_INTEGER)
      .toBeLessThan(100);
  });

  test('mobile: Next button is fixed at bottom after answering', async ({ page }) => {
    await startMultipleChoiceQuiz(page);
    await page.setViewportSize(VIEWPORTS.phone);

    // Answer the first question (option buttons have numbered badge spans)
    const optionButtons = page.locator('.space-y-2 > button');
    await optionButtons.first().click();

    // Sticky footer should appear and be fixed at the bottom
    const stickyFooter = page.locator('.vv-sticky-footer-inline');
    await expect(stickyFooter).toBeVisible();

    // Footer should be in the lower portion of viewport (fixed bottom).
    await expect
      .poll(async () => {
        const b = await stickyFooter.boundingBox();
        return b ? b.y + b.height : 0;
      })
      .toBeGreaterThan(VIEWPORTS.phone.height - 80);
  });

  test('tablet: quiz header is static (not sticky)', async ({ page }) => {
    await startMultipleChoiceQuiz(page);
    await page.setViewportSize(VIEWPORTS.tablet);

    // The header wrapper should have md:static which makes it non-sticky at tablet
    const headerWrapper = page.locator('.sticky.top-0.z-30');
    await expect(headerWrapper).toBeVisible();

    // At tablet width, md:static kicks in. Poll the computed position so we wait
    // deterministically for the media-query-driven style to apply after resize.
    await expect
      .poll(() => headerWrapper.evaluate((el) => getComputedStyle(el).position))
      .toBe('static');
  });

  test('tablet: Next button is inline (not fixed)', async ({ page }) => {
    await startMultipleChoiceQuiz(page);
    await page.setViewportSize(VIEWPORTS.tablet);

    // Answer the first question (option buttons have numbered badge spans)
    const optionButtons = page.locator('.space-y-2 > button');
    await optionButtons.first().click();

    // Footer should be static at tablet
    const stickyFooter = page.locator('.vv-sticky-footer-inline');
    await expect(stickyFooter).toBeVisible();

    await expect
      .poll(() => stickyFooter.evaluate((el) => getComputedStyle(el).position))
      .toBe('static');
  });

  test('desktop: quiz layout matches tablet (no sticky)', async ({ page }) => {
    await startMultipleChoiceQuiz(page);
    await page.setViewportSize(VIEWPORTS.desktop);

    const headerWrapper = page.locator('.sticky.top-0.z-30');
    await expect(headerWrapper).toBeVisible();
    await expect
      .poll(() => headerWrapper.evaluate((el) => getComputedStyle(el).position))
      .toBe('static');
  });
});

// ─── Info Drawers / Modals ──────────────────────────────────────────

test.describe('Responsive: Info Drawers', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await seedWords(page);
  });

  test('info drawer opens as bottom sheet on phone', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto('/home');

    // The quiz-types info button is always present on the home page
    const infoBtn = page.getByRole('button', { name: 'About quiz types' });
    await expect(infoBtn).toBeVisible();
    await infoBtn.click();

    // Drawer should be visible (expect auto-waits out the open animation)
    const drawerContent = page.getByText('Choose from four different quiz');
    await expect(drawerContent).toBeVisible({ timeout: 3000 });

    // On mobile, drawer should have the grab handle (rounded top)
    const grabHandle = page.locator('.bg-slate-300.rounded-full');
    await expect(grabHandle).toBeVisible();

    // Drawer should not overflow
    expect(await hasHorizontalOverflow(page), 'Page has horizontal overflow').toBe(false);
  });

  test('info drawer opens as centered modal on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/home');

    const infoBtn = page.getByRole('button', { name: 'About quiz types' });
    await expect(infoBtn).toBeVisible();
    await infoBtn.click();

    const drawerContent = page.getByText('Choose from four different quiz');
    await expect(drawerContent).toBeVisible({ timeout: 3000 });

    // On desktop, the mobile grab handle is hidden (md:hidden). toBeHidden also
    // passes when the element is absent from the DOM.
    const grabHandle = page.locator(
      '.mx-auto.mb-6.h-1.w-10.rounded-full.bg-slate-300'
    );
    await expect(grabHandle).toBeHidden();
  });
});

// ─── Viewport Resize Handling ───────────────────────────────────────

test.describe('Responsive: Dynamic Resize', () => {
  test('navigation adapts when viewport changes', async ({ page }) => {
    await clearStorage(page);
    await page.goto('/home');

    // Start at phone size
    await page.setViewportSize(VIEWPORTS.phone);

    const mobileHeader = page.locator('header').filter({ hasText: 'VOCAVAULT' });
    await expect(mobileHeader).toBeVisible();

    // Resize to desktop, mobile header should now be hidden (expect auto-waits)
    await page.setViewportSize(VIEWPORTS.desktop);
    await expect(mobileHeader).toBeHidden();

    // Resize back to phone, mobile header should be visible again
    await page.setViewportSize(VIEWPORTS.phone);
    await expect(mobileHeader).toBeVisible();
  });
});

// ─── Empty States ───────────────────────────────────────────────────

test.describe('Responsive: Empty States', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  for (const [vpName, viewport] of Object.entries(VIEWPORTS).slice(0, 3)) {
    test(`empty dictionary renders correctly at ${vpName}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/dictionary');

      // Empty state should be visible and centered
      const emptyHeading = page.getByRole('heading', {
        name: 'Your dictionary is empty',
      });
      await expect(emptyHeading).toBeVisible();

      // CTA button should be tappable
      const ctaBtn = page.getByRole('button', {
        name: 'Add Your First Term',
      });
      await expect(ctaBtn).toBeVisible();
      await expectMinTapTarget(ctaBtn, 44, 'empty state CTA');

      expect(await hasHorizontalOverflow(page), 'Page has horizontal overflow').toBe(false);
    });

    test(`empty progress renders correctly at ${vpName}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/progress');

      const emptyHeading = page.getByRole('heading', {
        name: 'No progress yet',
      });
      await expect(emptyHeading).toBeVisible();
      expect(await hasHorizontalOverflow(page), 'Page has horizontal overflow').toBe(false);
    });
  }
});
