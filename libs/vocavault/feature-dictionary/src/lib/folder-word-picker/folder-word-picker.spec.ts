import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';
import { FolderWordPicker } from './folder-word-picker';
import { makeWord, makeFolder, Word } from '@vocavault/data-access';

interface FolderWordPickerInternals {
  searchQuery: WritableSignal<string>;
  selectedIds: WritableSignal<Set<string>>;
  filteredWords(): Word[];
  selectableWords(): Word[];
  allSelected(): boolean;
  newSelectionCount(): number;
  toggleWord(word: Word): void;
  toggleSelectAll(): void;
  onConfirm(): void;
  onCancel(): void;
}

describe('FolderWordPicker', () => {
  let fixture: ComponentFixture<FolderWordPicker>;
  let component: FolderWordPicker;

  const folder = makeFolder({ id: 'f1' });
  const completeWord = makeWord({ id: 'w1', word: 'Apple', definition: 'A fruit' });
  const incompleteWord = makeWord({ id: 'w2', word: 'Banana', definition: '', incomplete: true });
  const folderWord = makeWord({ id: 'w3', word: 'Cherry', definition: 'Red fruit', folderId: 'f1' });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FolderWordPicker],
    }).compileComponents();

    fixture = TestBed.createComponent(FolderWordPicker);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('folder', folder);
    fixture.componentRef.setInput('words', [completeWord, incompleteWord, folderWord]);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('excludes incomplete words from the filtered list', () => {
    fixture.detectChanges();
    const filtered = (component as unknown as FolderWordPickerInternals).filteredWords();
    const ids = filtered.map((w: Word) => w.id);
    expect(ids).toContain('w1');
    expect(ids).not.toContain('w2');
  });

  it('includes words already in folder but excludes incomplete', () => {
    fixture.detectChanges();
    const filtered = (component as unknown as FolderWordPickerInternals).filteredWords();
    const ids = filtered.map((w: Word) => w.id);
    expect(ids).toContain('w3');
    expect(ids).not.toContain('w2');
  });

  it('only shows complete words when searching', () => {
    fixture.detectChanges();
    (component as unknown as FolderWordPickerInternals).searchQuery.set('an'); // matches "Banana" (incomplete) partially
    const filtered = (component as unknown as FolderWordPickerInternals).filteredWords();
    expect(filtered.every((w: Word) => !w.incomplete)).toBe(true);
  });

  it('toggleWord does not select incomplete words even if bypassed', () => {
    fixture.detectChanges();
    // Even though incomplete words are filtered from the list,
    // verify toggleWord on a folder word is a no-op
    (component as unknown as FolderWordPickerInternals).toggleWord(folderWord);
    expect((component as unknown as FolderWordPickerInternals).selectedIds().has('w3')).toBe(false);
  });

  it('toggleWord selects and deselects a complete word', () => {
    fixture.detectChanges();
    (component as unknown as FolderWordPickerInternals).toggleWord(completeWord);
    expect((component as unknown as FolderWordPickerInternals).selectedIds().has('w1')).toBe(true);
    (component as unknown as FolderWordPickerInternals).toggleWord(completeWord);
    expect((component as unknown as FolderWordPickerInternals).selectedIds().has('w1')).toBe(false);
  });

  it('newSelectionCount only counts words not already in folder', () => {
    fixture.detectChanges();
    (component as unknown as FolderWordPickerInternals).toggleWord(completeWord);
    expect((component as unknown as FolderWordPickerInternals).newSelectionCount()).toBe(1);
  });

  it('onConfirm emits only newly selected word IDs', () => {
    fixture.detectChanges();
    let emitted: string[] = [];
    component.wordsAdded.subscribe((ids) => (emitted = ids));
    (component as unknown as FolderWordPickerInternals).toggleWord(completeWord);
    (component as unknown as FolderWordPickerInternals).onConfirm();
    expect(emitted).toEqual(['w1']);
  });

  it('onCancel resets selection and search', () => {
    fixture.detectChanges();
    (component as unknown as FolderWordPickerInternals).toggleWord(completeWord);
    (component as unknown as FolderWordPickerInternals).searchQuery.set('test');
    (component as unknown as FolderWordPickerInternals).onCancel();
    expect((component as unknown as FolderWordPickerInternals).selectedIds().size).toBe(0);
    expect((component as unknown as FolderWordPickerInternals).searchQuery()).toBe('');
  });

  // --- Select All ---

  it('selectableWords excludes words already in folder', () => {
    fixture.detectChanges();
    const selectable = (component as unknown as FolderWordPickerInternals).selectableWords();
    const ids = selectable.map((w: Word) => w.id);
    expect(ids).toContain('w1');
    expect(ids).not.toContain('w3'); // already in folder
    expect(ids).not.toContain('w2'); // incomplete
  });

  it('allSelected returns false when no words are selected', () => {
    fixture.detectChanges();
    expect((component as unknown as FolderWordPickerInternals).allSelected()).toBe(false);
  });

  it('toggleSelectAll selects all selectable words', () => {
    fixture.detectChanges();
    (component as unknown as FolderWordPickerInternals).toggleSelectAll();
    expect((component as unknown as FolderWordPickerInternals).allSelected()).toBe(true);
    expect((component as unknown as FolderWordPickerInternals).selectedIds().has('w1')).toBe(true);
    expect((component as unknown as FolderWordPickerInternals).selectedIds().has('w3')).toBe(false); // already in folder, not toggled
  });

  it('toggleSelectAll deselects all when all are already selected', () => {
    fixture.detectChanges();
    (component as unknown as FolderWordPickerInternals).toggleSelectAll();
    expect((component as unknown as FolderWordPickerInternals).allSelected()).toBe(true);
    (component as unknown as FolderWordPickerInternals).toggleSelectAll();
    expect((component as unknown as FolderWordPickerInternals).allSelected()).toBe(false);
    expect((component as unknown as FolderWordPickerInternals).selectedIds().size).toBe(0);
  });

  it('selectableWords respects search filter', () => {
    fixture.detectChanges();
    (component as unknown as FolderWordPickerInternals).searchQuery.set('apple');
    const selectable = (component as unknown as FolderWordPickerInternals).selectableWords();
    expect(selectable.length).toBe(1);
    expect(selectable[0].id).toBe('w1');
  });

  it('toggleSelectAll only affects filtered words', () => {
    const extraWord = makeWord({ id: 'w4', word: 'Durian', definition: 'Spiky fruit' });
    fixture.componentRef.setInput('words', [completeWord, incompleteWord, folderWord, extraWord]);
    fixture.detectChanges();

    (component as unknown as FolderWordPickerInternals).searchQuery.set('apple');
    (component as unknown as FolderWordPickerInternals).toggleSelectAll();

    expect((component as unknown as FolderWordPickerInternals).selectedIds().has('w1')).toBe(true);
    expect((component as unknown as FolderWordPickerInternals).selectedIds().has('w4')).toBe(false);
  });

  // --- Add new word / Bulk import outputs ---

  it('Add new word button emits addNewWord and closes', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    let emitted = false;
    component.addNewWord.subscribe(() => (emitted = true));
    (component as unknown as FolderWordPickerInternals).toggleWord(completeWord);
    (component as unknown as FolderWordPickerInternals).searchQuery.set('test');
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const btn = Array.from(buttons).find((b: HTMLButtonElement) => b.textContent?.includes('Add new word')) as HTMLButtonElement;
    btn.click();
    expect(emitted).toBe(true);
    expect((component as unknown as FolderWordPickerInternals).selectedIds().size).toBe(0);
    expect((component as unknown as FolderWordPickerInternals).searchQuery()).toBe('');
  });

  it('Bulk import button emits bulkImport and closes', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    let emitted = false;
    component.bulkImport.subscribe(() => (emitted = true));
    (component as unknown as FolderWordPickerInternals).toggleWord(completeWord);
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const bulkBtn = Array.from(buttons).find((b: HTMLButtonElement) => b.textContent?.includes('Bulk import')) as HTMLButtonElement;
    bulkBtn.click();
    expect(emitted).toBe(true);
    expect((component as unknown as FolderWordPickerInternals).selectedIds().size).toBe(0);
  });
});
