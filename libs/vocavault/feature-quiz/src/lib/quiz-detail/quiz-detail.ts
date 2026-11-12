import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { DEFAULT_QUIZ_DIRECTION, QUIZ_DIRECTION_LABELS, QuizDirection, QuizService, WordService } from '@vocavault/data-access';
import { Button, ToastService } from '@vocavault/ui';

@Component({
  selector: 'lib-quiz-detail',
  imports: [A11yModule, Button, FormsModule],
  templateUrl: './quiz-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizDetail {
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly wordService = inject(WordService);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();

  protected readonly quizSet = computed(() =>
    this.quizService.getQuizSet(this.id())
  );

  protected readonly words = computed(() =>
    this.quizService.getWordsForQuizSet(this.id())
  );

  protected readonly sessionInfo = computed(() =>
    this.quizService.getSessionInfo(this.id())
  );

  protected readonly sessionProgress = computed(() => {
    const info = this.sessionInfo();
    if (!info.needsChunking) return null;
    const pct = info.totalWords > 0 ? Math.round((info.practicedWords / info.totalWords) * 100) : 0;
    const allPracticed = info.practicedWords >= info.totalWords;
    return { ...info, pct, allPracticed };
  });

  protected readonly selectedDirection = signal<QuizDirection>(DEFAULT_QUIZ_DIRECTION);

  protected readonly directionOptions = computed(() => {
    const ws = this.words();
    const hasExamples = ws.some(w => w.examples.length > 0);
    const options: QuizDirection[] = ['definition-to-word', 'word-to-definition'];
    if (hasExamples) options.push('example-to-definition');
    options.push('mixed');
    return options;
  });

  protected readonly directionLabels = QUIZ_DIRECTION_LABELS;

  protected readonly showWordPicker = signal(false);
  protected readonly wordFilter = signal('');
  protected readonly selectedWordIds = signal<string[]>([]);

  protected readonly allWords = this.wordService.words;

  protected readonly filteredWords = computed(() => {
    const q = this.wordFilter().toLowerCase().trim();
    const all = this.allWords();
    if (!q) return all;
    return all.filter(
      (w) => w.word.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q),
    );
  });

  protected openWordPicker(): void {
    this.selectedWordIds.set([...(this.quizSet()?.wordIds ?? [])]);
    this.wordFilter.set('');
    this.showWordPicker.set(true);
  }

  protected closeWordPicker(): void {
    this.showWordPicker.set(false);
  }

  protected toggleWord(wordId: string): void {
    this.selectedWordIds.update((ids) =>
      ids.includes(wordId) ? ids.filter((id) => id !== wordId) : [...ids, wordId],
    );
  }

  protected isWordSelected(wordId: string): boolean {
    return this.selectedWordIds().includes(wordId);
  }

  protected selectDirection(dir: QuizDirection): void {
    this.selectedDirection.set(dir);
  }

  protected saveWordSelection(): void {
    if (this.quizService.updateQuizSet(this.id(), { wordIds: this.selectedWordIds() })) {
      this.showWordPicker.set(false);
      this.toast.show('Words updated!');
    } else {
      this.toast.show('Could not save. Storage may be full.', 'error');
    }
  }

  protected startMode(mode: 'flashcard' | 'multiple-choice' | 'type' | 'match'): void {
    const qp = { mode, direction: this.selectedDirection() };
    const info = this.sessionInfo();

    if (info.needsChunking) {
      // Large set: pick a session-sized batch and play via temp set
      const sessionIds = this.quizService.getSessionWords(this.id());
      this.quizService.createTempQuizSet(sessionIds, this.quizSet()?.name ?? 'Session', `__session_${this.id()}`);
      void this.router.navigate(['/quiz', `__session_${this.id()}`, 'play'], { queryParams: qp });
    } else {
      void this.router.navigate(['/quiz', this.id(), 'play'], { queryParams: qp });
    }
  }

  protected editQuiz(): void {
    void this.router.navigate(['/quiz', this.id(), 'edit']);
  }

  protected goBack(): void {
    void this.router.navigate(['/quiz']);
  }
}
