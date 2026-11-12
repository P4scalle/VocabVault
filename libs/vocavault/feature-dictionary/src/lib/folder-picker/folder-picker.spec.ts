import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Folder, StorageService, LocalStorageService } from '@vocavault/data-access';
import { FolderPicker } from './folder-picker';

describe('FolderPicker', () => {
  let fixture: ComponentFixture<FolderPicker>;
  let component: FolderPicker;

  const folders: Folder[] = [
    { id: 'f1', name: 'Animals', color: '#3A7CA5', createdAt: new Date() },
    { id: 'f2', name: 'Food', color: '#6366F1', createdAt: new Date() },
  ];

  const folderWordCounts = new Map<string, number>([
    ['f1', 5],
    ['f2', 12],
  ]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FolderPicker],
      providers: [
        { provide: StorageService, useClass: LocalStorageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FolderPicker);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('folders', folders);
    fixture.componentRef.setInput('folderWordCounts', folderWordCounts);
  });

  it('should create successfully', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should emit folderSelected output with folder ID on select', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const emitted: string[] = [];
    component.folderSelected.subscribe((id) => emitted.push(id));

    const buttons = fixture.nativeElement.querySelectorAll(
      'button[type="button"]'
    ) as NodeListOf<HTMLButtonElement>;

    // First button is "No folder" (emits ''), second is 'Animals', third is 'Food'
    const animalButton = buttons[1];
    animalButton.click();
    fixture.detectChanges();

    expect(emitted).toEqual(['f1']);
  });

  it('should render folder list from input', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      'button[type="button"]'
    ) as NodeListOf<HTMLButtonElement>;

    // 1 "No folder" button + 2 folder buttons + 1 "New Folder" button
    expect(buttons.length).toBe(4);

    expect(buttons[1].textContent).toContain('Animals');
    expect(buttons[1].textContent).toContain('5');
    expect(buttons[2].textContent).toContain('Food');
    expect(buttons[2].textContent).toContain('12');
    expect(buttons[3].textContent).toContain('New Folder');
  });

  it('should emit empty string when "No folder" is selected', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const emitted: string[] = [];
    component.folderSelected.subscribe((id) => emitted.push(id));

    const buttons = fixture.nativeElement.querySelectorAll(
      'button[type="button"]'
    ) as NodeListOf<HTMLButtonElement>;

    buttons[0].click();
    fixture.detectChanges();

    expect(emitted).toEqual(['']);
  });

  it('should show the custom title', () => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('title', 'Pick a folder');
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('h3') as HTMLElement;
    expect(heading.textContent).toContain('Pick a folder');
  });

  it('should not render content when visible is false', () => {
    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      'button[type="button"]'
    ) as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(0);
  });
});
