import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { DataExportService, VocaVaultExport } from './data-export.service';
import { WordService } from './word.service';
import { FolderService } from './folder.service';
import { MasteryLevel } from './models';

vi.mock('@vocavault/util', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vocavault/util')>()),
  downloadBlob: vi.fn(),
}));

import { downloadBlob } from '@vocavault/util';

describe('DataExportService', () => {
  let service: DataExportService;
  let wordService: WordService;
  let folderService: FolderService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageService, useClass: LocalStorageService },
      ],
    });
    service = TestBed.inject(DataExportService);
    wordService = TestBed.inject(WordService);
    folderService = TestBed.inject(FolderService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportAll', () => {
    it('should create JSON blob with correct filename pattern', () => {
      service.exportAll();

      expect(downloadBlob).toHaveBeenCalledOnce();
      const [blob, filename] = (downloadBlob as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(filename).toMatch(/^vocavault-backup-\d{4}-\d{2}-\d{2}\.json$/);
      expect(blob).toBeInstanceOf(Blob);
    });

    it('should include words, folders, quizSets, quizResults in export data', async () => {
      wordService.addWord({ word: 'exportword', pronunciation: '', definition: 'a test', examples: [] });
      folderService.addFolder('ExportFolder');

      service.exportAll();

      const [blob] = (downloadBlob as ReturnType<typeof vi.fn>).mock.calls[0];
      const text = await blob.text();
      const data: VocaVaultExport = JSON.parse(text);

      expect(data.version).toBe(1);
      expect(data.exportedAt).toBeTruthy();
      expect(data.words.length).toBeGreaterThanOrEqual(1);
      expect(data.words.some((w: { word: string }) => w.word === 'exportword')).toBe(true);
      expect(data.folders.some((f: { name: string }) => f.name === 'ExportFolder')).toBe(true);
      expect(Array.isArray(data.quizSets)).toBe(true);
      expect(Array.isArray(data.quizResults)).toBe(true);
    });
  });

  describe('importFromFile - valid imports', () => {
    it('should restore words not already in storage and return counts', async () => {
      const exportData: VocaVaultExport = {
        version: 1,
        exportedAt: new Date().toISOString(),
        words: [
          createWord('w1', 'apple'),
          createWord('w2', 'banana'),
        ],
        folders: [],
        quizSets: [],
        quizResults: [],
      };
      const file = createJsonFile(exportData);

      const result = await service.importFromFile(file);

      expect(result.words).toBe(2);
      expect(result.folders).toBe(0);
      expect(wordService.words()).toHaveLength(2);
    });

    it('should deduplicate -- existing word IDs are skipped', async () => {
      wordService.addWord({ word: 'existing', pronunciation: '', definition: 'def', examples: [] });
      const existingId = wordService.words()[0].id;

      const exportData: VocaVaultExport = {
        version: 1,
        exportedAt: new Date().toISOString(),
        words: [
          createWord(existingId, 'existing'),
          createWord('new-id', 'newword'),
        ],
        folders: [],
        quizSets: [],
        quizResults: [],
      };
      const file = createJsonFile(exportData);

      const result = await service.importFromFile(file);

      expect(result.words).toBe(1);
      expect(wordService.words()).toHaveLength(2);
    });

    it('should handle empty arrays and return all zero counts', async () => {
      const exportData: VocaVaultExport = {
        version: 1,
        exportedAt: new Date().toISOString(),
        words: [],
        folders: [],
        quizSets: [],
        quizResults: [],
      };
      const file = createJsonFile(exportData);

      const result = await service.importFromFile(file);

      expect(result.words).toBe(0);
      expect(result.folders).toBe(0);
      expect(result.quizSets).toBe(0);
      expect(result.quizResults).toBe(0);
    });

    it('should handle partial data -- only words key present, others missing', async () => {
      const partialData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        words: [createWord('p1', 'partial')],
      };
      const file = createJsonFile(partialData);

      const result = await service.importFromFile(file);

      expect(result.words).toBe(1);
      expect(result.folders).toBe(0);
      expect(result.quizSets).toBe(0);
      expect(result.quizResults).toBe(0);
    });

    it('should restore folders and quizSets correctly', async () => {
      const exportData: VocaVaultExport = {
        version: 1,
        exportedAt: new Date().toISOString(),
        words: [],
        folders: [{ id: 'f1', name: 'Imported', color: '#3A7CA5', createdAt: new Date() }],
        quizSets: [{ id: 'qs1', name: 'Quiz1', description: '', wordIds: [], createdAt: new Date(), updatedAt: new Date() }],
        quizResults: [{ id: 'r1', quizSetId: 'qs1', score: 5, totalQuestions: 5, accuracy: 100, wordResults: [], completedAt: new Date() }],
      };
      const file = createJsonFile(exportData);

      const result = await service.importFromFile(file);

      expect(result.folders).toBe(1);
      expect(result.quizSets).toBe(1);
      expect(result.quizResults).toBe(1);
    });
  });

  describe('importFromFile - error handling', () => {
    it('should reject malformed JSON with descriptive error', async () => {
      const file = new File(['not valid json {{{'], 'bad.json', { type: 'application/json' });

      await expect(service.importFromFile(file)).rejects.toThrow('Invalid backup file: could not parse JSON');
    });

    it('should reject version:2 with "Unsupported export version"', async () => {
      const file = createJsonFile({ version: 2, exportedAt: '', words: [], folders: [], quizSets: [], quizResults: [] });

      await expect(service.importFromFile(file)).rejects.toThrow('Unsupported export version');
    });

    it('should reject null data with "Unsupported export version"', async () => {
      const file = new File([JSON.stringify(null)], 'null.json', { type: 'application/json' });

      await expect(service.importFromFile(file)).rejects.toThrow('Unsupported export version');
    });

    it('should reject wrong file type (non-JSON text) with malformed JSON error', async () => {
      const file = new File(['Hello World plain text'], 'readme.txt', { type: 'text/plain' });

      await expect(service.importFromFile(file)).rejects.toThrow('Invalid backup file: could not parse JSON');
    });

    it('should reject undefined data with "Unsupported export version"', async () => {
      const file = new File([JSON.stringify(undefined)], 'undef.json', { type: 'application/json' });

      await expect(service.importFromFile(file)).rejects.toThrow('Invalid backup file: could not parse JSON');
    });
  });
});

function createWord(id: string, word: string) {
  return {
    id,
    word,
    pronunciation: '',
    definition: `definition of ${word}`,
    examples: [],
    masteryLevel: MasteryLevel.New,
    createdAt: new Date(),
    updatedAt: new Date(),
    interval: 0,
    easeFactor: 2.5,
    reviewCount: 0,
  };
}

function createJsonFile(data: unknown): File {
  return new File([JSON.stringify(data)], 'backup.json', { type: 'application/json' });
}
