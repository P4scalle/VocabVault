import { test, expect, Page } from '@playwright/test';

// Walks the guided first-quiz onboarding journey for a brand-new user and
// asserts the Stage 3/4 cues that are DERIVED from data state:
//   create-quiz milestone -> teaching banner on /quiz/create
//   start-quiz milestone   -> "Start here" badge on the quiz card, mode-hint on
//                             /quiz/:id, and results-hint on the first results.
//
// The quiz-creation and flashcard-play steps reuse the exact selectors proven
// in user-journey.spec.ts ("add words, create quiz, play flashcard, see
// results"), so this test only adds the onboarding-cue assertions on top of a
// known-good flow.

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

test.describe('Guided first-quiz onboarding cues', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await mockDictionary(page);
  });

  test('walks the guided journey and shows the Stage 3/4 cues', async ({ page }) => {
    // Stage 1: brand-new user adds a starter word so a quizzable word exists.
    await page.goto('/dictionary');
    await page.getByTestId('starter-words').getByRole('button').first().click();
    // Once a word exists, the empty-state block (and its starter chips) is gone.
    await expect(page.getByTestId('starter-words')).toBeHidden();

    // Stage 2 cue: during the create-quiz milestone, /quiz/create teaches what
    // a quiz is via a banner.
    await page.goto('/quiz/create');
    const banner = page.getByTestId('create-quiz-teaching');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('editable set of words');

    // Create a quiz through the UI (selectors reused from user-journey.spec.ts).
    await page.getByLabel('Name').fill('My First Quiz');
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
    await page.getByRole('button', { name: 'Create Quiz Set' }).click();

    // The app navigates to the quiz detail page.
    await expect(page).toHaveURL(/\/quiz\//);
    await expect(page.getByText('Quiz created!')).toBeVisible();
    await expect(page.getByText('My First Quiz')).toBeVisible();

    // Stage 3 cue (quiz detail): "Choose a mode" carries the mode-hint during
    // the start-quiz milestone (no quiz has been completed yet).
    const modeHint = page.getByTestId('mode-hint');
    await expect(modeHint).toBeVisible();
    await expect(modeHint).toContainText('Each mode drills the same words a different way');

    // Stage 3 cue (quiz list): the quiz card shows the "Start here" badge while
    // no quiz has been completed. Visit /quiz and assert on the card.
    await page.goto('/quiz');
    const card = page.locator('lib-quiz-set-card').filter({ hasText: 'My First Quiz' });
    await expect(card).toBeVisible();
    await expect(card.getByText('Start here')).toBeVisible();

    // Re-enter the quiz detail and play the flashcard quiz to completion
    // (flow + selectors reused from user-journey.spec.ts).
    await card.click();
    await expect(page).toHaveURL(/\/quiz\//);

    await page.getByRole('button', { name: /Flashcard/ }).click();
    await expect(page).toHaveURL(/\/play\?mode=flashcard/);

    // Single starter word => single card: flip, assess, finish.
    await page.locator('.flashcard').click(); // flip
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();

    // Stage 4 cue: the first-ever results page carries the results-hint.
    await expect(page.getByText('Quiz Results')).toBeVisible();
    const resultsHint = page.getByTestId('results-hint');
    await expect(resultsHint).toBeVisible();
    await expect(resultsHint).toContainText('level your words up');
  });
});
