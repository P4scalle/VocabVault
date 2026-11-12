import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  DictionaryApiService,
  StorageService,
  LocalStorageService,
  getQuizMeaning,
} from '@vocavault/data-access';
import { WordForm, WordFormData } from './word-form';

const mockLookupResult = {
  pronunciation: '/ɪˈfɛm.ər.əl/',
  definition: 'Lasting for a very short time.',
  examples: [
    'The ephemeral joys of childhood.',
    'Ephemeral streams only flow after rain.',
  ],
};

const mockLookupResultWithMeanings = {
  ...mockLookupResult,
  allMeanings: [
    {
      pos: 'adjective',
      posAbbrev: 'adj.',
      definition: 'Lasting for a very short time.',
      example: 'The ephemeral joys of childhood.',
      pronunciation: '/ɪˈfɛm.ər.əl/',
      sourceIndex: 0,
    },
    {
      pos: 'adjective',
      posAbbrev: 'adj.',
      definition: 'Transitory; existing only briefly.',
      example: 'Ephemeral streams only flow after rain.',
      pronunciation: '/ɪˈfɛm.ər.əl/',
      sourceIndex: 0,
    },
    {
      pos: 'noun',
      posAbbrev: 'n.',
      definition: 'Something short-lived.',
      pronunciation: '/ɪˈfɛm.ər.əl/',
      sourceIndex: 1,
    },
  ],
};

