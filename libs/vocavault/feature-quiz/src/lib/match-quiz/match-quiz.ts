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
import { getPrompt, getAnswer, filterAndNotify, resolveDirection, COLUMN_LABELS } from '../quiz-shared/quiz-direction';

const MAX_MATCH_WORDS_DESKTOP = 8;
const MAX_MATCH_WORDS_MOBILE = 5;
const MOBILE_BREAKPOINT = 640;

@Component({
  selector: 'lib-match-quiz',
  imports: [Button, EmptyState, QuizFlagBanner, QuizProgressBar],
  templateUrl: './match-quiz.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchQuiz implements HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly toast = inject(ToastService);

  readonly direction = input<QuizDirection>(DEFAULT_QUIZ_DIRECTION);

  private readonly quizSetId = resolveQuizSetId(this.route);

  protected readonly flaggedIds = signal<Set<string>>(new Set());

  private readonly finishing = signal(false);
  readonly hasUnsavedChanges = computed(() => !this.finishing() && (this.totalMatchedCount() > 0 || this.selectedWordId() !== null || this.selectedDefId() !== null));

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

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
    filterAndNotify(this.quizService.getWordsForQuizSet(this.quizSetId), this.direction(), this.toast);
  }

  /** For mixed mode: resolve to ONE direction for the entire round */
  protected readonly roundDirection = computed((): Exclude<QuizDirection, 'mixed'> => {
    if (this.direction() !== 'mixed') return this.direction() as Exclude<QuizDirection, 'mixed'>;
    const first = this.words()[0];
    if (!first) return 'definition-to-word';
    return resolveDirection(first, 'mixed');
  });

  private readonly allWords = computed(() =>
    this.quizService.getWordsForQuizSet(this.quizSetId).filter(w =>
      this.direction() !== 'example-to-definition' || w.examples.length > 0
    )
  );

  /** Responsive chunk size: fewer words per round on mobile */
  private readonly maxMatchWords =
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
      ? MAX_MATCH_WORDS_MOBILE
      : MAX_MATCH_WORDS_DESKTOP;

  private readonly rounds = computed(() => {
    const all = this.allWords();
    const chunks: Word[][] = [];
    for (let i = 0; i < all.length; i += this.maxMatchWords) {
      chunks.push(all.slice(i, i + this.maxMatchWords));
    }
    return chunks;
  });

  protected readonly currentRound = signal(0);
  protected readonly totalRounds = computed(() => this.rounds().length);

  protected readonly words = computed(() =>
    this.rounds()[this.currentRound()] ?? []
  );

  protected readonly shuffledDefWordIds = computed(() =>
    shuffle(this.words().map((w) => w.id))
  );

  protected readonly selectedWordId = signal<string | null>(null);
  protected readonly selectedDefId = signal<string | null>(null);
  protected readonly matchedPairIds = signal<string[]>([]);
  protected readonly mistakeWordIds = signal<string[]>([]);
  protected readonly wrongFlashWordId = signal<string | null>(null);
  protected readonly matchFeedback = signal('');

  /** Track total matches across all rounds */
  private readonly completedRoundMatches = signal(0);
  private readonly completedRoundMistakes = signal<string[]>([]);

  protected readonly totalMatchedCount = computed(
    () => this.completedRoundMatches() + this.matchedPairIds().length,
  );

  protected readonly totalWordCount = computed(
    () => this.allWords().length,
  );

  protected readonly isRoundComplete = computed(
    () =>
      this.matchedPairIds().length === this.words().length &&
      this.words().length > 0,
  );

  protected readonly isLastRound = computed(
    () => this.currentRound() >= this.totalRounds() - 1,
  );

  protected readonly isComplete = computed(
    () => this.isRoundComplete() && this.isLastRound(),
  );

  /** Current word for the flag banner: selected word or first in round */
  protected readonly currentFlagWord = computed(() => {
    const wordId = this.selectedWordId();
    if (wordId) return this.getWord(wordId);
    const defId = this.selectedDefId();
    if (defId) return this.getWord(defId);
    return this.words()[0];
  });

  protected readonly selectedLabel = computed(() => {
    const wordId = this.selectedWordId();
    if (wordId) {
      const w = this.getWord(wordId);
      return w ? this.getLeftText(w) : null;
    }
    const defId = this.selectedDefId();
    if (defId) {
      const w = this.getWord(defId);
      return w ? this.getRightText(w) : null;
    }
    return null;
  });

  /** Unified selection handler that works from either column */
  protected select(id: string, side: 'word' | 'def'): void {
    if (this.matchedPairIds().includes(id)) return;

    const selfSignal = side === 'word' ? this.selectedWordId : this.selectedDefId;
    const otherSignal = side === 'word' ? this.selectedDefId : this.selectedWordId;

    // Tap same item again to deselect
    if (selfSignal() === id) { selfSignal.set(null); return; }

    // Other side already selected, so try to match
    const otherId = otherSignal();
    if (otherId) {
      this.tryMatch(side === 'word' ? id : otherId, side === 'word' ? otherId : id);
      return;
    }

    otherSignal.set(null);
    selfSignal.set(id);
  }

  private tryMatch(wordId: string, defWordId: string): void {
    if (wordId === defWordId) {
      this.matchedPairIds.update((ids) => [...ids, wordId]);
      this.clearSelection();
      this.matchFeedback.set('Correct match!');
    } else {
      const anchorId = this.selectedWordId() ?? this.selectedDefId() ?? wordId;
      if (!this.mistakeWordIds().includes(anchorId)) {
        this.mistakeWordIds.update((ids) => [...ids, anchorId]);
      }
      this.wrongFlashWordId.set(anchorId);
      this.matchFeedback.set('Incorrect match, try again');
      setTimeout(() => {
        this.wrongFlashWordId.set(null);
        this.clearSelection();
      }, 600);
    }
  }

  private clearSelection(): void {
    this.selectedWordId.set(null);
    this.selectedDefId.set(null);
  }

  protected nextRound(): void {
    this.completedRoundMatches.update((c) => c + this.matchedPairIds().length);
    this.completedRoundMistakes.update((ids) => [...ids, ...this.mistakeWordIds()]);
    this.matchedPairIds.set([]);
    this.mistakeWordIds.set([]);
    this.clearSelection();
    this.wrongFlashWordId.set(null);
    this.currentRound.update((r) => r + 1);
  }

  /** Unified tile styling that works for both columns */
  protected tileClass(id: string, side: 'word' | 'def'): string {
    if (this.matchedPairIds().includes(id))
      return 'border-green-400 bg-green-50 dark:bg-green-900/30 opacity-50 cursor-default animate-pulse-success';
    if (this.wrongFlashWordId() === id)
      return 'border-red-400 bg-red-50 dark:bg-red-900/30 animate-shake';
    const selectedSignal = side === 'word' ? this.selectedWordId : this.selectedDefId;
    if (selectedSignal() === id)
      return 'border-vv-brand bg-blue-50 dark:bg-blue-900/30 ring-2 ring-vv-brand';
    return 'border-slate-200 dark:border-slate-600 bg-vv-surface hover:border-vv-brand hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer';
  }

  protected getWord(wordId: string): Word | undefined {
    return this.words().find((w) => w.id === wordId);
  }

  protected getLeftText(word: Word): string {
    return getPrompt(word, this.roundDirection());
  }

  protected getRightText(word: Word): string {
    return getAnswer(word, this.roundDirection());
  }

  protected readonly columnLabels = computed(() => COLUMN_LABELS[this.roundDirection()]);

  protected finish(): void {
    this.finishing.set(true);
    const allMistakes = [...this.completedRoundMistakes(), ...this.mistakeWordIds()];
    const totalCorrect = this.completedRoundMatches() + this.matchedPairIds().length;
    navigateToResults(this.router, this.quizSetId, {
      score: totalCorrect,
      totalQuestions: this.allWords().length,
      correctAnswers: totalCorrect,
      wrongAnswers: allMistakes,
      mode: 'match',
      direction: this.direction(),
      flaggedWordIds: [...this.flaggedIds()],
    });
  }
}
