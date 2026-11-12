import { Injectable, inject } from '@angular/core';
import { WordService } from './word.service';
import { FolderService } from './folder.service';
import { QuizService } from './quiz.service';
import { ProgressService } from './progress.service';
import { Word, Folder, QuizSet, QuizResult } from './models';
import { downloadBlob } from '@vocavault/util';

export interface VocaVaultExport {
  version: 1;
  exportedAt: string;
  words: Word[];
  folders: Folder[];
  quizSets: QuizSet[];
  quizResults: QuizResult[];
}

@Injectable({ providedIn: 'root' })
export class DataExportService {
  private readonly wordService = inject(WordService);
  private readonly folderService = inject(FolderService);
  private readonly quizService = inject(QuizService);
  private readonly progressService = inject(ProgressService);

  exportAll(): void {
    const data: VocaVaultExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      words: this.wordService.words(),
      folders: this.folderService.folders(),
      quizSets: this.quizService.quizSets(),
      quizResults: this.progressService.results(),
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `vocavault-backup-${date}.json`);
  }

  async importFromFile(file: File): Promise<{ words: number; folders: number; quizSets: number; quizResults: number }> {
    const text = await file.text();

    let data: VocaVaultExport;
    try {
      data = JSON.parse(text) as VocaVaultExport;
    } catch {
      throw new Error('Invalid backup file: could not parse JSON');
    }

    if (!data || data.version !== 1) throw new Error('Unsupported export version');

    let wordCount = 0;
    let folderCount = 0;
    let quizSetCount = 0;
    let resultCount = 0;

    const existingWordIds = new Set(this.wordService.words().map((w) => w.id));
    const existingFolderIds = new Set(this.folderService.folders().map((f) => f.id));
    const existingQuizIds = new Set(this.quizService.quizSets().map((q) => q.id));
    const existingResultIds = new Set(this.progressService.results().map((r) => r.id));

    for (const folder of data.folders ?? []) {
      if (!existingFolderIds.has(folder.id)) {
        this.folderService.restoreFolder(folder);
        folderCount++;
      }
    }

    for (const word of data.words ?? []) {
      if (!existingWordIds.has(word.id)) {
        this.wordService.restoreWord(word);
        wordCount++;
      }
    }

    for (const qs of data.quizSets ?? []) {
      if (!existingQuizIds.has(qs.id)) {
        this.quizService.restoreQuizSet(qs);
        quizSetCount++;
      }
    }

    for (const result of data.quizResults ?? []) {
      if (!existingResultIds.has(result.id)) {
        this.progressService.restoreResult(result);
        resultCount++;
      }
    }

    return { words: wordCount, folders: folderCount, quizSets: quizSetCount, quizResults: resultCount };
  }
}