describe('WordForm', () => {
  let fixture: ComponentFixture<WordForm>;
  let component: WordForm;
  let mockDictionaryApi: { lookupWord: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDictionaryApi = {
      lookupWord: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [WordForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DictionaryApiService, useValue: mockDictionaryApi },
        { provide: StorageService, useClass: LocalStorageService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WordForm);
    component = fixture.componentInstance;
  });

  it('renders in add mode with empty fields', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const wordInput = fixture.nativeElement.querySelector('#vv-word') as HTMLInputElement;
    expect(wordInput.value).toBe('');
  });

  it('Save button is disabled when word is empty', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const saveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(saveBtn.disabled).toBe(true);
  });

  it('does not show Delete button in add mode', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const deleteBtn = Array.from(buttons).find((b) => b.textContent?.includes('Delete Term'));
    expect(deleteBtn).toBeUndefined();
  });

  it('shows Delete button in edit mode', async () => {
    fixture.componentRef.setInput('isEditMode', true);
    fixture.componentRef.setInput('initialData', {
      word: 'Test',
      pronunciation: '',
      definition: '',
      examples: [],
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const deleteBtn = Array.from(buttons).find((b) => b.textContent?.includes('Delete Term'));
    expect(deleteBtn).toBeTruthy();
  });

  it('emits cancelled when Cancel (back button) clicked', async () => {
    let cancelled = false;
    component.cancelled.subscribe(() => {
      cancelled = true;
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const backBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Go back"]',
    );
    backBtn?.click();
    expect(cancelled).toBe(true);
  });

  // --- New lookup integration tests ---

  it('renders Look up button', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const lookupBtn = Array.from(buttons).find((b) => b.textContent?.includes('Look up'));
    expect(lookupBtn).toBeTruthy();
  });

  it('Look up button is disabled when word field is empty', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const lookupBtn = Array.from(buttons).find((b) => b.textContent?.includes('Look up'));
    expect(lookupBtn?.disabled).toBe(true);
  });

  it('Look up button is enabled when word field has text', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const wordInput = fixture.nativeElement.querySelector('#vv-word') as HTMLInputElement;
    wordInput.value = 'ephemeral';
    wordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const lookupBtn = Array.from(buttons).find((b) => b.textContent?.includes('Look up'));
    expect(lookupBtn?.disabled).toBe(false);
  });

  it('successful lookup fills pronunciation, definition, and examples fields', async () => {
    mockDictionaryApi.lookupWord.mockResolvedValue(mockLookupResult);

    fixture.detectChanges();
    await fixture.whenStable();

    // Set word field
    const wordInput = fixture.nativeElement.querySelector('#vv-word') as HTMLInputElement;
    wordInput.value = 'ephemeral';
    wordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    // Click lookup
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const lookupBtn = Array.from(buttons).find((b) => b.textContent?.includes('Look up'));
    lookupBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // Wait for async lookup to complete
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();

    const pronunciationInput = fixture.nativeElement.querySelector('#vv-pronunciation') as HTMLInputElement;
    const definitionTextarea = fixture.nativeElement.querySelector('#vv-definition') as HTMLTextAreaElement;

    expect(pronunciationInput.value).toBe('/ɪˈfɛm.ər.əl/');
    expect(definitionTextarea.value).toBe('Lasting for a very short time.');
    expect(mockDictionaryApi.lookupWord).toHaveBeenCalledWith('ephemeral');
  });

  it('resetForm() clears all fields back to initial values', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    // Fill in fields
    const wordInput = fixture.nativeElement.querySelector('#vv-word') as HTMLInputElement;
    wordInput.value = 'test-word';
    wordInput.dispatchEvent(new Event('input'));
    const defTextarea = fixture.nativeElement.querySelector('#vv-definition') as HTMLTextAreaElement;
    defTextarea.value = 'a definition';
    defTextarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    // Verify fields are filled
    expect(wordInput.value).toBe('test-word');
    expect(defTextarea.value).toBe('a definition');

    // Call resetForm
    component.resetForm();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(wordInput.value).toBe('');
    expect(defTextarea.value).toBe('');
  });

  it('resetKey input triggers form reset when incremented', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    // Fill in word field
    const wordInput = fixture.nativeElement.querySelector('#vv-word') as HTMLInputElement;
    wordInput.value = 'filled-word';
    wordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(wordInput.value).toBe('filled-word');

    // Increment resetKey
    fixture.componentRef.setInput('resetKey', 1);
    fixture.detectChanges();
    await fixture.whenStable();
    // Allow effect to run
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(wordInput.value).toBe('');
  });

  it('resetForm() clears examples back to single empty entry', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    // Add examples by filling and adding more
    const addExampleBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('Add example'));
    addExampleBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const exampleInputs = fixture.nativeElement.querySelectorAll(
      'input[aria-label="Example sentence"]',
    ) as NodeListOf<HTMLInputElement>;
    expect(exampleInputs.length).toBe(2);

    // Fill the first example
    exampleInputs[0].value = 'An example sentence';
    exampleInputs[0].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    // Reset
    component.resetForm();
    fixture.detectChanges();
    await fixture.whenStable();

    const afterInputs = fixture.nativeElement.querySelectorAll(
      'input[aria-label="Example sentence"]',
    ) as NodeListOf<HTMLInputElement>;
    expect(afterInputs.length).toBe(1);
    expect(afterInputs[0].value).toBe('');
  });

  it('focusTermInput() sets focus on the term input', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component.focusTermInput();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const wordInput = fixture.nativeElement.querySelector('#vv-word') as HTMLInputElement;
    expect(document.activeElement).toBe(wordInput);
  });

  // --- Error feedback UI tests ---

  /** Helper: set word field, click "Look up", wait for async resolution */
  async function triggerLookup(word: string): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();

    const wordInput = fixture.nativeElement.querySelector('#vv-word') as HTMLInputElement;
    wordInput.value = word;
    wordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const lookupBtn = Array.from(buttons).find((b) => b.textContent?.includes('Look up'));
    lookupBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function getErrorElement(): HTMLElement | null {
    return fixture.nativeElement.querySelector('p.text-red-500[role="alert"]');
  }

  it('failed lookup shows "Word not found" error in DOM', async () => {
    mockDictionaryApi.lookupWord.mockRejectedValue(
      new Error('Word not found. Try a different spelling.'),
    );

    await triggerLookup('xyznotaword');

    const errorText = getErrorElement();
    expect(errorText).toBeTruthy();
    expect(errorText?.textContent?.trim()).toBe('Word not found. Try a different spelling.');
  });

  it('failed lookup shows connection error in DOM', async () => {
    mockDictionaryApi.lookupWord.mockRejectedValue(
      new Error('Could not connect to dictionary. Check your internet connection.'),
    );

    await triggerLookup('hello');

    const errorText = getErrorElement();
    expect(errorText).toBeTruthy();
    expect(errorText?.textContent?.trim()).toBe(
      'Could not connect to dictionary. Check your internet connection.',
    );
  });

  it('failed lookup shows timeout error in DOM', async () => {
    mockDictionaryApi.lookupWord.mockRejectedValue(
      new Error('Dictionary lookup timed out. Please try again.'),
    );

    await triggerLookup('slow');

    const errorText = getErrorElement();
    expect(errorText).toBeTruthy();
    expect(errorText?.textContent?.trim()).toBe(
      'Dictionary lookup timed out. Please try again.',
    );
  });

  it('shows generic "Lookup failed" for non-Error rejections', async () => {
    mockDictionaryApi.lookupWord.mockRejectedValue('string error');

    await triggerLookup('test');

    const errorText = getErrorElement();
    expect(errorText).toBeTruthy();
    expect(errorText?.textContent?.trim()).toBe('Lookup failed');
  });

  it('error message has role="alert" for screen readers', async () => {
    mockDictionaryApi.lookupWord.mockRejectedValue(new Error('Word not found.'));

    await triggerLookup('xyznotaword');

    const errorText = getErrorElement();
    expect(errorText).toBeTruthy();
    expect(errorText?.getAttribute('role')).toBe('alert');
  });

  it('error clears on successful re-lookup', async () => {
    // First: trigger error
    mockDictionaryApi.lookupWord.mockRejectedValue(new Error('Word not found.'));
    await triggerLookup('xyznotaword');
    expect(getErrorElement()).toBeTruthy();

    // Second: successful lookup
    mockDictionaryApi.lookupWord.mockResolvedValue(mockLookupResult);
    await triggerLookup('ephemeral');
    expect(getErrorElement()).toBeFalsy();
  });

  it('error is not shown before any lookup attempt', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getErrorElement()).toBeFalsy();
  });

  it('term input shakes on failed lookup', async () => {
    mockDictionaryApi.lookupWord.mockRejectedValue(new Error('Word not found.'));

    await triggerLookup('xyznotaword');

    const wordInput = fixture.nativeElement.querySelector('#vv-word') as HTMLInputElement;
    expect(wordInput.classList.contains('motion-safe:animate-shake')).toBe(true);
  });

  // --- Definition validation tests ---

  it('Save button is disabled when definition is a placeholder value', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    // Set word field so only definition blocks saving
    const wordInput = fixture.nativeElement.querySelector('#vv-word') as HTMLInputElement;
    wordInput.value = 'ephemeral';
    wordInput.dispatchEvent(new Event('input'));

    // Set definition to a blocklist placeholder
    const defTextarea = fixture.nativeElement.querySelector('#vv-definition') as HTMLTextAreaElement;
    defTextarea.value = 'Placeholder';
    defTextarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const saveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(saveBtn.disabled).toBe(true);
  });

  it('Save button is enabled when definition is a real value', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const wordInput = fixture.nativeElement.querySelector('#vv-word') as HTMLInputElement;
    wordInput.value = 'ephemeral';
    wordInput.dispatchEvent(new Event('input'));

    const defTextarea = fixture.nativeElement.querySelector('#vv-definition') as HTMLTextAreaElement;
    defTextarea.value = 'A real definition';
    defTextarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const saveBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(saveBtn.disabled).toBe(false);
  });

  it('validation hint appears when definition is a placeholder', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const defTextarea = fixture.nativeElement.querySelector('#vv-definition') as HTMLTextAreaElement;
    defTextarea.value = 'test';
    defTextarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const hint = fixture.nativeElement.querySelector('p[role="alert"]');
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toContain('Enter a real definition');
  });

  it('validation hint does NOT appear when definition is empty', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const defTextarea = fixture.nativeElement.querySelector('#vv-definition') as HTMLTextAreaElement;
    defTextarea.value = '';
    defTextarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const alerts = Array.from(
      fixture.nativeElement.querySelectorAll('p[role="alert"]') as NodeListOf<HTMLElement>,
    ).filter((el) => el.textContent?.includes('Enter a real definition'));
    expect(alerts.length).toBe(0);
  });

  it('validation hint does NOT appear when definition is valid', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const defTextarea = fixture.nativeElement.querySelector('#vv-definition') as HTMLTextAreaElement;
    defTextarea.value = 'A real definition';
    defTextarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    const alerts = Array.from(
      fixture.nativeElement.querySelectorAll('p[role="alert"]') as NodeListOf<HTMLElement>,
    ).filter((el) => el.textContent?.includes('Enter a real definition'));
    expect(alerts.length).toBe(0);
  });

  // --- Definition chip tests ---

  it('chip shows definition count after successful lookup with allMeanings', async () => {
    mockDictionaryApi.lookupWord.mockResolvedValue(mockLookupResultWithMeanings);
    await triggerLookup('ephemeral');

    const chip = fixture.nativeElement.querySelector(
      'button[aria-label*="definitions found"]',
    ) as HTMLButtonElement;
    expect(chip).toBeTruthy();
    expect(chip?.textContent).toContain('3 definitions found');
  });

  it('clicking chip sets definitionPickerOpen to true', async () => {
    mockDictionaryApi.lookupWord.mockResolvedValue(mockLookupResultWithMeanings);
    await triggerLookup('ephemeral');

    const chip = fixture.nativeElement.querySelector(
      'button[aria-label*="definitions found"]',
    ) as HTMLButtonElement;
    chip?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['definitionPickerOpen']()).toBe(true);
  });

  it('second onLookup() call opens picker without calling API again', async () => {
    mockDictionaryApi.lookupWord.mockResolvedValue(mockLookupResultWithMeanings);
    await triggerLookup('ephemeral');

    // Second lookup click
    mockDictionaryApi.lookupWord.mockClear();
    await triggerLookup('ephemeral');

    expect(mockDictionaryApi.lookupWord).not.toHaveBeenCalled();
    expect(component['definitionPickerOpen']()).toBe(true);
  });

  // --- Picker event handler tests ---

  it('onDefinitionAppended appends to existing definition with separator', () => {
    component['definition'].set('First def');
    component['onDefinitionAppended']({ definition: 'Second def', pronunciation: '/sɛk.ənd/' });
    expect(component['definition']()).toBe('First def · Second def');
  });

  it('onDefinitionAppended does not change pronunciation', () => {
    component['pronunciation'].set('/fɜːst/');
    component['definition'].set('First def');
    component['onDefinitionAppended']({ definition: 'Second def', pronunciation: '/sɛk.ənd/' });
    expect(component['pronunciation']()).toBe('/fɜːst/');
  });

  it('onExampleAppended adds to existing examples', () => {
    component['examples'].set(['existing example']);
    component['onExampleAppended']('appended example');
    expect(component['examples']()).toEqual(['existing example', 'appended example']);
  });

  it('resetForm clears availableMeanings and definitionPickerOpen', async () => {
    // Seed some state
    component['availableMeanings'].set(mockLookupResultWithMeanings.allMeanings);
    component['definitionPickerOpen'].set(true);

    component.resetForm();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['availableMeanings']()).toEqual([]);
    expect(component['definitionPickerOpen']()).toBe(false);
  });
});

