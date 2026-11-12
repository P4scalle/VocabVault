import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { QuizSetForm, QuizSetFormData } from './quiz-set-form';
import { FolderService, QuizSet, WordService, Word, StorageService, LocalStorageService, makeWord } from '@vocavault/data-access';
import { computed, Signal, WritableSignal, signal } from '@angular/core';
import { vi } from 'vitest';

interface QuizSetFormInternals {
  selectedWordIds: WritableSignal<string[]>;
  availableWords: Signal<Word[]>;
  filteredWords: Signal<Word[]>;
  color: WritableSignal<string>;
  showColorPicker: WritableSignal<boolean>;
  onSave: () => void;
  toggleWord: (wordId: string) => void;
}

const mockWord = makeWord({
  id: 'w1',
  word: 'Ephemeral',
  pronunciation: '/ɪˈfem.ər.əl/',
  definition: 'Lasting for only a short time.',
});

const mockEditQuizSet: QuizSet = {
  id: 'qs1',
  name: 'Existing Quiz',
  description: 'An existing quiz set.',
  wordIds: ['w1'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEditQuizSetWithColor: QuizSet = {
  ...mockEditQuizSet,
  id: 'qs2',
  color: '#EC4899',
};

describe('QuizSetForm', () => {
  let fixture: ComponentFixture<QuizSetForm>;
  let component: QuizSetForm;

  const mockWords = signal<Word[]>([mockWord]);

  const mockFolderService = {
    folders: signal([]).asReadonly(),
    getFolder: vi.fn().mockReturnValue(undefined),
  };

  beforeEach(async () => {
    mockFolderService.getFolder.mockClear();
    await TestBed.configureTestingModule({
      imports: [QuizSetForm],
      providers: [
        provideRouter([]),
        { provide: StorageService, useClass: LocalStorageService },
        {
          provide: WordService,
          useValue: {
            words: mockWords.asReadonly(),
            quizzableWords: computed(() => mockWords().filter((w) => !w.incomplete)),
          },
        },
        { provide: FolderService, useValue: mockFolderService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(QuizSetForm);
    component = fixture.componentInstance;
  });

  it('shows "New Quiz Set" title in add mode', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('New Quiz Set');
  });

  it('shows "Edit Quiz Set" title in edit mode with prefilled values', async () => {
    fixture.componentRef.setInput('editQuizSet', mockEditQuizSet);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Edit Quiz Set');
    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('#vv-quiz-name');
    expect(nameInput?.value).toBe('Existing Quiz');
  });

  it('Save button is disabled when name is empty', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const saveBtn = fixture.nativeElement.querySelector('lib-button[type="submit"] button') as HTMLButtonElement;
    expect(saveBtn?.disabled).toBe(true);
  });

  it('Save button is disabled when no words selected', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('#vv-quiz-name');
    nameInput.value = 'My Quiz';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    const saveBtn = fixture.nativeElement.querySelector('lib-button[type="submit"] button') as HTMLButtonElement;
    expect(saveBtn?.disabled).toBe(true);
  });

  it('Save button is enabled when name and words are present', async () => {
    fixture.componentRef.setInput('editQuizSet', mockEditQuizSet);
    fixture.detectChanges();
    await fixture.whenStable();
    const saveBtn = fixture.nativeElement.querySelector('lib-button[type="submit"] button') as HTMLButtonElement;
    expect(saveBtn?.disabled).toBe(false);
  });

  it('toggleWord adds and removes word id from selectedWordIds', () => {
    fixture.detectChanges();
    // Initially no words selected
    expect((component as unknown as QuizSetFormInternals).selectedWordIds()).toEqual([]);
    (component as unknown as QuizSetFormInternals).toggleWord('w1');
    expect((component as unknown as QuizSetFormInternals).selectedWordIds()).toContain('w1');
    (component as unknown as QuizSetFormInternals).toggleWord('w1');
    expect((component as unknown as QuizSetFormInternals).selectedWordIds()).not.toContain('w1');
  });

  it('emits cancelled when cancel/back button clicked', async () => {
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

  it('excludes incomplete words from available words list', () => {
    const incompleteWord = makeWord({ id: 'w2', word: 'Incomplete', incomplete: true });
    mockWords.set([mockWord, incompleteWord]);
    fixture.detectChanges();
    const available = (component as unknown as QuizSetFormInternals).availableWords();
    expect(available.length).toBe(1);
    expect(available[0].id).toBe('w1');
  });

  it('does not show incomplete words in filtered word list', () => {
    const incompleteWord = makeWord({ id: 'w2', word: 'Incomplete', incomplete: true });
    mockWords.set([mockWord, incompleteWord]);
    fixture.detectChanges();
    const filtered = (component as unknown as QuizSetFormInternals).filteredWords();
    expect(filtered.length).toBe(1);
    expect(filtered.every((w: Word) => !w.incomplete)).toBe(true);
  });

  describe('color picker', () => {
    it('should show "Add color label" button by default (no color picker visible)', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      const addColorBtn = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent?.includes('Add color label'));
      expect(addColorBtn).toBeTruthy();
      const colorPicker = fixture.nativeElement.querySelector('lib-color-picker');
      expect(colorPicker).toBeFalsy();
    });

    it('should show color picker when "Add color label" clicked', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      const addColorBtn = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent?.includes('Add color label'));
      addColorBtn?.click();
      fixture.detectChanges();
      await fixture.whenStable();
      const colorPicker = fixture.nativeElement.querySelector('lib-color-picker');
      expect(colorPicker).toBeTruthy();
    });

    it('should hide color picker and clear color when "Remove" clicked', async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      // Open color picker first
      const addColorBtn = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent?.includes('Add color label'));
      addColorBtn?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      // Click Remove
      const removeBtn = Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent?.trim() === 'Remove');
      removeBtn?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('lib-color-picker')).toBeFalsy();
      expect((component as unknown as QuizSetFormInternals).color()).toBe('');
    });

    it('should include color in saved form data', async () => {
      fixture.componentRef.setInput('editQuizSet', mockEditQuizSet);
      fixture.detectChanges();
      await fixture.whenStable();

      // Open color picker and set a color signal directly
      (component as unknown as QuizSetFormInternals).showColorPicker.set(true);
      (component as unknown as QuizSetFormInternals).color.set('#EC4899');
      fixture.detectChanges();

      const saved: QuizSetFormData[] = [];
      component.saved.subscribe((data: QuizSetFormData) => saved.push(data));

      (component as unknown as QuizSetFormInternals).onSave();

      expect(saved.length).toBe(1);
      expect(saved[0].color).toBe('#EC4899');
    });

    it('should pre-select color when editing quiz set with color', async () => {
      fixture.componentRef.setInput('editQuizSet', mockEditQuizSetWithColor);
      fixture.detectChanges();
      await fixture.whenStable();

      expect((component as unknown as QuizSetFormInternals).color()).toBe('#EC4899');
      expect((component as unknown as QuizSetFormInternals).showColorPicker()).toBe(true);
      const colorPicker = fixture.nativeElement.querySelector('lib-color-picker');
      expect(colorPicker).toBeTruthy();
    });

    it('should NOT include color when no color selected', async () => {
      fixture.componentRef.setInput('editQuizSet', mockEditQuizSet);
      fixture.detectChanges();
      await fixture.whenStable();

      const saved: QuizSetFormData[] = [];
      component.saved.subscribe((data: QuizSetFormData) => saved.push(data));

      (component as unknown as QuizSetFormInternals).onSave();

      expect(saved.length).toBe(1);
      expect(saved[0].color).toBeUndefined();
    });
  });

  it('delete button visible only in edit mode', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    let deleteBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b: HTMLButtonElement) => b.textContent?.includes('Delete'));
    expect(deleteBtn).toBeUndefined();

    fixture.componentRef.setInput('editQuizSet', mockEditQuizSet);
    fixture.detectChanges();
    await fixture.whenStable();
    deleteBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b: HTMLButtonElement) => b.textContent?.includes('Delete'));
    expect(deleteBtn).toBeTruthy();
  });
});
