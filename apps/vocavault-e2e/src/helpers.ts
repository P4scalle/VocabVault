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

/**
 * Stub BOTH dictionary hosts the app queries, with canned, instantly-resolving
 * responses. The real add path still runs end to end (fetch, parse, save, hide
 * the empty-state); only the external HTTP boundary is replaced, so starter-word
 * adds are deterministic.
 *
 * Why BOTH hosts: DictionaryApiService.lookupSingleMode() fires the primary
 * (api.dictionaryapi.dev) AND the fallback (freedictionaryapi.com) in parallel
 * and awaits `Promise.allSettled`. Stubbing only the primary leaves the fallback
 * to hit the live host and hang to its 10s timeout, so the word is not added
 * within a test's 5s assertion window and the starter panel never hides.
 */
export async function mockDictionary(page: Page): Promise<void> {
  // Primary: api.dictionaryapi.dev — array of DictionaryApiEntry.
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
  // Fallback: freedictionaryapi.com — the distinct FreeDict shape.
  await page.route('**/freedictionaryapi.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        word: 'serendipity',
        entries: [
          {
            partOfSpeech: 'noun',
            pronunciations: [{ text: '/ˌsɛrənˈdɪpɪti/' }],
            senses: [{ definition: 'A happy accident.', examples: [] }],
          },
        ],
      }),
    }),
  );
}