describe('added computeds', () => {
  let fixture: ComponentFixture<WordForm>;
  let component: WordForm;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DictionaryApiService, useValue: { lookupWord: vi.fn() } },
        { provide: StorageService, useClass: LocalStorageService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WordForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('0 meanings: empty definition → addedDefinitions() === []', () => {
    component['definition'].set('');
    expect(component['addedDefinitions']()).toEqual([]);
  });

  it('1 meaning: definition "n. a test" → addedDefinitions() === ["a test"]', () => {
    component['definition'].set('n. a test');
    expect(component['addedDefinitions']()).toEqual(['a test']);
  });

  it('many: definition "n. one · v. two" → addedDefinitions() === ["one","two"]', () => {
    component['definition'].set('n. one · v. two');
    expect(component['addedDefinitions']()).toEqual(['one', 'two']);
  });

  it('addedExamples filters blank/whitespace entries', () => {
    component['examples'].set(['', 'hello', ' ']);
    expect(component['addedExamples']()).toEqual(['hello']);
  });
});

describe('idempotent add', () => {
  let fixture: ComponentFixture<WordForm>;
  let component: WordForm;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DictionaryApiService, useValue: { lookupWord: vi.fn() } },
        { provide: StorageService, useClass: LocalStorageService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WordForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('onDefinitionAppended with already-present definition (differing case) does not duplicate', () => {
    component['definition'].set('n. A Test');
    component['onDefinitionAppended']({ definition: 'a test', pronunciation: '/t/' });
    expect(component['addedDefinitions']().length).toBe(1);
  });

  it('onExampleAppended with already-present example (case-insensitive) does not duplicate', () => {
    component['examples'].set(['Hello World']);
    component['onExampleAppended']('hello world');
    expect(component['examples']().filter((e) => e.trim()).length).toBe(1);
  });

  it('onDefinitionAppended with a NEW definition appends it (positive control)', () => {
    component['definition'].set('n. one');
    component['onDefinitionAppended']({ definition: 'two', pronunciation: '/t/' });
    expect(component['addedDefinitions']().length).toBe(2);
  });
});

