import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ProgressService,
  WordService,
  SpacedRepetitionService,
  MasteryLevel,
  MASTERY_CONFIG,
  Word,
} from '@vocavault/data-access';
import { CircularProgress, EmptyState, InfoButton, InfoDrawer } from '@vocavault/ui';
import { animatedValue } from '@vocavault/util';

@Component({
  selector: 'lib-feature-progress',
  imports: [CircularProgress, EmptyState, InfoButton, InfoDrawer, RouterLink],
  templateUrl: './feature-progress.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureProgress {
  private readonly progressService = inject(ProgressService);
  private readonly wordService = inject(WordService);
  private readonly srService = inject(SpacedRepetitionService);

  protected readonly activeInfoDrawer = signal<'mastery-levels' | 'eloquence' | 'stats' | null>(null);

  protected readonly eloquenceScore = this.progressService.eloquenceScore;
  protected readonly animatedScore = animatedValue(this.eloquenceScore);
  protected readonly wordsLearned = this.progressService.wordsLearned;
  protected readonly masteryDistribution = this.progressService.masteryDistribution;

  protected readonly totalWords = computed(
    () => this.wordService.words().length
  );

  protected readonly flaggedCount = computed(() =>
    this.wordService.flaggedWords().length
  );

  protected readonly accuracy = computed(() => {
    const rs = this.progressService.results();
    if (rs.length === 0) return 0;
    return Math.round(
      rs.reduce((s, r) => s + r.accuracy, 0) / rs.length
    );
  });

  protected readonly quizzesTaken = computed(
    () => this.progressService.results().length
  );

  protected readonly streak = this.progressService.streak;
  protected readonly wordsThisWeek = this.progressService.wordsThisWeek;
  protected readonly quizzesThisWeek = this.progressService.quizzesThisWeek;
  protected readonly weekOverWeek = this.progressService.weekOverWeek;

  protected readonly dueCount = computed(() =>
    this.srService.getDueCount(this.wordService.quizzableWords())
  );

  protected readonly dueTomorrow = computed(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return this.wordService.quizzableWords().filter((w) => {
      if (!w.nextReviewDate) return false;
      const d = new Date(w.nextReviewDate);
      return d > today && d <= tomorrow;
    }).length;
  });

  protected readonly dueThisWeek = computed(() => {
    const now = new Date();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const tomorrowEnd = new Date();
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date();
    weekEnd.setDate(now.getDate() + (7 - now.getDay()));
    weekEnd.setHours(23, 59, 59, 999);
    // Only count words due between day-after-tomorrow and end of week (excludes Due Now and Tomorrow)
    return this.wordService.quizzableWords().filter((w) => {
      if (!w.nextReviewDate) return false;
      const d = new Date(w.nextReviewDate);
      return d > tomorrowEnd && d <= weekEnd;
    }).length;
  });

  protected readonly masteryRows = computed(() => {
    const d = this.masteryDistribution();
    return [
      { label: MASTERY_CONFIG[MasteryLevel.New].label,      count: d[MasteryLevel.New],      color: MASTERY_CONFIG[MasteryLevel.New].color },
      { label: MASTERY_CONFIG[MasteryLevel.Learning].label, count: d[MasteryLevel.Learning], color: MASTERY_CONFIG[MasteryLevel.Learning].color },
      { label: MASTERY_CONFIG[MasteryLevel.Review].label,   count: d[MasteryLevel.Review],   color: MASTERY_CONFIG[MasteryLevel.Review].color },
      { label: MASTERY_CONFIG[MasteryLevel.Mastered].label, count: d[MasteryLevel.Mastered], color: MASTERY_CONFIG[MasteryLevel.Mastered].color },
    ];
  });

  protected readonly masteryExpanded = signal(true);
  protected readonly expandedLevel = signal<string | null>(null);

  protected toggleLevel(label: string): void {
    this.expandedLevel.update((current) => (current === label ? null : label));
  }

  protected readonly wordsByLevel = computed(() => {
    const words = this.wordService.words();
    const map: Record<string, Word[]> = {
      New: words.filter((w) => w.masteryLevel === MasteryLevel.New),
      Learning: words.filter((w) => w.masteryLevel === MasteryLevel.Learning),
      Review: words.filter((w) => w.masteryLevel === MasteryLevel.Review),
      Mastered: words.filter((w) => w.masteryLevel === MasteryLevel.Mastered),
    };
    return map;
  });

  protected readonly masteryBarSegments = computed(() => {
    const rows = this.masteryRows();
    const total = this.totalWords();
    if (total === 0) return rows.map(r => ({ ...r, pct: 25 }));
    return rows.map(r => ({ ...r, pct: (r.count / total) * 100 }));
  });

  protected formatChange(value: number): string {
    if (value > 0) return `+${value}`;
    return `${value}`;
  }
}
