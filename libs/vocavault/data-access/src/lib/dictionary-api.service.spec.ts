import { TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { DictionaryApiService, DictionaryLookupResult, RateLimitError } from './dictionary-api.service';

describe('DictionaryApiService', () => {
  let service: DictionaryApiService;
  let httpController: HttpTestingController;

  const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
  const FALLBACK_API_BASE = 'https://api.freedictionaryapi.com/api/v1/entries/en/';

  const mockApiResponse = [
    {
      word: 'ephemeral',
      phonetics: [
        { text: '' },
        { text: '/\u026A\u02C8f\u025Bm.\u0259r.\u0259l/' },
        { text: '/\u026A\u02C8fi\u02D0.m\u0259r.\u0259l/' },
      ],
      meanings: [
        {
          partOfSpeech: 'adjective',
          definitions: [
            {
              definition: 'Lasting for a very short time.',
              example: 'The ephemeral joys of childhood.',
            },
            {
              definition: 'Having a short lifespan.',
              example: 'Ephemeral streams only flow after rain.',
            },
          ],
        },
        {
          partOfSpeech: 'noun',
          definitions: [
            {
              definition: 'An ephemeral plant.',
              example: 'Many desert plants are ephemerals.',
            },
          ],
        },
      ],
    },
  ];

  const simpleResponse = (word = 'hello', def = 'A greeting.', pos = 'noun') => [
    {
      word,
      phonetics: [],
      meanings: [
        {
          partOfSpeech: pos,
          definitions: [{ definition: def }],
        },
      ],
    },
  ];

  const tick = () => new Promise(resolve => setTimeout(resolve, 0));

  /** Flush both primary and fallback with the same response for single-mode tests */
  const flushBoth = (word: string, response: unknown) => {
    httpController.expectOne(API_BASE + word).flush(response);
    httpController.expectOne(FALLBACK_API_BASE + word).flush(response);
  };

  /** Flush both with different responses/statuses */
  const flushPrimaryAndFallback = (
    word: string,
    primaryResponse: unknown,
    fallbackResponse: unknown,
    primaryStatus?: { status: number; statusText: string },
    fallbackStatus?: { status: number; statusText: string },
  ) => {
    const primaryReq = httpController.expectOne(API_BASE + word);
    if (primaryStatus) {
      primaryReq.flush(primaryResponse, primaryStatus);
    } else {
      primaryReq.flush(primaryResponse);
    }

    const fallbackReq = httpController.expectOne(FALLBACK_API_BASE + word);
    if (fallbackStatus) {
      fallbackReq.flush(fallbackResponse, fallbackStatus);
    } else {
      fallbackReq.flush(fallbackResponse);
    }
  };

  /** Error both requests with network errors */
  const errorBoth = (word: string) => {
    httpController.expectOne(API_BASE + word)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    httpController.expectOne(FALLBACK_API_BASE + word)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DictionaryApiService,
      ],
    });
    service = TestBed.inject(DictionaryApiService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
  });

  // ── Validation ──────────────────────────────────────────────

  describe('validation', () => {
    it('should reject with message when word is empty', async () => {
      await expect(service.lookupWord('')).rejects.toThrow(
        'Please enter a word to look up',
      );
    });

    it('should reject with message when word is whitespace only', async () => {
      await expect(service.lookupWord('   ')).rejects.toThrow(
        'Please enter a word to look up',
      );
    });

    it('should trim and lowercase the word before making the request', async () => {
      const promise = service.lookupWord('  Hello  ');
      flushBoth('hello', simpleResponse('hello', 'A greeting.'));
      const result = await promise;
      expect(result.definition).toBe('n. A greeting.');
    });

    it('should URL-encode special characters in the word', async () => {
      void service.lookupWord("it's");
      httpController.expectOne(API_BASE + "it's");
      httpController.expectOne(FALLBACK_API_BASE + "it's");
      // Just verifying the requests were made with correct encoding — cancel them
      httpController.match(() => true).forEach(req => req.flush(simpleResponse("it's", 'Contraction.')));
    });
  });

  // ── RateLimitError ──────────────────────────────────────────

  describe('RateLimitError', () => {
    it('should be an instance of Error', () => {
      const err = new RateLimitError('test');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(RateLimitError);
    });

    it('should have name "RateLimitError"', () => {
      const err = new RateLimitError('hello');
      expect(err.name).toBe('RateLimitError');
    });

    it('should include the word in the message', () => {
      const err = new RateLimitError('ephemeral');
      expect(err.message).toContain('ephemeral');
    });
  });

  // ── Single mode (default) ──────────────────────────────────

  describe('single mode (default)', () => {

    // --- Happy path ---

    it('should call both APIs in parallel and merge results', async () => {
      const promise = service.lookupWord('ephemeral');

      const primaryReq = httpController.expectOne(API_BASE + 'ephemeral');
      const fallbackReq = httpController.expectOne(FALLBACK_API_BASE + 'ephemeral');

      primaryReq.flush(mockApiResponse);
      fallbackReq.flush(mockApiResponse);

      const result: DictionaryLookupResult = await promise;
      expect(result.pronunciation).toBe('/\u026A\u02C8f\u025Bm.\u0259r.\u0259l/');
      expect(result.definition).toBe(
        'adj. Lasting for a very short time. · n. An ephemeral plant.',
      );
      expect(result.examples).toEqual([
        'The ephemeral joys of childhood.',
        'Ephemeral streams only flow after rain.',
        'Many desert plants are ephemerals.',
      ]);
    });

    it('should collect multiple definitions with part-of-speech abbreviations', async () => {
      const response = [
        {
          word: 'run',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'verb',
              definitions: [
                { definition: 'Move quickly.', example: 'I run every day.' },
              ],
            },
            {
              partOfSpeech: 'noun',
              definitions: [
                { definition: 'A jog.', example: 'He went for a run.' },
              ],
            },
          ],
        },
      ];

      const promise = service.lookupWord('run');
      flushBoth('run', response);
      const result = await promise;
      expect(result.definition).toBe('v. Move quickly. · n. A jog.');
    });

    it('should use first non-empty phonetic text as pronunciation', async () => {
      const response = [
        {
          word: 'test',
          phonetics: [{ text: '' }, { text: '' }, { text: '/t\u025Bst/' }],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: 'A test.' }] },
          ],
        },
      ];

      const promise = service.lookupWord('test');
      flushBoth('test', response);
      const result = await promise;
      expect(result.pronunciation).toBe('/t\u025Bst/');
    });

    it('should fallback to empty string when no phonetics have text', async () => {
      const response = [
        {
          word: 'test',
          phonetics: [{ audio: 'url' }, {}],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: 'A test.' }] },
          ],
        },
      ];

      const promise = service.lookupWord('test');
      flushBoth('test', response);
      const result = await promise;
      expect(result.pronunciation).toBe('');
    });

    it('should collect up to 5 examples across all meanings', async () => {
      const response = [
        {
          word: 'run',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'verb',
              definitions: [
                { definition: 'Move quickly.', example: 'I run every day.' },
                { definition: 'Operate.', example: 'She runs a business.' },
                { definition: 'Flow.', example: 'Water runs downhill.' },
              ],
            },
            {
              partOfSpeech: 'noun',
              definitions: [
                { definition: 'A jog.', example: 'He went for a run.' },
                { definition: 'A streak.', example: 'A run of bad luck.' },
                { definition: 'A series.', example: 'A run of six wins.' },
              ],
            },
          ],
        },
      ];

      const promise = service.lookupWord('run');
      flushBoth('run', response);
      const result = await promise;
      expect(result.examples).toHaveLength(5);
    });

    it('should return empty examples array when API provides none', async () => {
      const response = [
        {
          word: 'hi',
          phonetics: [],
          meanings: [
            { partOfSpeech: 'interjection', definitions: [{ definition: 'A greeting.' }] },
          ],
        },
      ];

      const promise = service.lookupWord('hi');
      flushBoth('hi', response);
      const result = await promise;
      expect(result.examples).toEqual([]);
    });

    it('should return empty definition when meanings have no definitions array', async () => {
      const response = [
        {
          word: 'hmm',
          phonetics: [],
          meanings: [
            { partOfSpeech: 'interjection', definitions: [] },
          ],
        },
      ];

      const promise = service.lookupWord('hmm');
      flushBoth('hmm', response);
      const result = await promise;
      expect(result.definition).toBe('');
    });

    it('should skip meanings with empty definition text', async () => {
      const response = [
        {
          word: 'test',
          phonetics: [],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: '' }] },
            { partOfSpeech: 'verb', definitions: [{ definition: 'To evaluate.' }] },
          ],
        },
      ];

      const promise = service.lookupWord('test');
      flushBoth('test', response);
      const result = await promise;
      expect(result.definition).toBe('v. To evaluate.');
    });

    // --- One API fails, other succeeds ---

    it('should succeed when primary 404s but fallback returns data', async () => {
      const promise = service.lookupWord('rare');

      flushPrimaryAndFallback(
        'rare',
        null,
        simpleResponse('rare', 'Not common.'),
        { status: 404, statusText: 'Not Found' },
      );

      const result = await promise;
      expect(result.definition).toBe('n. Not common.');
    });

    it('should succeed when fallback 404s but primary returns data', async () => {
      const promise = service.lookupWord('hello');

      flushPrimaryAndFallback(
        'hello',
        simpleResponse('hello', 'A greeting.'),
        null,
        undefined,
        { status: 404, statusText: 'Not Found' },
      );

      const result = await promise;
      expect(result.definition).toBe('n. A greeting.');
    });

    it('should succeed from fallback when primary returns 429', async () => {
      const promise = service.lookupWord('hello');

      flushPrimaryAndFallback(
        'hello',
        null,
        simpleResponse(),
        { status: 429, statusText: 'Too Many Requests' },
      );

      const result = await promise;
      expect(result.definition).toBe('n. A greeting.');
    });

    it('should succeed from primary when fallback returns 429', async () => {
      const promise = service.lookupWord('hello');

      flushPrimaryAndFallback(
        'hello',
        simpleResponse('hello', 'A greeting.'),
        null,
        undefined,
        { status: 429, statusText: 'Too Many Requests' },
      );

      const result = await promise;
      expect(result.definition).toBe('n. A greeting.');
    });

    it('should succeed from fallback when primary has network error', async () => {
      const promise = service.lookupWord('hello');

      httpController.expectOne(API_BASE + 'hello')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      httpController.expectOne(FALLBACK_API_BASE + 'hello')
        .flush(simpleResponse());

      const result = await promise;
      expect(result.definition).toBe('n. A greeting.');
    });

    it('should succeed from primary when fallback has network error', async () => {
      const promise = service.lookupWord('hello');

      httpController.expectOne(API_BASE + 'hello')
        .flush(simpleResponse());
      httpController.expectOne(FALLBACK_API_BASE + 'hello')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      const result = await promise;
      expect(result.definition).toBe('n. A greeting.');
    });

    // --- Both APIs fail ---

    it('should throw "Word not found" when both APIs return 404', async () => {
      const promise = service.lookupWord('xyznotaword');

      flushPrimaryAndFallback(
        'xyznotaword',
        null,
        null,
        { status: 404, statusText: 'Not Found' },
        { status: 404, statusText: 'Not Found' },
      );

      await expect(promise).rejects.toThrow('Word not found. Try a different spelling.');
    });

    it('should throw RateLimitError when both APIs return 429', async () => {
      const promise = service.lookupWord('hello');

      flushPrimaryAndFallback(
        'hello',
        null,
        null,
        { status: 429, statusText: 'Too Many Requests' },
        { status: 429, statusText: 'Too Many Requests' },
      );

      await expect(promise).rejects.toBeInstanceOf(RateLimitError);
    });

    it('should throw connection error when both APIs have network errors', async () => {
      const promise = service.lookupWord('hello');
      errorBoth('hello');

      await expect(promise).rejects.toThrow(
        'Could not connect to dictionary. Check your internet connection.',
      );
    });

    it('should prefer "Word not found" over RateLimitError when primary 404s and fallback 429s', async () => {
      const promise = service.lookupWord('xyznotaword');

      flushPrimaryAndFallback(
        'xyznotaword',
        null,
        null,
        { status: 404, statusText: 'Not Found' },
        { status: 429, statusText: 'Too Many Requests' },
      );

      // Primary error (not found) is more useful than fallback rate limit
      await expect(promise).rejects.toThrow('Word not found. Try a different spelling.');
    });

    it('should prefer "Word not found" when primary 429s and fallback 404s', async () => {
      const promise = service.lookupWord('xyznotaword');

      flushPrimaryAndFallback(
        'xyznotaword',
        null,
        null,
        { status: 429, statusText: 'Too Many Requests' },
        { status: 404, statusText: 'Not Found' },
      );

      await expect(promise).rejects.toThrow('Word not found. Try a different spelling.');
    });

    it('should throw connection error when primary network-errors and fallback 429s', async () => {
      const promise = service.lookupWord('hello');

      httpController.expectOne(API_BASE + 'hello')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      httpController.expectOne(FALLBACK_API_BASE + 'hello')
        .flush(null, { status: 429, statusText: 'Too Many Requests' });

      // Connection error is more useful to the user than rate limit
      await expect(promise).rejects.toThrow(
        'Could not connect to dictionary. Check your internet connection.',
      );
    });

    // --- Merge logic ---

    it('should merge different data from both APIs', async () => {
      const primaryResponse = [
        {
          word: 'cool',
          phonetics: [{ text: '/ku\u02D0l/' }],
          meanings: [
            {
              partOfSpeech: 'adjective',
              definitions: [{ definition: 'Low temperature.', example: 'A cool breeze.' }],
            },
          ],
        },
      ];
      const fallbackResponse = [
        {
          word: 'cool',
          phonetics: [{ text: '/ku\u02D0l/' }],
          meanings: [
            {
              partOfSpeech: 'adjective',
              definitions: [{ definition: 'Low temperature.' }],
            },
            {
              partOfSpeech: 'noun',
              definitions: [{ definition: 'Composure.', example: 'Keep your cool.' }],
            },
          ],
        },
      ];

      const promise = service.lookupWord('cool');
      flushPrimaryAndFallback('cool', primaryResponse, fallbackResponse);

      const result = await promise;
      expect(result.pronunciation).toBe('/ku\u02D0l/');
      expect(result.definition).toContain('adj. Low temperature.');
      expect(result.definition).toContain('n. Composure.');
      expect(result.examples).toContain('A cool breeze.');
      expect(result.examples).toContain('Keep your cool.');
    });

    it('should prefer longer pronunciation when merging', async () => {
      const primaryResponse = [
        {
          word: 'test',
          phonetics: [{ text: '/t/' }],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: 'A test.' }] },
          ],
        },
      ];
      const fallbackResponse = [
        {
          word: 'test',
          phonetics: [{ text: '/t\u025Bst/' }],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: 'A test.' }] },
          ],
        },
      ];

      const promise = service.lookupWord('test');
      flushPrimaryAndFallback('test', primaryResponse, fallbackResponse);

      const result = await promise;
      expect(result.pronunciation).toBe('/t\u025Bst/');
    });

    it('should keep primary pronunciation when it is longer', async () => {
      const primaryResponse = [
        {
          word: 'test',
          phonetics: [{ text: '/t\u025Bst\u026Ang/' }],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: 'A test.' }] },
          ],
        },
      ];
      const fallbackResponse = [
        {
          word: 'test',
          phonetics: [{ text: '/t/' }],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: 'A test.' }] },
          ],
        },
      ];

      const promise = service.lookupWord('test');
      flushPrimaryAndFallback('test', primaryResponse, fallbackResponse);

      const result = await promise;
      expect(result.pronunciation).toBe('/t\u025Bst\u026Ang/');
    });

    it('should deduplicate examples when merging (case-insensitive)', async () => {
      const primaryResponse = [
        {
          word: 'test',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'noun',
              definitions: [
                { definition: 'A test.', example: 'Take a test.' },
              ],
            },
          ],
        },
      ];
      const fallbackResponse = [
        {
          word: 'test',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'noun',
              definitions: [
                { definition: 'A test.', example: 'Take a test.' },
                { definition: 'An exam.', example: 'Pass the test.' },
              ],
            },
          ],
        },
      ];

      const promise = service.lookupWord('test');
      flushPrimaryAndFallback('test', primaryResponse, fallbackResponse);

      const result = await promise;
      expect(result.examples).toEqual(['Take a test.', 'Pass the test.']);
    });

    it('should cap merged examples at 5', async () => {
      const makeResponse = (examples: string[]) => [
        {
          word: 'big',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'adjective',
              definitions: examples.map(ex => ({ definition: 'Large.', example: ex })),
            },
          ],
        },
      ];

      const promise = service.lookupWord('big');
      flushPrimaryAndFallback(
        'big',
        makeResponse(['Ex1.', 'Ex2.', 'Ex3.']),
        makeResponse(['Ex4.', 'Ex5.', 'Ex6.', 'Ex7.']),
      );

      const result = await promise;
      expect(result.examples).toHaveLength(5);
    });

    it('should return longer definition when one contains the other', async () => {
      const primaryResponse = [
        {
          word: 'test',
          phonetics: [],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: 'A test.' }] },
          ],
        },
      ];
      const fallbackResponse = [
        {
          word: 'test',
          phonetics: [],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: 'A test.' }] },
            { partOfSpeech: 'verb', definitions: [{ definition: 'To evaluate.' }] },
          ],
        },
      ];

      const promise = service.lookupWord('test');
      flushPrimaryAndFallback('test', primaryResponse, fallbackResponse);

      const result = await promise;
      // Fallback definition "n. A test. · v. To evaluate." contains primary "n. A test."
      expect(result.definition).toBe('n. A test. · v. To evaluate.');
    });

    // --- Rate limit & cooldown ---

    it('should set primaryRateLimited when primary returns 429', async () => {
      const promise1 = service.lookupWord('hello');
      flushPrimaryAndFallback(
        'hello',
        null,
        simpleResponse(),
        { status: 429, statusText: 'Too Many Requests' },
      );
      await promise1;

      // Second call: primary should be skipped
      const promise2 = service.lookupWord('world');
      httpController.expectNone(API_BASE + 'world');
      httpController.expectOne(FALLBACK_API_BASE + 'world')
        .flush(simpleResponse('world', 'The earth.'));

      const result = await promise2;
      expect(result.definition).toBe('n. The earth.');
    });

    it('should retry primary after cooldown expires', async () => {
      const realDateNow = Date.now;
      let mockNow = 1000000;
      Date.now = () => mockNow;

      try {
        const promise1 = service.lookupWord('hello');
        flushPrimaryAndFallback(
          'hello',
          null,
          simpleResponse(),
          { status: 429, statusText: 'Too Many Requests' },
        );
        await promise1;

        mockNow += 31_000;

        const promise2 = service.lookupWord('test');
        flushBoth('test', simpleResponse('test', 'An examination.'));
        const result = await promise2;
        expect(result.definition).toBe('n. An examination.');
      } finally {
        Date.now = realDateNow;
      }
    });

    it('should throw "Word not found" when rate-limited and fallback 404s', async () => {
      // Trigger rate limit
      const promise1 = service.lookupWord('hello');
      flushPrimaryAndFallback(
        'hello',
        null,
        simpleResponse(),
        { status: 429, statusText: 'Too Many Requests' },
      );
      await promise1;

      // Now primary is skipped, fallback 404s
      const promise2 = service.lookupWord('xyznotaword');
      httpController.expectNone(API_BASE + 'xyznotaword');
      httpController.expectOne(FALLBACK_API_BASE + 'xyznotaword')
        .flush(null, { status: 404, statusText: 'Not Found' });

      await expect(promise2).rejects.toThrow('Word not found. Try a different spelling.');
    });

    it('should throw RateLimitError when rate-limited and fallback also 429s', async () => {
      // Trigger rate limit
      const promise1 = service.lookupWord('hello');
      flushPrimaryAndFallback(
        'hello',
        null,
        simpleResponse(),
        { status: 429, statusText: 'Too Many Requests' },
      );
      await promise1;

      // Fallback also 429s
      const promise2 = service.lookupWord('world');
      httpController.expectNone(API_BASE + 'world');
      httpController.expectOne(FALLBACK_API_BASE + 'world')
        .flush(null, { status: 429, statusText: 'Too Many Requests' });

      await expect(promise2).rejects.toBeInstanceOf(RateLimitError);
    });

    // --- Error handling in lookupFrom ---

    it('should throw "Unexpected response" when API returns empty array', async () => {
      const promise = service.lookupWord('test');

      flushPrimaryAndFallback(
        'test',
        [],
        [],
      );

      await expect(promise).rejects.toThrow('Unexpected response from dictionary API');
    });

    it('should throw "Unexpected response" when entry has no meanings array', async () => {
      const promise = service.lookupWord('test');

      const badResponse = [{ word: 'test', phonetics: [] }];
      flushBoth('test', badResponse);

      await expect(promise).rejects.toThrow('Unexpected response from dictionary API');
    });

    it('should re-throw Error instances from unexpected errors', async () => {
      // When response is null (not an array), the code throws "Unexpected response"
      const promise = service.lookupWord('test');
      flushBoth('test', null);

      await expect(promise).rejects.toThrow('Unexpected response from dictionary API');
    });
  });

  // ── Bulk mode ───────────────────────────────────────────────

  describe('bulk mode', () => {

    // --- Happy path ---

    it('should use primary API only when not rate-limited', async () => {
      const promise = service.lookupWord('ephemeral', { bulkMode: true });
      const req = httpController.expectOne(API_BASE + 'ephemeral');
      httpController.expectNone(FALLBACK_API_BASE + 'ephemeral');
      req.flush(mockApiResponse);

      const result = await promise;
      expect(result.pronunciation).toBe('/\u026A\u02C8f\u025Bm.\u0259r.\u0259l/');
      expect(result.definition).toBe(
        'adj. Lasting for a very short time. · n. An ephemeral plant.',
      );
      expect(result.examples).toEqual([
        'The ephemeral joys of childhood.',
        'Ephemeral streams only flow after rain.',
        'Many desert plants are ephemerals.',
      ]);
    });

    // --- 429 fallback ---

    it('should fall back to secondary API when primary returns 429', async () => {
      const promise = service.lookupWord('hello', { bulkMode: true });
      httpController.expectOne(API_BASE + 'hello')
        .flush(null, { status: 429, statusText: 'Too Many Requests' });

      await tick();

      httpController.expectOne(FALLBACK_API_BASE + 'hello')
        .flush(simpleResponse());

      const result = await promise;
      expect(result.definition).toBe('n. A greeting.');
    });

    // --- 404 fallback ---

    it('should fall back to fallback API when primary returns 404', async () => {
      const promise = service.lookupWord('rare', { bulkMode: true });
      httpController.expectOne(API_BASE + 'rare')
        .flush(null, { status: 404, statusText: 'Not Found' });

      await tick();

      httpController.expectOne(FALLBACK_API_BASE + 'rare')
        .flush(simpleResponse('rare', 'Not common.'));

      const result = await promise;
      expect(result.definition).toBe('n. Not common.');
    });

    it('should throw "Word not found" when both APIs return 404', async () => {
      const promise = service.lookupWord('xyznotaword', { bulkMode: true });
      httpController.expectOne(API_BASE + 'xyznotaword')
        .flush(null, { status: 404, statusText: 'Not Found' });

      await tick();

      httpController.expectOne(FALLBACK_API_BASE + 'xyznotaword')
        .flush(null, { status: 404, statusText: 'Not Found' });

      await expect(promise).rejects.toThrow('Word not found. Try a different spelling.');
    });

    // --- Empty definition fallback ---

    it('should fall back when primary returns empty definition', async () => {
      const emptyDefResponse = [
        {
          word: 'rare',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'adjective',
              definitions: [{ definition: '' }],
            },
          ],
        },
      ];

      const promise = service.lookupWord('rare', { bulkMode: true });
      httpController.expectOne(API_BASE + 'rare').flush(emptyDefResponse);

      await tick();

      httpController.expectOne(FALLBACK_API_BASE + 'rare')
        .flush(simpleResponse('rare', 'Not common.'));

      const result = await promise;
      expect(result.definition).toBe('n. Not common.');
    });

    it('should fall back when primary returns no meanings with definitions', async () => {
      const noDefResponse = [
        {
          word: 'rare',
          phonetics: [],
          meanings: [
            { partOfSpeech: 'adjective', definitions: [] },
          ],
        },
      ];

      const promise = service.lookupWord('rare', { bulkMode: true });
      httpController.expectOne(API_BASE + 'rare').flush(noDefResponse);

      await tick();

      httpController.expectOne(FALLBACK_API_BASE + 'rare')
        .flush(simpleResponse('rare', 'Not common.'));

      const result = await promise;
      expect(result.definition).toBe('n. Not common.');
    });

    // --- Network errors ---

    it('should not fall back on network error (status 0)', async () => {
      const promise = service.lookupWord('hello', { bulkMode: true });
      httpController.expectOne(API_BASE + 'hello')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      await expect(promise).rejects.toThrow(
        'Could not connect to dictionary. Check your internet connection.',
      );
    });

    // --- Rate limit + cooldown ---

    it('should skip primary and go straight to fallback during cooldown', async () => {
      const promise1 = service.lookupWord('hello', { bulkMode: true });
      httpController.expectOne(API_BASE + 'hello')
        .flush(null, { status: 429, statusText: 'Too Many Requests' });

      await tick();

      httpController.expectOne(FALLBACK_API_BASE + 'hello')
        .flush(simpleResponse());
      await promise1;

      const promise2 = service.lookupWord('world', { bulkMode: true });
      httpController.expectNone(API_BASE + 'world');
      httpController.expectOne(FALLBACK_API_BASE + 'world')
        .flush(simpleResponse('world', 'The earth.'));

      const result = await promise2;
      expect(result.definition).toBe('n. The earth.');
    });

    it('should retry primary after cooldown expires', async () => {
      const realDateNow = Date.now;
      let mockNow = 1000000;
      Date.now = () => mockNow;

      try {
        const promise1 = service.lookupWord('hello', { bulkMode: true });
        httpController.expectOne(API_BASE + 'hello')
          .flush(null, { status: 429, statusText: 'Too Many Requests' });
        await tick();
        httpController.expectOne(FALLBACK_API_BASE + 'hello')
          .flush(simpleResponse());
        await promise1;

        mockNow += 31_000;

        const promise2 = service.lookupWord('test', { bulkMode: true });
        httpController.expectOne(API_BASE + 'test')
          .flush(simpleResponse('test', 'An examination.'));

        const result = await promise2;
        expect(result.definition).toBe('n. An examination.');
      } finally {
        Date.now = realDateNow;
      }
    });

    it('should throw RateLimitError when both APIs return 429', async () => {
      const promise = service.lookupWord('test', { bulkMode: true });
      httpController.expectOne(API_BASE + 'test')
        .flush(null, { status: 429, statusText: 'Too Many Requests' });

      await tick();

      httpController.expectOne(FALLBACK_API_BASE + 'test')
        .flush(null, { status: 429, statusText: 'Too Many Requests' });

      await expect(promise).rejects.toBeInstanceOf(RateLimitError);
    });

    it('should throw "Word not found" when primary 429s and fallback 404s', async () => {
      const promise = service.lookupWord('xyz', { bulkMode: true });
      httpController.expectOne(API_BASE + 'xyz')
        .flush(null, { status: 429, statusText: 'Too Many Requests' });

      await tick();

      httpController.expectOne(FALLBACK_API_BASE + 'xyz')
        .flush(null, { status: 404, statusText: 'Not Found' });

      await expect(promise).rejects.toThrow('Word not found. Try a different spelling.');
    });

    it('should throw connection error when primary 404s and fallback network-errors', async () => {
      const promise = service.lookupWord('rare', { bulkMode: true });
      httpController.expectOne(API_BASE + 'rare')
        .flush(null, { status: 404, statusText: 'Not Found' });

      await tick();

      httpController.expectOne(FALLBACK_API_BASE + 'rare')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      await expect(promise).rejects.toThrow(
        'Could not connect to dictionary. Check your internet connection.',
      );
    });

    // --- Normalization ---

    it('should normalize fallback API response the same as primary', async () => {
      const promise = service.lookupWord('dummy', { bulkMode: true });
      httpController.expectOne(API_BASE + 'dummy')
        .flush(null, { status: 429, statusText: 'Too Many Requests' });

      await tick();

      httpController.expectOne(FALLBACK_API_BASE + 'dummy')
        .flush([
          {
            word: 'dummy',
            phonetics: [{ text: '/\u02C8d\u028Cmi/' }],
            meanings: [
              {
                partOfSpeech: 'noun',
                definitions: [
                  { definition: 'A model or replica.', example: 'A crash test dummy.' },
                ],
              },
            ],
          },
        ]);

      const result = await promise;
      expect(result.pronunciation).toBe('/\u02C8d\u028Cmi/');
      expect(result.definition).toBe('n. A model or replica.');
      expect(result.examples).toEqual(['A crash test dummy.']);
    });

    // --- Unexpected response ---

    it('should throw "Unexpected response" when primary returns empty array', async () => {
      const promise = service.lookupWord('test', { bulkMode: true });
      httpController.expectOne(API_BASE + 'test').flush([]);

      await expect(promise).rejects.toThrow('Unexpected response from dictionary API');
    });
  });

  // ── Cache ───────────────────────────────────────────────────

  describe('cache', () => {
    it('should return cached result on second lookup', async () => {
      const promise1 = service.lookupWord('hello');
      flushBoth('hello', simpleResponse());
      const result1 = await promise1;

      const result2 = await service.lookupWord('hello');
      expect(result2).toEqual(result1);
    });

    it('should cache bulk-mode results too', async () => {
      const promise1 = service.lookupWord('hello', { bulkMode: true });
      httpController.expectOne(API_BASE + 'hello').flush(simpleResponse());
      const result1 = await promise1;

      const result2 = await service.lookupWord('hello', { bulkMode: true });
      expect(result2).toEqual(result1);
    });

    it('should serve cached result regardless of mode', async () => {
      const promise1 = service.lookupWord('hello', { bulkMode: true });
      httpController.expectOne(API_BASE + 'hello').flush(simpleResponse());
      const result1 = await promise1;

      const result2 = await service.lookupWord('hello');
      expect(result2).toEqual(result1);
    });

    it('should cache different words independently', async () => {
      const promise1 = service.lookupWord('hello');
      flushBoth('hello', simpleResponse('hello', 'A greeting.'));
      const result1 = await promise1;

      const promise2 = service.lookupWord('world');
      flushBoth('world', simpleResponse('world', 'The earth.'));
      const result2 = await promise2;

      expect(result1.definition).toBe('n. A greeting.');
      expect(result2.definition).toBe('n. The earth.');

      // Both served from cache
      const cached1 = await service.lookupWord('hello');
      const cached2 = await service.lookupWord('world');
      expect(cached1).toEqual(result1);
      expect(cached2).toEqual(result2);
    });

    it('should not cache failed lookups', async () => {
      // Both 404 → failure
      const promise1 = service.lookupWord('xyznotaword');
      flushPrimaryAndFallback(
        'xyznotaword',
        null,
        null,
        { status: 404, statusText: 'Not Found' },
        { status: 404, statusText: 'Not Found' },
      );
      await expect(promise1).rejects.toThrow('Word not found');

      // Retry should make new requests (not cached)
      const promise2 = service.lookupWord('xyznotaword');
      flushBoth('xyznotaword', simpleResponse('xyznotaword', 'Found this time.'));
      const result = await promise2;
      expect(result.definition).toBe('n. Found this time.');
    });

    it('should evict oldest entry when cache reaches max size', async () => {
      // Fill cache beyond limit by looking up 201 unique words
      // We just need to verify it doesn't crash and old entries get evicted
      for (let i = 0; i < 201; i++) {
        const word = `word${i}`;
        const promise = service.lookupWord(word, { bulkMode: true });
        httpController.expectOne(API_BASE + word)
          .flush(simpleResponse(word, `Definition ${i}.`));
        await promise;
      }

      // word0 should have been evicted; word200 should be cached
      // word200 should be served from cache (no HTTP)
      const cached = await service.lookupWord('word200', { bulkMode: true });
      expect(cached.definition).toBe('n. Definition 200.');

      // word0 should require a new HTTP request
      const promise = service.lookupWord('word0', { bulkMode: true });
      httpController.expectOne(API_BASE + 'word0')
        .flush(simpleResponse('word0', 'Re-fetched.'));
      const result = await promise;
      expect(result.definition).toBe('n. Re-fetched.');
    });
  });

  // ── Multi-definition format ─────────────────────────────────

  describe('multi-definition format', () => {
    it('should abbreviate common parts of speech', async () => {
      const response = [
        {
          word: 'fast',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'adjective',
              definitions: [{ definition: 'Quick.' }],
            },
            {
              partOfSpeech: 'adverb',
              definitions: [{ definition: 'Quickly.' }],
            },
            {
              partOfSpeech: 'verb',
              definitions: [{ definition: 'To abstain from food.' }],
            },
            {
              partOfSpeech: 'noun',
              definitions: [{ definition: 'A period of fasting.' }],
            },
          ],
        },
      ];

      const promise = service.lookupWord('fast');
      flushBoth('fast', response);
      const result = await promise;
      expect(result.definition).toBe(
        'adj. Quick. · adv. Quickly. · v. To abstain from food. · n. A period of fasting.',
      );
    });

    it('should handle unknown parts of speech gracefully', async () => {
      const response = [
        {
          word: 'hmm',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'particle',
              definitions: [{ definition: 'Expression of thought.' }],
            },
          ],
        },
      ];

      const promise = service.lookupWord('hmm');
      flushBoth('hmm', response);
      const result = await promise;
      expect(result.definition).toBe('particle. Expression of thought.');
    });

    it('should abbreviate all supported parts of speech', async () => {
      const allPos = [
        'noun', 'verb', 'adjective', 'adverb', 'pronoun',
        'preposition', 'conjunction', 'interjection', 'determiner', 'exclamation',
      ];
      const expected = [
        'n.', 'v.', 'adj.', 'adv.', 'pron.',
        'prep.', 'conj.', 'interj.', 'det.', 'excl.',
      ];

      const response = [
        {
          word: 'test',
          phonetics: [],
          meanings: allPos.map((pos, i) => ({
            partOfSpeech: pos,
            definitions: [{ definition: `Def ${i}.` }],
          })),
        },
      ];

      const promise = service.lookupWord('test');
      flushBoth('test', response);
      const result = await promise;

      for (let i = 0; i < expected.length; i++) {
        expect(result.definition).toContain(`${expected[i]} Def ${i}.`);
      }
    });

    it('should only take first definition per meaning', async () => {
      const response = [
        {
          word: 'test',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'noun',
              definitions: [
                { definition: 'First definition.' },
                { definition: 'Second definition.' },
                { definition: 'Third definition.' },
              ],
            },
          ],
        },
      ];

      const promise = service.lookupWord('test');
      flushBoth('test', response);
      const result = await promise;
      expect(result.definition).toBe('n. First definition.');
      expect(result.definition).not.toContain('Second');
    });
  });

  // ── allMeanings enrichment ───────────────────────────────────

  describe('allMeanings enrichment (single mode)', () => {
    it('should return allMeanings array with all definitions from mock response', async () => {
      const promise = service.lookupWord('ephemeral');
      flushBoth('ephemeral', mockApiResponse);
      const result = await promise;

      expect(result.allMeanings).toBeDefined();
      expect(Array.isArray(result.allMeanings)).toBe(true);
      // ephemeral mock has 2 adjective defs + 1 noun def = 3 meanings per source
      // deduped they stay 3 (same data from both APIs)
      expect(result.allMeanings?.length).toBe(3);
    });

    it('should include pos, posAbbrev, definition, and pronunciation per meaning', async () => {
      const promise = service.lookupWord('ephemeral');
      flushBoth('ephemeral', mockApiResponse);
      const result = await promise;

      const allMeanings = result.allMeanings ?? [];
      const first = allMeanings[0];
      expect(first.pos).toBe('adjective');
      expect(first.posAbbrev).toBe('adj.');
      expect(first.definition).toBe('Lasting for a very short time.');
      expect(first.pronunciation).toBe('/\u026A\u02C8f\u025Bm.\u0259r.\u0259l/');
    });

    it('should include all definitions from both APIs — not just first-per-POS', async () => {
      const response = [
        {
          word: 'run',
          phonetics: [{ text: '/r\u028Cn/' }],
          meanings: [
            {
              partOfSpeech: 'verb',
              definitions: [
                { definition: 'Move quickly.', example: 'I run every day.' },
                { definition: 'Operate a business.', example: 'She runs a company.' },
              ],
            },
          ],
        },
      ];

      const promise = service.lookupWord('run');
      flushBoth('run', response);
      const result = await promise;

      // Both verb definitions must be present (not just first)
      const defs = (result.allMeanings ?? []).map((m) => m.definition);
      expect(defs).toContain('Move quickly.');
      expect(defs).toContain('Operate a business.');
    });

    it('should deduplicate identical definitions across API sources', async () => {
      const promise = service.lookupWord('ephemeral');
      // Both primary and fallback return same data
      flushBoth('ephemeral', mockApiResponse);
      const result = await promise;

      const defTexts = (result.allMeanings ?? []).map((m) => m.definition);
      const uniqueTexts = new Set(defTexts);
      // No duplicates
      expect(defTexts.length).toBe(uniqueTexts.size);
    });

    it('should allow more than 5 examples in allMeanings (uncapped)', async () => {
      const response = [
        {
          word: 'big',
          phonetics: [],
          meanings: [
            {
              partOfSpeech: 'adjective',
              definitions: [
                { definition: 'Large in size.', example: 'Ex1.' },
                { definition: 'Important.', example: 'Ex2.' },
                { definition: 'Grown up.', example: 'Ex3.' },
                { definition: 'Generous.', example: 'Ex4.' },
                { definition: 'Intense.', example: 'Ex5.' },
                { definition: 'Impressive.', example: 'Ex6.' },
              ],
            },
          ],
        },
      ];

      const promise = service.lookupWord('big');
      flushBoth('big', response);
      const result = await promise;

      // allMeanings should have 6 entries (uncapped), each with its own example
      const allMeaningsBig = result.allMeanings ?? [];
      expect(allMeaningsBig.length).toBeGreaterThan(5);
      const examples = allMeaningsBig.map((m) => m.example).filter(Boolean);
      expect(examples.length).toBeGreaterThan(5);
    });

    it('should cache allMeanings on second call', async () => {
      const promise1 = service.lookupWord('hello');
      flushBoth('hello', simpleResponse());
      const result1 = await promise1;

      // Second call — should be from cache, no HTTP
      const result2 = await service.lookupWord('hello');
      expect(result2.allMeanings).toBeDefined();
      expect(result2.allMeanings).toEqual(result1.allMeanings);
    });

    it('should include correct pronunciation per sourceIndex', async () => {
      const primaryResponse = [
        {
          word: 'test',
          phonetics: [{ text: '/t\u025Bst/' }],
          meanings: [
            { partOfSpeech: 'noun', definitions: [{ definition: 'An examination.' }] },
          ],
        },
      ];
      const fallbackResponse = [
        {
          word: 'test',
          phonetics: [{ text: '/t\u025BstAlt/' }],
          meanings: [
            { partOfSpeech: 'verb', definitions: [{ definition: 'To evaluate.' }] },
          ],
        },
      ];

      const promise = service.lookupWord('test');
      flushPrimaryAndFallback('test', primaryResponse, fallbackResponse);
      const result = await promise;

      const allMeaningsTest = result.allMeanings ?? [];
      const nounMeaning = allMeaningsTest.find((m) => m.pos === 'noun');
      const verbMeaning = allMeaningsTest.find((m) => m.pos === 'verb');

      expect(nounMeaning?.pronunciation).toBe('/t\u025Bst/');
      expect(verbMeaning?.pronunciation).toBe('/t\u025BstAlt/');
    });
  });

  // \u2500\u2500 mergeResults edge behavior \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // mergeResults is private; the only caller guards it with
  // `if (primary || fallback)`, so both-null is unreachable in practice.
  // These tests pin the intended edge behavior: throw on (null, null),
  // return the present side otherwise.
  describe('mergeResults edge cases', () => {
    const merge = (
      primary: DictionaryLookupResult | null,
      fallback: DictionaryLookupResult | null,
    ): DictionaryLookupResult =>
      (service as unknown as {
        mergeResults(
          p: DictionaryLookupResult | null,
          f: DictionaryLookupResult | null,
        ): DictionaryLookupResult;
      }).mergeResults(primary, fallback);

    const sample = (overrides: Partial<DictionaryLookupResult> = {}): DictionaryLookupResult => ({
      pronunciation: '/p/',
      definition: 'n. a thing',
      examples: ['An example.'],
      ...overrides,
    });

    it('throws when both primary and fallback are null (defensive guard)', () => {
      expect(() => merge(null, null)).toThrow(
        'mergeResults: both primary and fallback are null',
      );
    });

    it('returns fallback when primary is null', () => {
      const fallback = sample({ definition: 'n. fallback def' });
      expect(merge(null, fallback)).toBe(fallback);
    });

    it('returns primary when fallback is null', () => {
      const primary = sample({ definition: 'n. primary def' });
      expect(merge(primary, null)).toBe(primary);
    });
  });
});
