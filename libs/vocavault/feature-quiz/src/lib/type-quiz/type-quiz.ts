import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DEFAULT_QUIZ_DIRECTION, HasUnsavedChanges, QuizDirection, QuizService } from '@vocavault/data-access';
import { Button, EmptyState, QuizFlagBanner, QuizProgressBar, ToastService } from '@vocavault/ui';
import { fuzzyMatch, FuzzyResult } from '@vocavault/util';
import { resolveQuizSetId, navigateToResults } from '../quiz-shared/quiz-utils';
import { buildQuizItem, filterAndNotify, QuizItem } from '../quiz-shared/quiz-direction';

@Component({
  selector: 'lib-type-quiz',
  imports: [FormsModule, Button, EmptyState, QuizFlagBanner, QuizProgressBar],
  templateUrl: './type-quiz.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypeQuiz implements HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly toast = inject(ToastService);

  readonly direction = input<QuizDirection>(DEFAULT_QUIZ_DIRECTION);

  private readonly textareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('answerInput');
  private readonly quizSetId = resolveQuizSetId(this.route);

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

  protected readonly flaggedIds = signal<Set<string>>(new Set());

  private readonly finishing = signal(false);
  readonly hasUnsavedChanges = computed(() => !this.finishing() && (this.userInput().trim().length > 0 || this.correctCount() > 0 || this.wrongWordIds().length > 0));

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isSubmitted()) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (this.isLast()) {
        this.finish();
      } else {
        this.next();
      }
    }
  }

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

  protected readonly currentIndex = signal(0);
  protected readonly userInput = signal('');
  protected readonly isSubmitted = signal(false);
  protected readonly correctCount = signal(0);
  protected readonly wrongWordIds = signal<string[]>([]);
  protected readonly lastFuzzyResult = signal<FuzzyResult | null>(null);

  protected readonly currentWord = computed(
    () => this.words()[this.currentIndex()]
  );
  protected readonly isLast = computed(
    () => this.currentIndex() >= this.words().length - 1
  );
  protected readonly progress = computed(
    () => `Word ${this.currentIndex() + 1} of ${this.words().length}`
  );
  protected readonly canSubmit = computed(
    () => this.userInput().trim().length > 0 && !this.isSubmitted()
  );
  protected readonly isCorrect = computed(() => {
    const result = this.lastFuzzyResult();
    return result?.exact ?? false;
  });
  protected readonly isClose = computed(() => {
    const result = this.lastFuzzyResult();
    return result ? result.close && !result.exact : false;
  });

  protected readonly currentItem = computed((): QuizItem | null => {
    const w = this.currentWord();
    return w ? buildQuizItem(w, this.direction()) : null;
  });

  protected readonly inputPlaceholder = computed(() => {
    const item = this.currentItem();
    return item?.resolvedDirection === 'definition-to-word'
      ? 'Type the word...'
      : 'Type the definition...';
  });

  protected submit(): void {
    if (!this.canSubmit()) return;
    const item = this.currentItem();
    if (!item) return;

    const result = fuzzyMatch(this.userInput(), item.answer);
    this.lastFuzzyResult.set(result);
    this.isSubmitted.set(true);

    // Exact match OR close enough = correct
    if (result.exact || result.close) {
      this.correctCount.update((c) => c + 1);
    } else {
      this.wrongWordIds.update((ids) => [...ids, item.word.id]);
    }
  }

  private focusInput(): void {
    setTimeout(() => this.textareaRef()?.nativeElement.focus());
  }

  protected next(): void {
    this.currentIndex.update((i) => i + 1);
    this.userInput.set('');
    this.isSubmitted.set(false);
    this.lastFuzzyResult.set(null);
    this.focusInput();
  }

  protected finish(): void {
    this.finishing.set(true);
    navigateToResults(this.router, this.quizSetId, {
      score: this.correctCount(),
      totalQuestions: this.words().length,
      correctAnswers: this.correctCount(),
      wrongAnswers: this.wrongWordIds(),
      mode: 'type',
      direction: this.direction(),
      flaggedWordIds: [...this.flaggedIds()],
    });
  }
}
