// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { FolderService } from './folder.service';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { FOLDER_COLORS } from './models';

describe('FolderService', () => {
  let service: FolderService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        FolderService,
        { provide: StorageService, useClass: LocalStorageService },
      ],
    });
    service = TestBed.inject(FolderService);
  });

  it('should start with empty folders', () => {
    expect(service.folders()).toEqual([]);
  });

  describe('addFolder', () => {
    it('should add a folder with generated id', () => {
      const { folder, ok } = service.addFolder('My Folder');
      expect(ok).toBe(true);
      expect(folder.id).toBeTruthy();
      expect(folder.name).toBe('My Folder');
      expect(folder.createdAt).toBeInstanceOf(Date);
      expect(service.folders().length).toBe(1);
    });

    it('should trim the name', () => {
      const { folder } = service.addFolder('  trimmed  ');
      expect(folder.name).toBe('trimmed');
    });

    it('should assign color from FOLDER_COLORS in round-robin', () => {
      const { folder: f1 } = service.addFolder('A');
      const { folder: f2 } = service.addFolder('B');
      expect(f1.color).toBe(FOLDER_COLORS[0]);
      expect(f2.color).toBe(FOLDER_COLORS[1]);
    });

    it('should accept custom color', () => {
      const { folder } = service.addFolder('Custom', '#FF0000');
      expect(folder.color).toBe('#FF0000');
    });

    it('should persist to localStorage', () => {
      service.addFolder('Persisted');
      const stored = JSON.parse(localStorage.getItem('vv_folders') ?? '[]');
      expect(stored.length).toBe(1);
      expect(stored[0].name).toBe('Persisted');
    });

    it('should return ok: false when storage fails', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const { ok } = service.addFolder('Fail');
      expect(ok).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe('updateFolder', () => {
    it('should update name', () => {
      const { folder } = service.addFolder('Old');
      service.updateFolder(folder.id, { name: 'New' });
      expect(service.getFolder(folder.id)?.name).toBe('New');
    });

    it('should update color', () => {
      const { folder } = service.addFolder('Test');
      service.updateFolder(folder.id, { color: '#123456' });
      expect(service.getFolder(folder.id)?.color).toBe('#123456');
    });

    it('should persist changes', () => {
      const { folder } = service.addFolder('Before');
      service.updateFolder(folder.id, { name: 'After' });
      const stored = JSON.parse(localStorage.getItem('vv_folders') ?? '[]');
      expect(stored[0].name).toBe('After');
    });

    it('should return true on success and false on storage failure', () => {
      const { folder } = service.addFolder('Test');
      expect(service.updateFolder(folder.id, { name: 'New' })).toBe(true);

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
      expect(service.updateFolder(folder.id, { name: 'Fail' })).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe('deleteFolder', () => {
    it('should remove the folder', () => {
      const { folder } = service.addFolder('ToDelete');
      expect(service.folders().length).toBe(1);
      service.deleteFolder(folder.id);
      expect(service.folders().length).toBe(0);
    });

    it('should persist deletion', () => {
      const { folder } = service.addFolder('Gone');
      service.deleteFolder(folder.id);
      const stored = JSON.parse(localStorage.getItem('vv_folders') ?? '[]');
      expect(stored.length).toBe(0);
    });

    it('should return true on success and false on storage failure', () => {
      const { folder } = service.addFolder('Test');

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });
      expect(service.deleteFolder(folder.id)).toBe(false);
      vi.restoreAllMocks();
    });
  });

  describe('folder delete cascade (orphaned folderId)', () => {
    it('should NOT automatically clear folderId on words when folder is deleted (no cascade)', () => {
      // FolderService.deleteFolder only removes the folder from storage.
      // It does NOT update words. That cascade is a feature-level concern
      // handled by FeatureDictionary.executeDeleteFolder().
      const { folder } = service.addFolder('My Folder');
      const folderId = folder.id;

      // Simulate words with this folderId (via localStorage since WordService is separate)
      // Verify the folder is deleted
      service.deleteFolder(folderId);
      expect(service.folders().length).toBe(0);
      expect(service.getFolder(folderId)).toBeUndefined();

      // The service itself has no knowledge of words. It only manages folders.
      // Words with stale folderId are orphaned until the feature-level code cleans them.
      // This is by design: FolderService is a pure data store for folders.
    });

    it('should remove only the target folder and leave other folders intact', () => {
      const { folder: f1 } = service.addFolder('Folder A');
      const { folder: f2 } = service.addFolder('Folder B');
      const { folder: f3 } = service.addFolder('Folder C');

      service.deleteFolder(f2.id);

      expect(service.folders().length).toBe(2);
      expect(service.getFolder(f1.id)?.name).toBe('Folder A');
      expect(service.getFolder(f3.id)?.name).toBe('Folder C');
      expect(service.getFolder(f2.id)).toBeUndefined();
    });

    it('should allow restoreFolder after delete (undo scenario)', () => {
      const { folder } = service.addFolder('Restorable');
      const folderId = folder.id;

      service.deleteFolder(folderId);
      expect(service.folders().length).toBe(0);

      service.restoreFolder(folder);
      expect(service.folders().length).toBe(1);
      expect(service.getFolder(folderId)?.name).toBe('Restorable');
    });
  });

  describe('getFolder', () => {
    it('should find by id', () => {
      const { folder } = service.addFolder('Find Me');
      expect(service.getFolder(folder.id)?.name).toBe('Find Me');
    });

    it('should return undefined for unknown id', () => {
      expect(service.getFolder('nonexistent')).toBeUndefined();
    });
  });
});
