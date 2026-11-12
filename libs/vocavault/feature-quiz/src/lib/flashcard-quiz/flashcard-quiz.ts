import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DEFAULT_QUIZ_DIRECTION, HasUnsavedChanges, QuizDirection, QuizService, getQuizExample } from '@vocavault/data-access';
import { Button, EmptyState, QuizFlagBanner, QuizProgressBar, SwipeableDirective, SwipeDirection, ToastService } from '@vocavault/ui';
import { resolveQuizSetId, navigateToResults } from '../quiz-shared/quiz-utils';
import { buildQuizItem, filterAndNotify, QuizItem } from '../quiz-shared/quiz-direction';

type Verdict = 'correct' | 'missed';

@Component({
  selector: 'lib-flashcard-quiz',
  imports: [Button, EmptyState, QuizFlagBanner, QuizProgressBar, SwipeableDirective],
  templateUrl: './flashcard-quiz.html',
  styleUrl: './flashcard-quiz.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlashcardQuiz implements HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly toast = inject(ToastService);

  readonly direction = input<QuizDirection>(DEFAULT_QUIZ_DIRECTION);

  private readonly quizSetId = resolveQuizSetId(this.route);

  protected readonly flaggedIds = signal<Set<string>>(new Set());

  private readonly finishing = signal(false);
  readonly hasUnsavedChanges = computed(() => !this.finishing() && this.verdicts().size > 0);

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  protected readonly words = computed(() => {
    const all = this.quizService.getWordsForQuizSet(this.quizSetId);
    return this.direction() === 'example-to-definition'
      ? all.filter((w) => w.examples.length > 0)
      : all;
  });

  constructor() {
    const allWords = this.quizService.getWordsForQuizSet(this.quizSetId);
    const quizSet = this.quizService.getQuizSet(this.quizSetId);
    if (quizSet && allWords.length < quizSet.wordIds.length) {
      const removed = quizSet.wordIds.length - allWords.length;
      this.toast.showWithAction(
        `${removed} word${removed !== 1 ? 's were' : ' was'} removed from this set`,
        { label: 'Edit quiz', callback: () => void this.router.navigate(['/quiz', this.quizSetId, 'edit']) },
        'info',
      );
    }
    filterAndNotify(allWords, this.direction(), this.toast);
  }

  protected readonly currentIndex = signal(0);
  protected readonly isFlipped = signal(false);

  // Tracks each card's assessment verdict by index, preventing double-counting
  private readonly verdicts = signal<Map<number, Verdict>>(new Map());
  protected readonly lastFeedback = signal('');

  protected readonly currentAssessed = computed(() =>
    this.verdicts().has(this.currentIndex())
  );
  protected readonly reviewedCount = computed(() => this.verdicts().size);

  protected readonly currentWord = computed(() => this.words()[this.currentIndex()]);
  protected readonly quizExample = computed(() => {
    const w = this.currentWord();
    return w ? getQuizExample(w) : undefined;
  });
  protected readonly currentItem = computed((): QuizItem | null => {
    const w = this.currentWord();
    return w ? buildQuizItem(w, this.direction()) : null;
  });
  protected readonly isLast = computed(
    () => this.currentIndex() >= this.words().length - 1
  );
  protected readonly cardLabel = computed(
    () => `Card ${this.currentIndex() + 1} of ${this.words().length}`
  );

  protected flipCard(): void {
    this.isFlipped.update((v) => !v);
  }

  protected markGotIt(): void {
    this.recordVerdict('correct');
    this.lastFeedback.set('Marked as correct');
    this.advance();
  }

  protected markMissed(): void {
    this.recordVerdict('missed');
    this.lastFeedback.set('Marked as missed');
    this.advance();
  }

  private recordVerdict(verdict: Verdict): void {
    const idx = this.currentIndex();
    this.verdicts.update((m) => new Map(m).set(idx, verdict));
  }

  private advance(): void {
    if (this.isLast()) return;
    this.currentIndex.update((i) => i + 1);
    this.isFlipped.set(false);
  }

  protected prevCard(): void {
    this.currentIndex.update((i) => Math.max(i - 1, 0));
    this.isFlipped.set(false);
  }

  protected nextCard(): void {
    if (this.isLast()) return;
    this.currentIndex.update((i) => i + 1);
    this.isFlipped.set(false);
  }

  protected onSwipe(direction: SwipeDirection): void {
    if (direction === 'left' && !this.isLast()) {
      this.currentIndex.update((i) => i + 1);
      this.isFlipped.set(false);
    } else if (direction === 'right' && this.currentIndex() > 0) {
      this.prevCard();
    }
  }

  protected finish(): void {
    this.finishing.set(true);
    const ws = this.words();
    const v = this.verdicts();
    const wrongIds = ws
      .filter((_, i) => v.get(i) === 'missed')
      .map((w) => w.id);
    navigateToResults(this.router, this.quizSetId, {
      score: ws.length - wrongIds.length,
      totalQuestions: ws.length,
      correctAnswers: ws.length - wrongIds.length,
      wrongAnswers: wrongIds,
      mode: 'flashcard',
      direction: this.direction(),
      flaggedWordIds: [...this.flaggedIds()],
    });
  }
}
