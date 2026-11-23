import { test, expect, Locator, Page } from '@playwright/test';
import { mockDictionary } from './helpers';

// Assert an element is GENUINELY running a CSS animation (not just carrying the
// class, which would be a false positive if the keyframe is dead/clipped/disabled).
async function expectAnimating(locator: Locator, keyframe: string) {
  const anim = await locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { name: cs.animationName, duration: cs.animationDuration };
  });
  expect(anim.name, `expected animation "${keyframe}" but got "${anim.name}"`).toContain(keyframe);
  expect(anim.duration).not.toBe('0s');
}

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

// Drive the whole core loop to completion (add word, build quiz, play, finish)
// so every data-derived cue switches off. Reuses the selectors proven in the
// walk test above. The ':visible' scoping on the settings controls picks the one
// nav variant shown at the current viewport (mobile header / desktop / tablet).
async function completeFirstLoop(page: Page) {
  await page.goto('/dictionary');
  await page.getByTestId('starter-words').getByRole('button').first().click();
  await expect(page.getByTestId('starter-words')).toBeHidden();

  await page.goto('/quiz/create');
  await page.getByLabel('Name').fill('My First Quiz');
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).check();
  }
  await page.getByRole('button', { name: 'Create Quiz Set' }).click();
  await expect(page).toHaveURL(/\/quiz\//);

  await page.getByRole('button', { name: /^Flashcard/ }).click();
  await expect(page).toHaveURL(/\/play\?mode=flashcard/);
  await page.locator('.flashcard').click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Quiz Results')).toBeVisible();
}

// The getting-started tips are now a single "Guided tour" switch in Settings:
// one control that toggles the tour on or off (aria-checked reflects state).
function guidedTourSwitch(page: Page) {
  return page.locator('[role="switch"]:visible', { hasText: 'Guided tour' });
}
async function openSettingsMenu(page: Page) {
  await page.locator('button[aria-label="Settings menu"]:visible').click();
}
async function toggleGuidedTour(page: Page) {
  await openSettingsMenu(page);
  await guidedTourSwitch(page).click();
}

// Add a word through the add form (used mid-replay, when the starter-word chips
// are gone because the dictionary already has words). Mirrors dictionary.spec.
async function addWordViaForm(page: Page, term: string, definition: string) {
  // Open the add control, waiting for whichever the viewport exposes (mobile FAB
  // vs desktop pill) so we never race the post-navigation render.
  const fab = page.getByRole('button', { name: 'Open add options' });
  const pill = page.getByRole('button', { name: 'Add word or quiz' });
  await expect(fab.or(pill)).toBeVisible();
  await (await fab.isVisible() ? fab : pill).click();
  await page.getByRole('button', { name: 'Word Add a new word to your' }).click();
  await expect(page.getByRole('heading', { name: 'Add Term' })).toBeVisible();
  await page.getByRole('textbox', { name: /Term/ }).fill(term);
  await page.getByRole('textbox', { name: /Definition/ }).fill(definition);
  await page.getByRole('button', { name: 'Add Term' }).click();
  // The form stays in add mode and clears; a toast confirms the save.
  await expect(page.getByText('Term added!').first()).toBeVisible();
}

