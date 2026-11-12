import { Injectable, inject } from '@angular/core';
import { WordService } from './word.service';
import { DictionaryApiService } from './dictionary-api.service';

/** A short, curated set of words a brand-new user can add with one tap. */
export const STARTER_WORDS = [
  'Serendipity',
  'Ephemeral',
  'Petrichor',
  'Eloquent',
  'Resilience',
  'Whimsical',
] as const;

export interface StarterAddResult {
  /** false when storage is full and the word could not be saved */
  ok: boolean;
  /** true when no definition was fetched and the word was saved as incomplete */
  incomplete: boolean;
}

@Injectable({ providedIn: 'root' })
export class StarterWordsService {
  private readonly words = inject(WordService);
  private readonly dictionary = inject(DictionaryApiService);

  /**
   * Add a starter word, auto-filling its definition from the dictionary API.
   * If the lookup fails (offline, rate-limited, not found) the word is still
   * saved — just flagged incomplete so the user can fill it in later.
   */
  async add(term: string): Promise<StarterAddResult> {
    let data = { word: term, pronunciation: '', definition: '', examples: [] as string[] };

    try {
      const result = await this.dictionary.lookupWord(term);
      data = {
        word: term,
        pronunciation: result.pronunciation,
        definition: result.definition,
        examples: result.examples,
      };
    } catch {
      // Leave the fields empty — addWord() flags the word incomplete.
    }

    const { ok, word } = this.words.addWord(data);
    return { ok, incomplete: !!word.incomplete };
  }
}