describe('remove handlers', () => {
  let fixture: ComponentFixture<WordForm>;
  let component: WordForm;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DictionaryApiService, useValue: { lookupWord: vi.fn() } },
        { provide: StorageService, useClass: LocalStorageService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WordForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('onDefinitionRemoved splices via removeMeaning: "n. one · v. two", remove "one" → "v. two"', () => {
    component['definition'].set('n. one · v. two');
    component['onDefinitionRemoved']({ definition: 'one' });
    expect(component['definition']()).toBe('v. two');
  });

  it('onExampleRemoved removes a non-last example and keeps the rest', () => {
    component['examples'].set(['a', 'b', 'c']);
    component['onExampleRemoved']('b');
    expect(component['examples']()).toEqual(['a', 'c']);
  });

  it('onExampleRemoved of only/last real example → examples() === [""] (never empty)', () => {
    component['examples'].set(['only']);
    component['onExampleRemoved']('only');
    expect(component['examples']()).toEqual(['']);
  });
});

describe('quizMeaningIndex clamp', () => {
  let fixture: ComponentFixture<WordForm>;
  let component: WordForm;
  let savedPayloads: WordFormData[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DictionaryApiService, useValue: { lookupWord: vi.fn() } },
        { provide: StorageService, useClass: LocalStorageService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WordForm);
    component = fixture.componentInstance;
    savedPayloads = [];
    component.saved.subscribe((v) => savedPayloads.push(v));
    fixture.detectChanges();
  });

  it('edit mode, initialData.quizMeaningIndex=2, 1 meaning → saved payload.quizMeaningIndex === 0', () => {
    fixture.componentRef.setInput('isEditMode', true);
    fixture.componentRef.setInput('initialData', {
      word: 'cat',
      definition: 'v. to categorize',
      quizMeaningIndex: 2,
    });
    fixture.detectChanges();
    component['wordField'].set('cat');
    component['definition'].set('v. to categorize');
    component['onSave']();
    expect(savedPayloads.length).toBe(1);
    expect(savedPayloads[0].quizMeaningIndex).toBe(0);
  });

  it('edit mode, initialData.quizMeaningIndex=0, 2 meanings → saved payload.quizMeaningIndex === 0 (unchanged)', () => {
    fixture.componentRef.setInput('isEditMode', true);
    fixture.componentRef.setInput('initialData', {
      word: 'cat',
      definition: 'n. a feline · v. to categorize',
      quizMeaningIndex: 0,
    });
    fixture.detectChanges();
    component['wordField'].set('cat');
    component['definition'].set('n. a feline · v. to categorize');
    component['onSave']();
    expect(savedPayloads.length).toBe(1);
    expect(savedPayloads[0].quizMeaningIndex).toBe(0);
  });

  it('add mode (isEditMode false) → saved payload has NO quizMeaningIndex key', () => {
    fixture.componentRef.setInput('isEditMode', false);
    fixture.detectChanges();
    component['wordField'].set('cat');
    component['definition'].set('n. a feline');
    component['onSave']();
    expect(savedPayloads.length).toBe(1);
    expect('quizMeaningIndex' in savedPayloads[0]).toBe(false);
  });
});

