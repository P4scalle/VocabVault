import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, Router } from '@angular/router';
import {
  FolderService,
  ProgressService,
  QuizService,
  QuizSet,
  QuizSetSource,
  SpacedRepetitionService,
  WordService,
} from '@vocavault/data-access';
import { EmptyState, InfoButton, InfoDrawer, ToastService } from '@vocavault/ui';
import { OnboardingService, wordStartsWith } from '@vocavault/util';
import { QuizSetCard } from '../quiz-set-card/quiz-set-card';

type QuizFilter = 'all' | QuizSetSource;

interface FilterPill {
  value: QuizFilter;
  label: string;
  icon?: string;
  count: number;
}

@Component({
  selector: 'lib-feature-quiz',
  imports: [
    RouterOutlet,
    FormsModule,
    QuizSetCard,
    EmptyState,
    InfoButton,
    InfoDrawer,
  ],
  templateUrl: './feature-quiz.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureQuiz {
  private readonly quizService = inject(QuizService);
  private readonly wordService = inject(WordService);
  private readonly folderService = inject(FolderService);
  private readonly progressService = inject(ProgressService);
  private readonly srService = inject(SpacedRepetitionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly onboarding = inject(OnboardingService);

  /** Steer a first-run user into their first quiz by highlighting the card(s). */
  protected readonly showStartCue = computed(() => this.onboarding.currentStep() === 'start-quiz');

  protected readonly allQuizSets = this.quizService.quizSets;
  protected readonly infoTopic = signal<string | null>(null);
  protected readonly toughCount = computed(() => this.wordService.toughWords().length);
  protected readonly activeFilter = signal<QuizFilter>('all');
  protected readonly searchQuery = signal('');
  protected readonly activeSort = signal<string>('recent');
  protected readonly folderFilter = signal<string>('');
  protected readonly folders = this.folderService.folders;

  protected readonly sortOptions = [
    { label: 'Last Played', value: 'recent' },
    { label: 'Accuracy (low first)', value: 'accuracy' },
    { label: 'Due Words', value: 'due' },
    { label: 'Newest', value: 'newest' },
    { label: 'A-Z', value: 'alpha' },
  ];

  // Single pass: compute counts + filtered list + pills together
  private readonly filterState = computed(() => {
    const all = this.allQuizSets();
    let importCount = 0;
    let manualCount = 0;
    const imported: QuizSet[] = [];
    const manual: QuizSet[] = [];

    for (const qs of all) {
      if (qs.source === 'import') {
        importCount++;
        imported.push(qs);
      } else {
        manualCount++;
        manual.push(qs);
      }
    }

    return { importCount, manualCount, imported, manual };
  });

  protected readonly pills = computed((): FilterPill[] => {
    const { importCount, manualCount } = this.filterState();
    if (importCount === 0 || manualCount === 0) return [];
    return [
      { value: 'all', label: 'All', count: importCount + manualCount },
      { value: 'import', label: 'Imported', icon: 'pi pi-upload', count: importCount },
      { value: 'manual', label: 'Custom', icon: 'pi pi-pencil', count: manualCount },
    ];
  });

  protected readonly displayedQuizSets = computed(() => {
    // 1. Source filter (import/manual/all)
    const filter = this.activeFilter();
    const { imported, manual } = this.filterState();
    let result: QuizSet[];
    if (filter === 'import') result = imported;
    else if (filter === 'manual') result = manual;
    else result = this.allQuizSets();

    // 2. Folder filter
    const folderId = this.folderFilter();
    if (folderId) {
      const folderWordIds = new Set(
        this.wordService.words().filter((w) => w.folderId === folderId).map((w) => w.id),
      );
      result = result.filter((qs) => qs.wordIds.some((id) => folderWordIds.has(id)));
    }

    // 3. Search
    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      result = result.filter(
        (qs) => wordStartsWith(qs.name, q) || qs.name.toLowerCase().includes(q),
      );
    }

    // 4. Sort
    const sort = this.activeSort();
    result = [...result]; // copy before sort
    switch (sort) {
      case 'recent':
        result.sort((a, b) => {
          const aDate = this.progressService.getLatestResult(a.id)?.completedAt;
          const bDate = this.progressService.getLatestResult(b.id)?.completedAt;
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });
        break;
      case 'accuracy':
        result.sort((a, b) => {
          const aResult = this.progressService.getLatestResult(a.id);
          const bResult = this.progressService.getLatestResult(b.id);
          const aAcc = aResult?.accuracy ?? Infinity;
          const bAcc = bResult?.accuracy ?? Infinity;
          return aAcc - bAcc;
        });
        break;
      case 'due':
        result.sort((a, b) => {
          const aWords = this.quizService.getWordsForQuizSet(a.id);
          const bWords = this.quizService.getWordsForQuizSet(b.id);
          return this.srService.getDueCount(bWords) - this.srService.getDueCount(aWords);
        });
        break;
      case 'newest':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'alpha':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  });

  protected onSelectQuizSet(quizSet: QuizSet): void {
    void this.router.navigate(['/quiz', quizSet.id]);
  }

  protected onDeleteQuizSet(quizSet: QuizSet): void {
    if (this.quizService.deleteQuizSet(quizSet.id)) {
      this.toast.showWithAction(
        'Quiz set deleted',
        {
          label: 'Undo',
          callback: () => {
            this.quizService.restoreQuizSet(quizSet);
          },
        },
        'info',
      );
    } else {
      this.toast.show('Could not save. Storage may be full.', 'error');
    }
  }

  protected onCreateQuiz(): void {
    void this.router.navigate(['/quiz', 'create']);
  }

  protected startToughPractice(): void {
    const ids = this.wordService.toughWords().map((w) => w.id);
    this.quizService.createTempQuizSet(ids, 'The Tough Ones', '__tough-ones__');
    void this.router.navigate(['/quiz', '__tough-ones__', 'play'], {
      queryParams: { mode: 'flashcard', direction: 'definition-to-word' },
    });
  }
}
