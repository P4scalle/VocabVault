import { computed, Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { Folder, FOLDER_COLORS } from './models';
import { persistedSignal } from './persisted-signal';
import { WordService } from './word.service';

const FOLDERS_KEY = 'vv_folders';

@Injectable({ providedIn: 'root' })
export class FolderService {
  private readonly storage = inject(StorageService);
  private readonly wordService = inject(WordService);
  private readonly _store = persistedSignal<Folder[]>(this.storage, FOLDERS_KEY, []);

  readonly folders = this._store.value;

  /** Word count per folder, derived from WordService, single source of truth. */
  readonly folderWordCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const w of this.wordService.words()) {
      if (w.folderId) {
        counts.set(w.folderId, (counts.get(w.folderId) ?? 0) + 1);
      }
    }
    return counts;
  });

  addFolder(name: string, color?: string): { folder: Folder; ok: boolean } {
    const folder: Folder = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color: color ?? FOLDER_COLORS[this._store.value().length % FOLDER_COLORS.length],
      createdAt: new Date(),
    };
    const ok = this._store.update((fs) => [...fs, folder]);
    return { folder, ok };
  }

  updateFolder(id: string, changes: Partial<Pick<Folder, 'name' | 'color'>>): boolean {
    return this._store.update((fs) =>
      fs.map((f) => (f.id === id ? { ...f, ...changes } : f)),
    );
  }

  deleteFolder(id: string): boolean {
    return this._store.update((fs) => fs.filter((f) => f.id !== id));
  }

  /** Re-insert a previously deleted folder (for undo). */
  restoreFolder(folder: Folder): boolean {
    return this._store.update((fs) => [...fs, folder]);
  }

  getFolder(id: string): Folder | undefined {
    return this._store.value().find((f) => f.id === id);
  }
}