describe('word-form regression guards', () => {
  let fixture: ComponentFixture<WordForm>;
  let component: WordForm;
  let savedPayloads: WordFormData[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WordForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DictionaryApiService, useValue: { lookupWord: vi.fn() } },
        { provide: StorageService, useClass: LocalStorageService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WordForm);
    component = fixture.componentInstance;
    savedPayloads = [];
    component.saved.subscribe((v) => savedPayloads.push(v));
    fixture.detectChanges();
  });

  it('[RG-EXAMPLE-INVARIANT] index-based editing still works after remove-by-value', () => {
    // Start: remove last real example → ['']
    component['examples'].set(['only']);
    component['onExampleRemoved']('only');
    expect(component['examples']().length).toBeGreaterThanOrEqual(1);

    // Add and update example
    component['addExample']();
    component['updateExample'](0, 'new sentence');
    expect(component['examples']().length).toBeGreaterThanOrEqual(1);
    expect(component['examples']()[0]).toBe('new sentence');
  });

  it('[RG-PICKER-ADD] multi-add accumulates end-to-end: two distinct definitions both appear', () => {
    component['definition'].set('');
    component['onDefinitionAppended']({ definition: 'first meaning', pronunciation: '/f/' });
    component['onDefinitionAppended']({ definition: 'second meaning', pronunciation: '/s/' });
    expect(component['addedDefinitions']()).toContain('first meaning');
    expect(component['addedDefinitions']()).toContain('second meaning');
    expect(component['definition']()).toBe('first meaning · second meaning');
  });

  it('[RG-PICKER-ADD] multi-add accumulates end-to-end: two distinct examples both appear', () => {
    component['examples'].set(['']);
    component['onExampleAppended']('first example');
    component['onExampleAppended']('second example');
    expect(component['examples']()).toContain('first example');
    expect(component['examples']()).toContain('second example');
  });

  it('[RG-SAVE] save disabled after removing the last definition (definition becomes empty)', () => {
    component['wordField'].set('cat');
    component['definition'].set('n. only');
    component['onDefinitionRemoved']({ definition: 'only' });
    // definition() is now '', so save condition should be false
    const def = component['definition']();
    const word = component['wordField']();
    const invalid = component['definitionInvalid']();
    const saveDisabled = !word.trim() || !def.trim() || invalid;
    expect(saveDisabled).toBe(true);
  });

  it('[RG-SAVE] save NOT disabled when word + valid definition present (positive control)', () => {
    component['wordField'].set('cat');
    component['definition'].set('n. a feline');
    const def = component['definition']();
    const word = component['wordField']();
    const invalid = component['definitionInvalid']();
    const saveDisabled = !word.trim() || !def.trim() || invalid;
    expect(saveDisabled).toBe(false);
  });

  it('[RG-QUIZ] post-removal index realignment: quiz resolves surviving meaning after removal', () => {
    fixture.componentRef.setInput('isEditMode', true);
    fixture.componentRef.setInput('initialData', {
      word: 'cat',
      definition: 'n. a feline · v. to categorize',
      quizMeaningIndex: 1,
    });
    fixture.detectChanges();
    component['wordField'].set('cat');
    component['definition'].set('n. a feline · v. to categorize');

    // Remove the first meaning
    component['onDefinitionRemoved']({ definition: 'a feline' });
    expect(component['definition']()).toBe('v. to categorize');

    component['onSave']();
    expect(savedPayloads.length).toBe(1);
    expect(savedPayloads[0].quizMeaningIndex).toBe(0);

    // Prove the quiz resolves the right meaning
    const meaning = getQuizMeaning({
      definition: savedPayloads[0].definition,
      quizMeaningIndex: savedPayloads[0].quizMeaningIndex,
    });
    expect(meaning.text).toBe('to categorize');
  });
});