// Build a one-word (single-card) quiz and play it to the results screen.
async function buildAndCompleteSingleCardQuiz(page: Page, name: string) {
  await page.goto('/quiz/create');
  await page.getByLabel('Name').fill(name);
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: 'Create Quiz Set' }).click();
  await expect(page).toHaveURL(/\/quiz\//);
  await page.getByRole('button', { name: /^Flashcard/ }).click();
  await expect(page).toHaveURL(/\/play\?mode=flashcard/);
  await page.locator('.flashcard').click();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText('Quiz Results')).toBeVisible();
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

    await page.getByRole('button', { name: /^Flashcard/ }).click();
    await expect(page).toHaveURL(/\/play\?mode=flashcard/);

    // Single starter word => single card: flip, assess, finish.
    await page.locator('.flashcard').click(); // flip
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();

    // Stage 4 cue: the first-ever results page carries the teaching banner AND
    // guides the user onward to the Progress section. The "See your progress"
    // button pulses with a bouncing tooltip (completing the tour of all sections).
    await expect(page.getByText('Quiz Results')).toBeVisible();
    const resultsHint = page.getByTestId('results-hint');
    await expect(resultsHint).toBeVisible();
    await expect(resultsHint).toContainText('level your words up');

    // Assert the REAL animations on the See-your-progress cue, not just classes.
    const progressBtn = page.getByRole('button', { name: 'See your progress' });
    await expect(progressBtn).toBeVisible();
    await expectAnimating(progressBtn, 'vv-cue-pulse-ring');
    const progressTip = page.locator('.vv-cue-tooltip', { hasText: 'See how you did' });
    await expect(progressTip).toBeVisible();
    await expectAnimating(progressTip, 'vv-cue-tooltip-bounce');

    // Stage 5 (finale): following the cue to Progress triggers the completion
    // celebration — the congratulations dialog with confetti — which closes the
    // loop. It appears on Progress, not on the results page.
    await progressBtn.click();
    await expect(page).toHaveURL(/\/progress$/);
    await expect(page.getByText('Congratulations!')).toBeVisible();
    await expect(page.getByText("You're now expanding your vocabulary!")).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Congratulations!')).toBeHidden();
  });

  // Regression guard for the reported bug: once the loop is complete the
  // data-derived cues are all off, so the Guided tour switch must bring the
  // tour back on its own (previously it only fired a toast and showed nothing).
  test('replays the tour from Settings after the loop is complete', async ({ page }) => {
    await completeFirstLoop(page);

    // Loop done: a fresh home load shows no onboarding banner.
    await page.goto('/home');
    const welcome = page.getByText('Welcome to VocaVault!');
    await expect(welcome).toBeHidden();

    // Replaying from Settings brings the welcome recap back.
    await toggleGuidedTour(page);
    await expect(page).toHaveURL(/\/home$/);
    await expect(welcome).toBeVisible();

    // Full first-run path, not just the banner: the add-button cue restarts at
    // "Add your first word" even though the user already has words.
    await expect(
      page.locator('.vv-cue-tooltip', { hasText: 'Add your first word' }).first(),
    ).toBeVisible();

    // And it survives a hard reload, because the replay flag is persisted.
    await page.reload();
    await expect(page.getByText('Welcome to VocaVault!')).toBeVisible();
  });

  // Regression guard for the EXACT reported bug: a user who is only part-way
  // through the loop (has a quizzable word, so the live milestone is create-quiz)
  // used to be dropped at the create-quiz nudge instead of the welcome. Turning
  // tips on must restart at the welcome, and the menu item must toggle it off.
  test('replays the welcome mid-loop and toggles it back off from the menu', async ({ page }) => {
    await page.goto('/dictionary');
    await page.getByTestId('starter-words').getByRole('button').first().click();
    await expect(page.getByTestId('starter-words')).toBeHidden();

    // A word exists, so the live milestone is past add-word: Home does not show
    // the welcome on its own.
    await page.goto('/home');
    const welcome = page.getByText('Welcome to VocaVault!');
    await expect(welcome).toBeHidden();

    // Turning tips on restarts at the welcome even though the user is mid-loop.
    await toggleGuidedTour(page);
    await expect(page).toHaveURL(/\/home$/);
    await expect(welcome).toBeVisible();

    // The same switch toggles it off again: the banner hides.
    await toggleGuidedTour(page);
    await expect(welcome).toBeHidden();
  });

  // Full REPLAY scenario: a returning user turns the tour back on, re-walks the
  // whole loop, and the tour ends with the completion celebration on Progress —
  // after which the Guided tour switch reads OFF again. The tour must stay on for
  // the entire re-walk and end ONLY on completion.
  test('replays the entire tour to a second celebration, then the switch is off', async ({ page }) => {
    // A returning user who already finished the loop once.
    await completeFirstLoop(page);

    // Turn the tour back on from Settings — it restarts at the welcome.
    await page.goto('/home');
    await toggleGuidedTour(page);
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText('Welcome to VocaVault!')).toBeVisible();

    // Re-walk the loop during the replay: add a word, build a quiz, complete it.
    await page.goto('/dictionary');
    await addWordViaForm(page, 'replayword', 'a word added during the replay');
    await buildAndCompleteSingleCardQuiz(page, 'Replay Quiz');

    // The tour is STILL on at the finish line: the results cue pulses, which for
    // a returning user only happens while a replay is active. It ends only on
    // completion, not before.
    const progressBtn = page.getByRole('button', { name: 'See your progress' });
    await expect(progressBtn).toBeVisible();
    await expectAnimating(progressBtn, 'vv-cue-pulse-ring');

    // Following the cue to Progress fires the celebration again and ends the tour.
    await progressBtn.click();
    await expect(page).toHaveURL(/\/progress$/);
    await expect(page.getByText('Congratulations!')).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Congratulations!')).toBeHidden();

    // The Guided tour switch now reads OFF again in the menu (tour completed).
    await openSettingsMenu(page);
    await expect(guidedTourSwitch(page)).toHaveAttribute('aria-checked', 'false');
  });
});
