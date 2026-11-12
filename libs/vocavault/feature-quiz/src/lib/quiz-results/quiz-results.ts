import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ChromeService, OnboardingService } from '@vocavault/util';
import {
  DEFAULT_QUIZ_DIRECTION,
  FlagReason,
  MasteryLevel,
  MASTERY_CONFIG,
  MASTERY_PROGRESSION,
  MASTERY_REGRESSION,
  ProgressService,
  QuizDirection,
  QuizMode,
  QUIZ_DIRECTION_LABELS,
  QUIZ_MODE_LABELS,
  QuizResultsState,
  QuizService,
  SpacedRepetitionService,
  Word,
  WordService,
} from '@vocavault/data-access';

import { Button, PageHeader, ScoreRing, ToastService } from '@vocavault/ui';

@Component({
  selector: 'lib-quiz-results',
  imports: [Button, PageHeader, ScoreRing],
  templateUrl: './quiz-results.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex-1 flex flex-col' },
})
export class QuizResults implements OnInit {
  protected readonly router = inject(Router);
  private readonly wordService = inject(WordService);
  private readonly quizService = inject(QuizService);
  private readonly progressService = inject(ProgressService);
  private readonly toast = inject(ToastService);
  private readonly srService = inject(SpacedRepetitionService);
  private readonly chrome = inject(ChromeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly onboarding = inject(OnboardingService);

  readonly id = input.required<string>();

  private readonly state: QuizResultsState | null = (() => {
    const s = window.history.state as Partial<QuizResultsState>;
    if (s && typeof s.score === 'number' && typeof s.totalQuestions === 'number') {
      return s as QuizResultsState;
    }
    return null;
  })();

  protected readonly score = signal(this.state?.score ?? 0);
  protected readonly totalQuestions = signal(this.state?.totalQuestions ?? 0);
  protected readonly correctAnswers = signal(this.state?.correctAnswers ?? 0);
  protected readonly wrongAnswerIds = signal<string[]>(
    this.state?.wrongAnswers ?? []
  );
  protected readonly mode = signal(this.state?.mode ?? 'flashcard');
  protected readonly direction = signal<QuizDirection>(this.state?.direction ?? DEFAULT_QUIZ_DIRECTION);
  protected readonly directionLabel = computed(() => QUIZ_DIRECTION_LABELS[this.direction()] ?? QUIZ_DIRECTION_LABELS[DEFAULT_QUIZ_DIRECTION]);

  protected readonly accuracy = computed(() => {
    const total = this.totalQuestions();
    if (total === 0) return 0;
    return Math.round((this.correctAnswers() / total) * 100);
  });

  protected readonly modeLabel = computed(
    () => QUIZ_MODE_LABELS[this.mode() as QuizMode] ?? this.mode()
  );

  protected readonly wrongWords = computed(
    (): Array<{ word: Word; definition: string }> =>
      this.wrongAnswerIds()
        .map((id) => this.wordService.getWord(id))
        .filter((w): w is Word => w !== undefined)
        .map((w) => ({ word: w, definition: w.definition }))
  );

  protected readonly isPerfect = computed(
    () => this.wrongAnswerIds().length === 0
  );

  protected readonly promotedWordIds = signal<string[]>([]);

  protected readonly promotedWords = computed((): Word[] =>
    this.promotedWordIds()
      .map((id) => this.wordService.getWord(id))
      .filter((w): w is Word => w !== undefined)
  );

  protected readonly eloquenceDelta = signal(0);

  private static readonly SESSION_PREFIX = '__session_';

  protected readonly parentQuizSetId = computed(() => {
    const id = this.id();
    return id.startsWith(QuizResults.SESSION_PREFIX) ? id.slice(QuizResults.SESSION_PREFIX.length) : null;
  });

  protected readonly reviewExpanded = signal(false);

  protected readonly visibleWrongWords = computed(() =>
    this.reviewExpanded() ? this.wrongWords() : this.wrongWords().slice(0, 1)
  );

  // Flagged words section
  protected readonly flaggedWordIds = signal<string[]>(this.state?.flaggedWordIds ?? []);

  protected readonly flaggedWords = computed((): Word[] =>
    this.flaggedWordIds()
      .map((id) => this.wordService.getWord(id))
      .filter((w): w is Word => w !== undefined)
  );

  protected readonly flaggedExpanded = signal(false);

  protected readonly visibleFlaggedWords = computed(() =>
    this.flaggedExpanded() ? this.flaggedWords() : this.flaggedWords().slice(0, 1)
  );

  protected readonly FLAG_CATEGORIES: ReadonlyArray<{ reason: FlagReason; label: string; icon: string }> = [
    { reason: 'confusing', label: 'Confusing', icon: 'pi pi-question-circle' },
    { reason: 'wrong', label: 'Wrong', icon: 'pi pi-exclamation-triangle' },
    { reason: 'needs-context', label: 'Needs Context', icon: 'pi pi-info-circle' },
    { reason: 'too-easy', label: 'Too Easy', icon: 'pi pi-check-circle' },
  ];

  protected readonly selectedReasons = signal<Map<string, FlagReason>>(new Map());

  protected categorizeFlag(wordId: string, reason: FlagReason): void {
    this.wordService.flagWord(wordId, reason);
    this.selectedReasons.update((m) => {
      const next = new Map(m);
      next.set(wordId, reason);
      return next;
    });
  }

  protected readonly levelUpExpanded = signal(false);

  protected readonly visiblePromotedWords = computed(() =>
    this.levelUpExpanded() ? this.promotedWords() : this.promotedWords().slice(0, 1)
  );

  ngOnInit(): void {
    this.chrome.enterFocus();
    this.destroyRef.onDestroy(() => this.chrome.leaveFocus());

    if (!this.state) {
      // Try to recover from persisted results (e.g. after page refresh)
      const saved = this.progressService.getLatestResult(this.id());
      if (saved) {
        this.score.set(saved.score);
        this.totalQuestions.set(saved.totalQuestions);
        const wrongIds = saved.wordResults
          .filter((wr) => !wr.correct)
          .map((wr) => wr.wordId);
        this.correctAnswers.set(saved.totalQuestions - wrongIds.length);
        this.wrongAnswerIds.set(wrongIds);
        // mode is not stored in QuizResult, keep default
        return; // already saved, don't re-save
      }
      void this.router.navigate(['/quiz', this.id()]);
      return;
    }
    // Flag words that user flagged during quiz (no reason yet; they categorize on this screen)
    const flagged = this.state?.flaggedWordIds ?? [];
    flagged.forEach((id) => this.wordService.flagWord(id));

    const scoreBefore = this.progressService.eloquenceScore();
    this.saveResultAndUpdateMastery();
    this.eloquenceDelta.set(this.progressService.eloquenceScore() - scoreBefore);
    this.onboarding.markQuizDone();
  }

  private saveResultAndUpdateMastery(): void {
    const total = this.totalQuestions();
    if (total === 0) return;

    const qs = this.quizService.getQuizSet(this.id());
    const wrongSet = new Set(this.wrongAnswerIds());

    this.progressService.addResult({
      quizSetId: this.parentQuizSetId() ?? this.id(),
      score: this.score(),
      totalQuestions: total,
      accuracy: this.accuracy(),
      direction: this.direction(),
      wordResults: (qs?.wordIds ?? []).map((wordId) => ({
        wordId,
        correct: !wrongSet.has(wordId),
      })),
    });

    if (qs) {
      let promoted = 0;
      const promotedIds: string[] = [];
      qs.wordIds.forEach((wordId) => {
        const word = this.wordService.getWord(wordId);
        if (!word) return;
        const correct = !wrongSet.has(wordId);
        const newLevel = correct
          ? MASTERY_PROGRESSION[word.masteryLevel]
          : MASTERY_REGRESSION[word.masteryLevel];
        const srUpdate = this.srService.calculateNextReview(word, correct);
        const changes: Partial<Word> = { ...srUpdate };
        if (newLevel !== word.masteryLevel) {
          changes.masteryLevel = newLevel;
          if (correct) {
            promoted++;
            promotedIds.push(wordId);
          }
        }
        this.wordService.updateWord(wordId, changes);
      });
      this.promotedWordIds.set(promotedIds);
      if (promoted > 0) {
        this.toast.show(`${promoted} word${promoted > 1 ? 's' : ''} leveled up!`);
      }
    }
  }

  protected getMasteryLabel(level: MasteryLevel): string {
    return MASTERY_CONFIG[level].label;
  }

  protected tryAgain(): void {
    const qp = { mode: this.mode(), direction: this.direction() };
    if (this.id() === '__smart_review__') {
      void this.router.navigate(['/quiz', '__smart_review__', 'play'], { queryParams: qp });
    } else {
      void this.router.navigate(['/quiz', this.id(), 'play'], { queryParams: qp });
    }
  }

  protected seeProgress(): void {
    void this.router.navigate(['/progress']);
  }

  protected practiceWrongWords(): void {
    const wrongIds = this.wrongAnswerIds();
    if (wrongIds.length === 0) return;
    this.quizService.createTempQuizSet(wrongIds, 'Practice: Wrong Words', '__smart_review__');
    void this.router.navigate(['/quiz', '__smart_review__']);
  }

  protected reviewInDictionary(): void {
    const wrongIds = this.wrongAnswerIds();
    void this.router.navigate(['/dictionary'], {
      queryParams: wrongIds.length > 0 ? { highlight: wrongIds.join(',') } : {},
    });
  }

  protected nextSession(): void {
    const parentId = this.parentQuizSetId();
    if (!parentId) return;
    // Navigate back to parent quiz detail. User picks mode again, gets fresh session words.
    void this.router.navigate(['/quiz', parentId]);
  }

  protected backToQuizzes(): void {
    void this.router.navigate(['/quiz']);
  }
}
