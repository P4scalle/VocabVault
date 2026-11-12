import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { hexToHue, hslToHex, PRESET_COLORS } from '@vocavault/util';

@Component({
  selector: 'lib-color-picker',
  imports: [],
  templateUrl: './color-picker.html',
  styleUrl: './color-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorPicker {
  readonly color = input<string>(PRESET_COLORS[0]);
  readonly presetColors = input<readonly string[]>(PRESET_COLORS);

  readonly colorChange = output<string>();

  protected readonly selectedColor = signal<string>(PRESET_COLORS[0]);
  protected readonly hue = signal(200);
  protected readonly showCustomSlider = signal(false);

  private readonly syncEffect = effect(() => {
    const c = this.color();
    const presets = this.presetColors() as readonly string[];
    if (presets.includes(c)) {
      this.selectedColor.set(c);
      this.showCustomSlider.set(false);
    } else if (c) {
      this.selectedColor.set(c);
      this.hue.set(hexToHue(c));
      this.showCustomSlider.set(true);
    }
  });

  protected selectPreset(color: string): void {
    this.selectedColor.set(color);
    this.showCustomSlider.set(false);
    this.colorChange.emit(color);
  }

  protected toggleCustomSlider(): void {
    const entering = !this.showCustomSlider();
    this.showCustomSlider.set(entering);
    if (entering) {
      this.hue.set(hexToHue(this.selectedColor()));
    }
  }

  protected onHueChange(value: number): void {
    this.hue.set(value);
    const hex = hslToHex(value);
    this.selectedColor.set(hex);
    this.colorChange.emit(hex);
  }
}
