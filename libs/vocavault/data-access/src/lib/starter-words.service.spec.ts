// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { StarterWordsService, STARTER_WORDS } from './starter-words.service';
import { WordService } from './word.service';
import { DictionaryApiService } from './dictionary-api.service';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';

describe('StarterWordsService', () => {
  let service: StarterWordsService;
  let words: WordService;
  let lookup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    lookup = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        StarterWordsService,
        WordService,
        { provide: StorageService, useClass: LocalStorageService },
        { provide: DictionaryApiService, useValue: { lookupWord: lookup } },
      ],
    });
    service = TestBed.inject(StarterWordsService);
    words = TestBed.inject(WordService);
  });

  it('exposes a non-empty, de-duplicated starter list', () => {
    expect(STARTER_WORDS.length).toBeGreaterThan(0);
    expect(new Set(STARTER_WORDS).size).toBe(STARTER_WORDS.length);
  });

  it('adds a word with the fetched definition when lookup succeeds', async () => {
    lookup.mockResolvedValue({
      pronunciation: 'ser-uhn-DIP-i-tee',
      definition: 'A happy accident',
      examples: ['Finding it was pure serendipity'],
    });

    const result = await service.add('Serendipity');

    expect(lookup).toHaveBeenCalledWith('Serendipity');
    expect(result).toEqual({ ok: true, incomplete: false });
    const stored = words.words();
    expect(stored).toHaveLength(1);
    expect(stored[0].word).toBe('Serendipity');
    expect(stored[0].definition).toBe('A happy accident');
    expect(stored[0].incomplete).toBeFalsy();
  });

  it('still saves the word as incomplete when the lookup fails', async () => {
    lookup.mockRejectedValue(new Error('offline'));

    const result = await service.add('Petrichor');

    expect(result.ok).toBe(true);
    expect(result.incomplete).toBe(true);
    const stored = words.words();
    expect(stored).toHaveLength(1);
    expect(stored[0].word).toBe('Petrichor');
    expect(stored[0].definition).toBe('');
    expect(stored[0].incomplete).toBe(true);
  });

  it('reports ok=false when the word cannot be saved (storage full)', async () => {
    lookup.mockResolvedValue({ pronunciation: '', definition: 'x', examples: [] });
    vi.spyOn(words, 'addWord').mockReturnValue({
      word: { word: 'Whimsical', incomplete: undefined } as never,
      ok: false,
    });

    const result = await service.add('Whimsical');

    expect(result.ok).toBe(false);
  });
});
