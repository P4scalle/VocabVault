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
import { DEFAULT_QUIZ_DIRECTION, HasUnsavedChanges, QuizDirection, QuizService, Word } from '@vocavault/data-access';
import { Button, EmptyState, QuizFlagBanner, QuizProgressBar, ToastService } from '@vocavault/ui';
import { shuffle } from '@vocavault/util';
import { resolveQuizSetId, navigateToResults } from '../quiz-shared/quiz-utils';
import { buildQuizItem, filterAndNotify, getAnswer } from '../quiz-shared/quiz-direction';

interface MCQuestion {
  word: Word;
  options: string[];
  correctIndex: number;
  prompt: string;
  promptLabel: string;
  resolvedDirection: Exclude<QuizDirection, 'mixed'>;
}

@Component({
  selector: 'lib-multiple-choice-quiz',
  imports: [Button, EmptyState, QuizFlagBanner, QuizProgressBar],
  templateUrl: './multiple-choice-quiz.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultipleChoiceQuiz implements HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly toast = inject(ToastService);

  readonly direction = input<QuizDirection>(DEFAULT_QUIZ_DIRECTION);

  private readonly quizSetId = resolveQuizSetId(this.route);

  constructor() {
    const quizSet = this.quizService.getQuizSet(this.quizSetId);
    const playableWords = this.quizService.getWordsForQuizSet(this.quizSetId);
    if (quizSet && playableWords.length < quizSet.wordIds.length) {
      const removed = quizSet.wordIds.length - playableWords.length;
      this.toast.showWithAction(
        `${removed} word${removed !== 1 ? 's were' : ' was'} removed from this set`,
        { label: 'Edit quiz', callback: () => void this.router.navigate(['/quiz', this.quizSetId, 'edit']) },
        'info',
      );
    }
  }

  protected readonly flaggedIds = signal<Set<string>>(new Set());

  private readonly finishing = signal(false);
  readonly hasUnsavedChanges = computed(() => !this.finishing() && (this.selectedOptionIndex() !== null || this.correctCount() > 0 || this.wrongWordIds().length > 0));

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  protected readonly questions = signal<MCQuestion[]>(this.buildQuestions());

  private buildQuestions(): MCQuestion[] {
    let ws = this.quizService.getWordsForQuizSet(this.quizSetId);
    ws = filterAndNotify(ws, this.direction(), this.toast);
    ws = shuffle(ws);
    return ws.map((word) => {
      const item = buildQuizItem(word, this.direction());
      const distractors = ws
        .filter((w) => w.id !== word.id)
        .slice(0, Math.min(3, ws.length - 1))
        .map((w) => getAnswer(w, item.resolvedDirection));
      const options = shuffle([item.answer, ...distractors]);
      return {
        word,
        options,
        correctIndex: options.indexOf(item.answer),
        prompt: item.prompt,
        promptLabel: item.promptLabel,
        resolvedDirection: item.resolvedDirection,
      };
    });
  }

  protected readonly currentIndex = signal(0);
  protected readonly selectedOptionIndex = signal<number | null>(null);
  protected readonly correctCount = signal(0);
  protected readonly wrongWordIds = signal<string[]>([]);

  protected readonly currentQuestion = computed(
    () => this.questions()[this.currentIndex()]
  );
  protected readonly isAnswered = computed(
    () => this.selectedOptionIndex() !== null
  );
  protected readonly isLast = computed(
    () => this.currentIndex() >= this.questions().length - 1
  );
  protected readonly progress = computed(
    () => `Question ${this.currentIndex() + 1} of ${this.questions().length}`
  );

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const key = event.key;

    // After answering: Enter/Space advances
    if (this.isAnswered() && (key === 'Enter' || key === ' ')) {
      event.preventDefault();
      if (this.isLast()) {
        this.finish();
      } else {
        this.next();
      }
      return;
    }

    if (this.isAnswered()) return;
    if (key >= '1' && key <= '4') {
      const index = parseInt(key, 10) - 1;
      if (index < this.currentQuestion().options.length) {
        this.selectOption(index);
      }
    }
  }

  protected selectOption(index: number): void {
    if (this.isAnswered()) return;
    this.selectedOptionIndex.set(index);
    const q = this.currentQuestion();
    if (index === q.correctIndex) {
      this.correctCount.update((c) => c + 1);
    } else {
      this.wrongWordIds.update((ids) => [...ids, q.word.id]);
    }
  }

  protected readonly optionClasses = computed(() => {
    const unanswered = 'border-slate-200 dark:border-slate-600 bg-vv-surface hover:border-vv-brand hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-900 dark:text-slate-100';
    if (!this.isAnswered()) return [unanswered, unanswered, unanswered, unanswered];
    const q = this.currentQuestion();
    const selected = this.selectedOptionIndex();
    return q.options.map((_, i) => {
      if (i === q.correctIndex) return 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 animate-pulse-success';
      if (i === selected) return 'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 animate-shake animate-pulse-error';
      return 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60';
    });
  });

  protected next(): void {
    this.currentIndex.update((i) => i + 1);
    this.selectedOptionIndex.set(null);
  }

  protected finish(): void {
    this.finishing.set(true);
    navigateToResults(this.router, this.quizSetId, {
      score: this.correctCount(),
      totalQuestions: this.questions().length,
      correctAnswers: this.correctCount(),
      wrongAnswers: this.wrongWordIds(),
      mode: 'multiple-choice',
      direction: this.direction(),
      flaggedWordIds: [...this.flaggedIds()],
    });
  }
}
