import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { Folder } from '@vocavault/data-access';
import { BottomSheet } from '@vocavault/ui';

@Component({
  selector: 'lib-folder-picker',
  imports: [BottomSheet],
  templateUrl: './folder-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolderPicker {
  readonly folders = input.required<Folder[]>();
  readonly folderWordCounts = input.required<Map<string, number>>();
  readonly visible = model<boolean>(false);
  readonly activeFolderId = input<string | null>(null);
  readonly title = input<string>('Move to folder');
  readonly noFolderLabel = input<string>('No folder');
  readonly folderSelected = output<string>();
  readonly createFolder = output<void>();

  onSelect(folderId: string): void {
    this.folderSelected.emit(folderId);
  }

  onCreateFolder(): void {
    this.visible.set(false);
    this.createFolder.emit();
  }
}
