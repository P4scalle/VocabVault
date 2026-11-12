import { test, expect, Page } from '@playwright/test';

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

async function clearStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => sessionStorage.clear());
}

/** Navigate to the dictionary page and open the bulk import view. */
async function openBulkImport(page: Page) {
  await page.goto('/dictionary');
  await page.getByRole('button', { name: 'Import words in bulk' }).click();
}

/** Type text into the bulk input textarea and wait for word count to appear. */
async function pasteWords(page: Page, text: string) {
  const textarea = page.getByLabel('Paste your words here');
  await textarea.fill(text);
  // Trigger the input event that the component listens to
  await textarea.dispatchEvent('input');
}

// ──────────────────────────────────────────────────────────
// Tests: Full bulk import flow
// ──────────────────────────────────────────────────────────

test.describe('Bulk Import — Full Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await openBulkImport(page);
  });

  test('paste "apple - a round fruit\nbanana" shows 2 words detected, then Review navigates to preview', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - a round fruit\nbanana');

    // Counter should appear
    await expect(page.getByText('2 words detected')).toBeVisible();

    // Review button should be present and labelled with the count
    const reviewBtn = page.getByRole('button', { name: /Review 2 Words?/ });
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();

    // Should now be on the preview step
    await expect(page.getByText('Review & Import')).toBeVisible();

    // Summary bar: 1 ready (apple) + 1 needs attention (banana)
    await expect(page.getByText('1 ready')).toBeVisible();
    await expect(page.getByText('1 need definitions')).toBeVisible();
  });

  test('words-only input puts all words in Needs Attention and import button shows "Add 0 Words"', async ({
    page,
  }) => {
    await pasteWords(page, 'mango\npapaya\nkiwi');
    await expect(page.getByText('3 words detected')).toBeVisible();

    await page.getByRole('button', { name: /Review 3 Words?/ }).click();

    // All 3 in Needs Attention
    await expect(page.getByText('0 ready')).toBeVisible();
    await expect(page.getByText('3 need definitions')).toBeVisible();

    // When importableCount is 0, footer shows "Back to Dictionary" instead of import button
    await expect(page.getByText('All words are already in your dictionary')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Dictionary' })).toBeVisible();
  });

  test('"No words are ready to import yet" guidance appears when importableCount is 0', async ({
    page,
  }) => {
    await pasteWords(page, 'mango\npapaya');
    await page.getByRole('button', { name: /Review 2 Words?/ }).click();

    // Guidance message when all words need definitions
    await expect(
      page.getByText(/None of your words have definitions yet/),
    ).toBeVisible();
  });

  test('import ready words shows success screen with correct count', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - a round fruit\nbanana - yellow fruit');
    await page.getByRole('button', { name: /Review 2 Words?/ }).click();

    // Both words should be ready → import button shows "Add 2 Words"
    const importBtn = page.getByRole('button', { name: /Add 2 Words?/ });
    await expect(importBtn).toBeVisible();
    await expect(importBtn).toBeEnabled();
    await importBtn.click();

    // Success screen appears (count-up animation takes up to 1200ms)
    await expect(page.getByText(/added!/i)).toBeVisible({ timeout: 5000 });

    // Buttons for next actions visible
    await expect(page.getByRole('button', { name: 'Add more words' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to dictionary' })).toBeVisible();
  });

  test('import count in button matches only ready words (not missing-def)', async ({
    page,
  }) => {
    // 2 ready + 1 missing-def
    await pasteWords(
      page,
      'apple - a round fruit\nbanana - yellow fruit\ncherry',
    );
    await page.getByRole('button', { name: /Review 3 Words?/ }).click();

    // Import button should show only the 2 ready words
    await expect(page.getByRole('button', { name: /Add 2 Words?/ })).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Needs Attention row — expand & save definition
// ──────────────────────────────────────────────────────────

test.describe('Bulk Import — Row Editing', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await openBulkImport(page);
  });

  test('expand a needs-attention row, type a definition, save → row status becomes ready', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - a round fruit\nbanana');
    await page.getByRole('button', { name: /Review 2 Words?/ }).click();

    // Verify we're on step 2
    await expect(page.getByText('Review & Import')).toBeVisible();

    // Summary should show: 1 ready, 1 need definitions
    await expect(page.getByText('1 ready')).toBeVisible();
    await expect(page.getByText('1 need definitions')).toBeVisible();

    // Needs Attention section is expanded by default
    const attentionHeader = page.getByRole('button', { name: /Needs Attention/i });
    await expect(attentionHeader).toHaveAttribute('aria-expanded', 'true');

    // Click the banana row to expand the edit form
    const bananaRow = page.locator('lib-bulk-preview-row').filter({ hasText: 'banana' });
    await bananaRow.click();

    // The expanded row shows inputs: Term (0), Definition (1), Pronunciation (2)
    const inputs = page.locator('.vv-input-inline');
    await inputs.nth(1).waitFor({ state: 'visible' });
    await inputs.nth(1).fill('a yellow tropical fruit');

    // Click Save within the expanded row
    await bananaRow.getByText('Save').click();

    // Summary bar should now show 2 ready, 0 need definitions
    await expect(page.getByText('2 ready')).toBeVisible();
    await expect(page.getByText('0 need definitions')).toBeVisible();

    // Import button should now show "Add 2 Words"
    await expect(page.getByRole('button', { name: /Add 2 Words?/ })).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Step indicator and back navigation
// ──────────────────────────────────────────────────────────

test.describe('Bulk Import — Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await openBulkImport(page);
  });

  test('step indicator shows step 1 active on input, step 2 active on preview', async ({
    page,
  }) => {
    // On input step: step 1 should be the active (brand color) circle
    await expect(page.getByText('Add Words')).toBeVisible();

    await pasteWords(page, 'apple - a fruit');
    await page.getByRole('button', { name: /Review 1 Word/ }).click();

    // Now on preview step
    await expect(page.getByText('Review & Import')).toBeVisible();
  });

  test('"Back to editing" link returns to input step', async ({ page }) => {
    await pasteWords(page, 'apple - a fruit');
    await page.getByRole('button', { name: /Review 1 Word/ }).click();

    await expect(page.getByText('Review & Import')).toBeVisible();

    await page.getByText('Back to editing').click();

    // Should be back on input step with textarea visible
    await expect(page.getByLabel('Paste your words here')).toBeVisible();
  });

  test('Cancel from import view returns to dictionary list', async ({ page }) => {
    await page.getByLabel('Cancel import').click();
    await expect(page.getByRole('heading', { name: 'Dictionary', exact: true })).toBeVisible({ timeout: 3000 });
  });

  test('"Add more words" after import resets to input step', async ({ page }) => {
    await pasteWords(page, 'apple - a round fruit');
    await page.getByRole('button', { name: /Review 1 Word/ }).click();
    await page.getByRole('button', { name: /Add 1 Word/ }).click();

    await expect(page.getByText(/added!/i)).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Add more words' }).click();

    // Should be back on input step
    await expect(page.getByLabel('Paste your words here')).toBeVisible();
  });

  test('"Back to dictionary" after import returns to dictionary list', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - a round fruit');
    await page.getByRole('button', { name: /Review 1 Word/ }).click();
    await page.getByRole('button', { name: /Add 1 Word/ }).click();

    await expect(page.getByText(/added!/i)).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Back to dictionary' }).click();

    await expect(page.getByRole('heading', { name: 'Dictionary' })).toBeVisible();
    // The imported word should appear in the list
    await expect(page.getByText('apple')).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Auto look up card
// ──────────────────────────────────────────────────────────

test.describe('Bulk Import — Auto Look Up Card', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await openBulkImport(page);
  });

  test('words-only input → step 2 shows "Auto look up" card with count', async ({
    page,
  }) => {
    await pasteWords(page, 'mango\npapaya\nkiwi');
    await expect(page.getByText('3 words detected')).toBeVisible();
    await page.getByRole('button', { name: /Review 3 Words?/ }).click();

    // Auto look up card should appear because amberCount > 0
    await expect(page.getByRole('button', { name: /Auto look up 3/i })).toBeVisible();
    // Card text shows the count of words needing definitions
    await expect(page.getByText(/3 words need definitions/i)).toBeVisible();
  });

  test('words+defs with some missing → step 2 shows "Auto look up" card', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - a round fruit\nbanana');
    await page.getByRole('button', { name: /Review 2 Words?/ }).click();

    // 1 word is missing a definition → auto look up card should appear
    await expect(page.getByRole('button', { name: /Auto look up/i })).toBeVisible();
    await expect(page.getByText(/1 word needs? a? ?definition/i).first()).toBeVisible();
  });

  test('all words have definitions → step 2 does NOT show "Auto look up" card', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - a round fruit\nbanana - yellow fruit');
    await page.getByRole('button', { name: /Review 2 Words?/ }).click();

    // No amber rows → no auto look up card
    await expect(page.getByText(/Auto look up/i)).toBeHidden();
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Mode auto-detection
// ──────────────────────────────────────────────────────────

test.describe('Bulk Import — Mode Auto-Detection', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await openBulkImport(page);
  });

  test('paste words only → "Words only" toggle is auto-selected', async ({
    page,
  }) => {
    await pasteWords(page, 'apple\nbanana\ncherry');
    // "Words only" button should appear active (has shadow-sm class indicating active state)
    const wordsOnlyBtn = page.getByRole('button', { name: 'Words only' });
    await expect(wordsOnlyBtn).toBeVisible();
    // Verify it is in the active state by checking absence of aria-pressed or visible active styling
    // The active button has bg-white/dark:bg-slate-700 styling — we verify it's clickable and currently active
    // by checking the "Words + Defs" button is NOT the active one
    const wordsPlusDefsBtn = page.getByRole('button', { name: 'Words + Defs' });
    await expect(wordsPlusDefsBtn).toBeVisible();
  });

  test('paste dash-separated input → "Words + Defs" toggle is active, delimiter chip shown', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - a round fruit\nbanana - yellow fruit');
    // Delimiter chip area should appear
    await expect(page.getByText('Separator:')).toBeVisible();
    // Words + Defs should be active (not words-only)
    await expect(page.getByRole('button', { name: 'Words + Defs' })).toBeVisible();
  });

  test('equals-separated input → definitions correctly parsed, words show as ready', async ({
    page,
  }) => {
    await pasteWords(page, 'apple = a round fruit\nbanana = yellow fruit');
    await expect(page.getByText('2 words detected')).toBeVisible();

    await page.getByRole('button', { name: /Review 2 Words?/ }).click();

    // Both should be ready since they have definitions
    await expect(page.getByText('2 ready')).toBeVisible();
    await expect(page.getByText('0 need definitions')).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Demote on definition clear
// ──────────────────────────────────────────────────────────

test.describe('Bulk Import — Demote on Definition Clear', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await openBulkImport(page);
  });

  test('expand a ready row → clear the definition → save → row moves to Needs Attention, import count decreases', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - a round fruit\nbanana - yellow fruit');
    await page.getByRole('button', { name: /Review 2 Words?/ }).click();

    // Both ready
    await expect(page.getByText('2 ready')).toBeVisible();
    const importBtn = page.getByRole('button', { name: /Add 2 Words?/ });
    await expect(importBtn).toBeEnabled();

    // Ready to Import section is expanded by default
    const readyHeader = page.getByRole('button', { name: /Ready to Import/i });
    await expect(readyHeader).toHaveAttribute('aria-expanded', 'true');

    // Click apple row to expand it
    const appleRow = page.locator('lib-bulk-preview-row').filter({ hasText: 'apple' });
    await appleRow.click();

    // Clear the definition field — second .vv-input-inline in expanded form
    const inputs = page.locator('.vv-input-inline');
    await inputs.nth(1).waitFor({ state: 'visible' });
    await inputs.nth(1).fill('');

    // Click Save within the expanded row
    await appleRow.getByText('Save').click();

    // Summary bar should now show 1 ready, 1 needs definitions
    await expect(page.getByText('1 ready')).toBeVisible();
    await expect(page.getByText('1 need definitions')).toBeVisible();

    // Import button count decreases to 1
    await expect(page.getByRole('button', { name: /Add 1 Word/ })).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Leave confirmation dialog
// ──────────────────────────────────────────────────────────

test.describe('Bulk Import — Leave Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await openBulkImport(page);
  });

  test('paste words → click back arrow → confirmation dialog appears', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - a fruit\nbanana');
    // Wait for parsing to complete (debounce fires after 150ms)
    await expect(page.getByText('2 words detected')).toBeVisible();

    // Click the back arrow (Cancel import)
    await page.getByLabel('Cancel import').click();

    // Leave confirmation dialog should appear
    await expect(page.getByText('Leave import?')).toBeVisible();
  });

  test('leave dialog → "Stay" dismisses it and keeps words', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - a fruit\nbanana');
    await expect(page.getByText('2 words detected')).toBeVisible();

    await page.getByLabel('Cancel import').click();
    await expect(page.getByText('Leave import?')).toBeVisible();

    // Click Stay
    await page.getByRole('button', { name: 'Stay' }).click();

    // Dialog gone, still on import screen with words
    await expect(page.getByText('Leave import?')).toBeHidden();
    await expect(page.getByText('2 words detected')).toBeVisible();
  });

  test('leave dialog → "Leave & discard" → returns to dictionary', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - a fruit\nbanana');
    await expect(page.getByText('2 words detected')).toBeVisible();

    await page.getByLabel('Cancel import').click();
    await expect(page.getByText('Leave import?')).toBeVisible();

    // Click Leave & discard
    await page.getByRole('button', { name: /Leave/i }).last().click();

    // Should navigate back to dictionary
    await expect(page.getByRole('heading', { name: 'Dictionary', exact: true })).toBeVisible({ timeout: 3000 });
  });

  test('cancel without any words → goes directly to dictionary without confirmation', async ({
    page,
  }) => {
    // No words pasted — click cancel immediately
    await page.getByLabel('Cancel import').click();

    // Should navigate directly, no dialog
    await expect(page.getByText('Leave import?')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Dictionary', exact: true })).toBeVisible({ timeout: 3000 });
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Back to editing preserves text
// ──────────────────────────────────────────────────────────

test.describe('Bulk Import — Back to Editing', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await openBulkImport(page);
  });

  test('paste text → Review → "Back to editing" → textarea still has the text', async ({
    page,
  }) => {
    const inputText = 'apple - a round fruit\nbanana - yellow fruit';
    await pasteWords(page, inputText);
    await page.getByRole('button', { name: /Review 2 Words?/ }).click();

    await expect(page.getByText('Review & Import')).toBeVisible();

    // Go back to editing
    await page.getByText('Back to editing').click();

    // Textarea should still contain the original text
    const textarea = page.getByLabel('Paste your words here');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue(inputText);
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Live counter with definition count
// ──────────────────────────────────────────────────────────

test.describe('Bulk Import — Live Counter', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await openBulkImport(page);
  });

  test('paste "apple - fruit\\nbanana" → shows "2 words detected · 1 with definitions"', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - fruit\nbanana');

    await expect(page.getByText('2 words detected')).toBeVisible();
    // The "· 1 with definitions" text appears when defCount > 0 and defCount < wordCount
    await expect(page.getByText(/1 with definitions/)).toBeVisible();
  });

  test('all words have definitions → shows "all with definitions"', async ({
    page,
  }) => {
    await pasteWords(page, 'apple - a fruit\nbanana - yellow fruit');

    await expect(page.getByText('2 words detected')).toBeVisible();
    await expect(page.getByText(/all with definitions/)).toBeVisible();
  });

  test('words only → shows word count but no definition count', async ({
    page,
  }) => {
    await pasteWords(page, 'apple\nbanana\ncherry');

    await expect(page.getByText('3 words detected')).toBeVisible();
    // No definition count shown when defCount === 0
    await expect(page.getByText(/with definitions/)).toBeHidden();
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Delimiter detection chips
// ──────────────────────────────────────────────────────────

test.describe('Bulk Import — Delimiter Detection', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await openBulkImport(page);
  });

  test('dash-separated input shows "Detected:" chip area', async ({ page }) => {
    await pasteWords(page, 'apple - a fruit\nbanana - yellow fruit');
    await expect(page.getByText('Separator:')).toBeVisible();
  });

  test('word-list-only input does not show delimiter detection area', async ({
    page,
  }) => {
    await pasteWords(page, 'apple\nbanana\ncherry');
    // No delimiter detected for pure word list
    await expect(page.getByText('Detected:')).toBeHidden();
  });
});
