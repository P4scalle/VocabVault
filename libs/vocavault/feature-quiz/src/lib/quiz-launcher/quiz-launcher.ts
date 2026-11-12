import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { DEFAULT_QUIZ_DIRECTION, QuizService, QUIZ_MODE_MAP, QUIZ_MODES } from '@vocavault/data-access';

@Component({
  selector: 'lib-quiz-launcher',
  imports: [],
  templateUrl: './quiz-launcher.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizLauncher {
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);

  readonly mode = input<string>('flashcard');
  protected readonly modeInfo = computed(() => QUIZ_MODE_MAP[this.mode()] ?? QUIZ_MODES[0]);

  protected readonly minWords = computed(() => this.mode() === 'multiple-choice' ? 4 : 1);

  protected readonly quizSets = computed(() =>
    this.quizService.quizSets().filter((qs) => qs.wordIds.length >= this.minWords()),
  );

  protected startWithExisting(quizSetId: string): void {
    void this.router.navigate(['/quiz', quizSetId, 'play'], {
      queryParams: { mode: this.mode(), direction: DEFAULT_QUIZ_DIRECTION },
    });
  }

  protected createNew(): void {
    void this.router.navigate(['/quiz', 'create']);
  }

  protected goBack(): void {
    void this.router.navigate(['/home']);
  }
}
