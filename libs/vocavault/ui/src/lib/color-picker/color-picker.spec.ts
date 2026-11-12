import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { ColorPicker } from './color-picker';
import { PRESET_COLORS } from '@vocavault/util';

interface ColorPickerInternals {
  selectedColor: Signal<string>;
  showCustomSlider: Signal<boolean>;
}

describe('ColorPicker', () => {
  let fixture: ComponentFixture<ColorPicker>;
  let component: ColorPicker;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ColorPicker],
    }).compileComponents();
    fixture = TestBed.createComponent(ColorPicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render preset color swatches', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    // Preset buttons: one per preset color + one palette button
    const buttons = fixture.nativeElement.querySelectorAll('button[type="button"]') as NodeListOf<HTMLButtonElement>;
    // At least as many buttons as there are preset colors
    expect(buttons.length).toBeGreaterThanOrEqual(PRESET_COLORS.length);
  });

  it('should emit colorChange when preset clicked', async () => {
    const emitted: string[] = [];
    component.colorChange.subscribe((c: string) => emitted.push(c));
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = fixture.nativeElement.querySelectorAll('button[type="button"]') as NodeListOf<HTMLButtonElement>;
    // The first button is the first preset swatch
    buttons[0].click();
    expect(emitted.length).toBe(1);
    expect(emitted[0]).toBe(PRESET_COLORS[0]);
  });

  it('should show custom hue slider when palette button clicked', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    // Palette button is the last button in the row (after all presets)
    const paletteBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Pick custom color"]',
    );
    expect(paletteBtn).toBeTruthy();
    paletteBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const slider = fixture.nativeElement.querySelector('input[type="range"]');
    expect(slider).toBeTruthy();
  });

  it('should emit colorChange when hue slider changes', async () => {
    const emitted: string[] = [];
    component.colorChange.subscribe((c: string) => emitted.push(c));

    // Open the custom slider first
    const paletteBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Pick custom color"]',
    );
    paletteBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const slider: HTMLInputElement = fixture.nativeElement.querySelector('input[type="range"]');
    expect(slider).toBeTruthy();

    // Simulate hue slider change
    slider.value = '120';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    // Should emit a valid hex color
    expect(emitted[0]).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('should hide hue slider when preset selected after opening custom', async () => {
    // Open the custom slider
    const paletteBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[aria-label="Pick custom color"]',
    );
    paletteBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('input[type="range"]')).toBeTruthy();

    // Now click a preset
    const buttons = fixture.nativeElement.querySelectorAll('button[type="button"]') as NodeListOf<HTMLButtonElement>;
    buttons[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('input[type="range"]')).toBeFalsy();
  });

  it('should highlight the selected preset color', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    // The first preset button should have the highlighted ring class since PRESET_COLORS[0] is default
    const firstPresetBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      `button[type="button"][aria-label="Select color"]`,
    );
    expect(firstPresetBtn).toBeTruthy();
    // Selected state: has 'ring-2' class
    expect(firstPresetBtn.className).toContain('ring-2');
  });

  it('should accept color input and reflect it in selection', async () => {
    // Set a preset color as input, should match one of the preset buttons
    fixture.componentRef.setInput('color', PRESET_COLORS[2]);
    fixture.detectChanges();
    await fixture.whenStable();

    // The internal selectedColor should match
    const internals = component as unknown as ColorPickerInternals;
    expect(internals.selectedColor()).toBe(PRESET_COLORS[2]);
    // Custom slider should not be showing since it's a preset
    expect(internals.showCustomSlider()).toBe(false);
  });
});
