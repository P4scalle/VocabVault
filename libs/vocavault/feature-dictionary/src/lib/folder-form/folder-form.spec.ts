// @vitest-environment jsdom
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Folder, FOLDER_COLORS, StorageService, LocalStorageService } from '@vocavault/data-access';
import { FolderForm } from './folder-form';

/** Query the color picker's swatch container rendered inside lib-color-picker */
function getSwatchContainer(fixture: ComponentFixture<FolderForm>): HTMLElement {
  return fixture.nativeElement.querySelector('lib-color-picker .color-dots');
}

describe('FolderForm', () => {
  let fixture: ComponentFixture<FolderForm>;
  let component: FolderForm;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FolderForm],
      providers: [
        { provide: StorageService, useClass: LocalStorageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FolderForm);
    component = fixture.componentInstance;
  });

  it('should create in "create" mode when no folder input', () => {
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('lib-button');
    const saveButton = buttons[buttons.length - 1] as HTMLElement;
    expect(saveButton.textContent).toContain('Create');
  });

  it('should create in "edit" mode with folder input (name/color pre-filled)', () => {
    const folder: Folder = {
      id: 'f1',
      name: 'Animals',
      color: '#6366F1',
      createdAt: new Date(),
    };
    fixture.componentRef.setInput('folder', folder);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.value).toBe('Animals');

    const buttons = fixture.nativeElement.querySelectorAll('lib-button');
    const saveButton = buttons[buttons.length - 1] as HTMLElement;
    expect(saveButton.textContent).toContain('Save');
  });

  it('should emit saved output with {name, color} on save', () => {
    fixture.detectChanges();

    const emitted: { name: string; color: string }[] = [];
    component.saved.subscribe((v) => emitted.push(v));

    // Enter name
    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'Fruits';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      'button.vv-btn-primary'
    ) as HTMLButtonElement;
    saveButton.click();
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0].name).toBe('Fruits');
    expect(emitted[0].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('should emit cancelled output on cancel button click', () => {
    fixture.detectChanges();

    const emitted: void[] = [];
    component.cancelled.subscribe(() => emitted.push(undefined));

    const cancelButton = fixture.nativeElement.querySelector(
      'button.vv-btn-secondary'
    ) as HTMLButtonElement;
    cancelButton.click();
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
  });

  it('should disable save when name is empty', () => {
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      'button.vv-btn-primary'
    ) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should enable save when name is set (color always has default)', () => {
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'Test';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      'button.vv-btn-primary'
    ) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
  });

  it('should not emit saved when name is whitespace only', () => {
    fixture.detectChanges();

    const emitted: { name: string; color: string }[] = [];
    component.saved.subscribe((v) => emitted.push(v));

    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    component.onSave();

    expect(emitted.length).toBe(0);
  });

  it('should show preset color swatches + 1 custom pill', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const swatchContainer = getSwatchContainer(fixture);
    expect(swatchContainer).toBeTruthy();
    const buttons = swatchContainer.querySelectorAll('button');
    // 9 preset swatches + 1 custom pill = 10
    expect(buttons.length).toBe(FOLDER_COLORS.length + 1);
  });

  it('should clicking a swatch selects it with ring highlight', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const swatchContainer = getSwatchContainer(fixture);
    const swatchButtons = swatchContainer.querySelectorAll('button');
    const secondSwatch = swatchButtons[1] as HTMLButtonElement;

    secondSwatch.click();
    fixture.detectChanges();

    // The selected swatch should have ring-2 class applied
    expect(secondSwatch.className).toContain('ring-2');
  });

  it('should clicking custom pill shows hue slider', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    // Initially no slider visible
    let slider = fixture.nativeElement.querySelector('.hue-slider');
    expect(slider).toBeFalsy();

    // Click the custom pill (last button in swatch row)
    const swatchContainer = getSwatchContainer(fixture);
    const buttons = swatchContainer.querySelectorAll('button');
    const customPill = buttons[buttons.length - 1] as HTMLButtonElement;
    customPill.click();
    fixture.detectChanges();

    // Slider should now be visible
    slider = fixture.nativeElement.querySelector('.hue-slider');
    expect(slider).toBeTruthy();
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('360');
  });

  it('should clicking a preset after custom mode hides slider', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    // Enter custom mode
    const swatchContainer = getSwatchContainer(fixture);
    const buttons = swatchContainer.querySelectorAll('button');
    const customPill = buttons[buttons.length - 1] as HTMLButtonElement;
    customPill.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.hue-slider')).toBeTruthy();

    // Click a preset swatch
    const firstSwatch = buttons[0] as HTMLButtonElement;
    firstSwatch.click();
    fixture.detectChanges();

    // Slider should be hidden
    expect(fixture.nativeElement.querySelector('.hue-slider')).toBeFalsy();
  });

  it('should emit selected preset color on save', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: { name: string; color: string }[] = [];
    component.saved.subscribe((v) => emitted.push(v));

    // Enter name
    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'Test';
    input.dispatchEvent(new Event('input'));

    // Select 3rd preset
    const swatchContainer = getSwatchContainer(fixture);
    const swatchButtons = swatchContainer.querySelectorAll('button');
    (swatchButtons[2] as HTMLButtonElement).click();
    fixture.detectChanges();

    component.onSave();

    expect(emitted.length).toBe(1);
    expect(emitted[0].color).toBe(FOLDER_COLORS[2]);
  });

  it('should emit custom hue color on save when slider used', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: { name: string; color: string }[] = [];
    component.saved.subscribe((v) => emitted.push(v));

    // Enter name
    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'Custom';
    input.dispatchEvent(new Event('input'));

    // Open custom slider
    const swatchContainer = getSwatchContainer(fixture);
    const buttons = swatchContainer.querySelectorAll('button');
    (buttons[buttons.length - 1] as HTMLButtonElement).click();
    fixture.detectChanges();

    // Change hue
    const slider = fixture.nativeElement.querySelector('.hue-slider') as HTMLInputElement;
    slider.value = '120';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    component.onSave();

    expect(emitted.length).toBe(1);
    // Color should be a hex value derived from hue 120
    expect(emitted[0].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    // Should NOT be one of the default preset colors
    expect(emitted[0].color).not.toBe(FOLDER_COLORS[0]);
  });

  it('should respect defaultColor input when it is a preset', () => {
    const targetColor = FOLDER_COLORS[5];
    fixture.componentRef.setInput('defaultColor', targetColor);
    fixture.detectChanges();

    const emitted: { name: string; color: string }[] = [];
    component.saved.subscribe((v) => emitted.push(v));

    // Enter name and save
    const input = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'Default';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    component.onSave();

    expect(emitted.length).toBe(1);
    expect(emitted[0].color).toBe(targetColor);
  });

  it('should have #nameInput template ref on name input and focus it programmatically', async () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus');
    fixture.detectChanges();
    await fixture.whenStable();

    const nameInput = fixture.nativeElement.querySelector('input[type="text"]') as HTMLInputElement;
    expect(nameInput).toBeTruthy();
    // autofocus attribute was removed; focus is applied via afterNextRender
    expect(nameInput.hasAttribute('autofocus')).toBe(false);
    // The programmatic focus should have been called
    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it('should show custom pill with palette icon', () => {
    fixture.detectChanges();

    const paletteIcon = fixture.nativeElement.querySelector('.pi-palette');
    expect(paletteIcon).toBeTruthy();
  });
});
