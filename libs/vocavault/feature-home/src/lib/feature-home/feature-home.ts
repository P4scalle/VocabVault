import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MasteryLevel, MASTERY_CONFIG, ProgressService, SpacedRepetitionService, WordService, QuizService } from '@vocavault/data-access';
import { Button, Carousel, CarouselSlide, InfoButton, InfoDrawer, ProgressBubble, ScoreRing } from '@vocavault/ui';
import { OnboardingService } from '@vocavault/util';

interface QuizTypeCard {
  label: string;
  iconClass: string;
  mode: string;
  colorClass: string;
}

interface ProgressCircleData {
  label: string;
  count: number;
  color: string;
  pct: number;
}

@Component({
  selector: 'lib-feature-home',
  imports: [Button, Carousel, CarouselSlide, InfoButton, InfoDrawer, ProgressBubble, ScoreRing],
  templateUrl: './feature-home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureHome {
  private readonly wordService = inject(WordService);
  private readonly progressService = inject(ProgressService);
  private readonly srService = inject(SpacedRepetitionService);
  private readonly quizService = inject(QuizService);
  protected readonly router = inject(Router);

  protected readonly onboarding = inject(OnboardingService);

  protected readonly wordCount = computed(() => this.wordService.words().length);
  protected readonly hasWords = computed(() => this.wordCount() > 0);

  protected readonly recentWords = computed(() =>
    [...this.wordService.words()]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 5)
  );

  protected readonly eloquenceScore = this.progressService.eloquenceScore;

  protected readonly masteryDistribution = this.progressService.masteryDistribution;

  protected readonly progressCircles = computed((): ProgressCircleData[] => {
    const d = this.masteryDistribution();
    const total = Object.values(d).reduce((s, n) => s + n, 0);
    return [
      { label: MASTERY_CONFIG[MasteryLevel.Learning].label, count: d[MasteryLevel.Learning], color: MASTERY_CONFIG[MasteryLevel.Learning].color, pct: total > 0 ? (d[MasteryLevel.Learning] / total) * 100 : 25 },
      { label: MASTERY_CONFIG[MasteryLevel.Review].label, count: d[MasteryLevel.Review], color: MASTERY_CONFIG[MasteryLevel.Review].color, pct: total > 0 ? (d[MasteryLevel.Review] / total) * 100 : 80 },
      { label: MASTERY_CONFIG[MasteryLevel.Mastered].label, count: d[MasteryLevel.Mastered], color: MASTERY_CONFIG[MasteryLevel.Mastered].color, pct: total > 0 ? (d[MasteryLevel.Mastered] / total) * 100 : 80 },
      { label: MASTERY_CONFIG[MasteryLevel.New].label, count: d[MasteryLevel.New], color: MASTERY_CONFIG[MasteryLevel.New].color, pct: total > 0 ? (d[MasteryLevel.New] / total) * 100 : 38 },
    ];
  });

  protected readonly quizTypes: QuizTypeCard[] = [
    { label: 'Flashcard', iconClass: 'pi pi-clone', mode: 'flashcard', colorClass: 'bg-violet-100 text-violet-700' },
    { label: 'Multiple Choice', iconClass: 'pi pi-list-check', mode: 'multiple-choice', colorClass: 'bg-blue-100 text-blue-700' },
    { label: 'Write', iconClass: 'pi pi-pencil', mode: 'type', colorClass: 'bg-amber-100 text-amber-700' },
    { label: 'Match', iconClass: 'pi pi-arrow-right-arrow-left', mode: 'match', colorClass: 'bg-emerald-100 text-emerald-700' },
  ];

  protected readonly activeInfoDrawer = signal<'quiz-types' | 'eloquence' | 'due-review' | 'tough-ones' | null>(null);

  protected readonly dueCount = computed(() =>
    this.srService.getDueCount(this.wordService.quizzableWords())
  );

  protected readonly toughCount = computed(() => this.wordService.toughWords().length);

  protected startToughPractice(): void {
    const { quizSet, mode, direction } = this.quizService.startToughPractice();
    void this.router.navigate(['/quiz', quizSet.id, 'play'], {
      queryParams: { mode, direction },
    });
  }

  protected startSmartReview(): void {
    void this.router.navigate(['/quiz', 'smart-review']);
  }

  protected navigateToQuiz(): void {
    void this.router.navigate(['/quiz']);
  }

  protected navigateToCreateQuiz(): void {
    void this.router.navigate(['/quiz', 'create']);
  }

  protected navigateToQuizLaunch(mode: string): void {
    void this.router.navigate(['/quiz', 'launch'], { queryParams: { mode } });
  }

  protected startQuickQuiz(): void {
    const { quizSet, mode, direction } = this.quizService.startQuickQuiz();
    void this.router.navigate(['/quiz', quizSet.id, 'play'], {
      queryParams: { mode, direction },
    });
  }

  protected navigateToDictionary(wordId?: string): void {
    void this.router.navigate(['/dictionary'], wordId ? { queryParams: { wordId } } : undefined);
  }

  protected navigateToAddWord(): void {
    void this.router.navigate(['/dictionary'], { queryParams: { addWord: true } });
  }

  protected navigateToProgress(): void {
    void this.router.navigate(['/progress']);
  }
}
