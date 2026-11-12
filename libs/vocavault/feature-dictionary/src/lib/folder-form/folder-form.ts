import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Folder, FOLDER_COLORS } from '@vocavault/data-access';
import { Button, ColorPicker } from '@vocavault/ui';

@Component({
  selector: 'lib-folder-form',
  imports: [Button, ColorPicker],
  templateUrl: './folder-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolderForm {
  readonly folder = input<Folder | undefined>(undefined);
  readonly defaultColor = input<string | undefined>(undefined);

  readonly saved = output<{ name: string; color: string }>();
  readonly cancelled = output<void>();

  protected readonly name = signal('');
  protected readonly selectedColor = signal<string>(FOLDER_COLORS[0]);

  private readonly nameInput = viewChild<ElementRef>('nameInput');

  private readonly syncEffect = effect(() => {
    const f = this.folder();
    if (f) {
      this.name.set(f.name);
      this.selectedColor.set(f.color);
    } else {
      this.name.set('');
      const dc = this.defaultColor();
      if (dc) {
        this.selectedColor.set(dc);
      } else {
        this.selectedColor.set(FOLDER_COLORS[0]);
      }
    }
  });

  constructor() {
    afterNextRender(() => {
      this.nameInput()?.nativeElement?.focus();
    });
  }

  protected get canSave(): boolean {
    return !!this.name().trim();
  }

  protected onColorChange(color: string): void {
    this.selectedColor.set(color);
  }

  onSave(): void {
    const n = this.name().trim();
    if (!n) return;
    this.saved.emit({ name: n, color: this.selectedColor() });
  }
}
