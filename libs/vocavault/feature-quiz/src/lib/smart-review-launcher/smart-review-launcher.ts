import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  DEFAULT_QUIZ_DIRECTION,
  QuizService,
  SpacedRepetitionService,
  WordService,
  QUIZ_MODES,
  TEMP_QUIZ_ID,
} from '@vocavault/data-access';
import { EmptyState } from '@vocavault/ui';

@Component({
  selector: 'lib-smart-review-launcher',
  imports: [EmptyState],
  templateUrl: './smart-review-launcher.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmartReviewLauncher {
  private readonly wordService = inject(WordService);
  private readonly srService = inject(SpacedRepetitionService);
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);

  protected readonly dueWords = computed(() =>
    this.srService.getWordsDueForReview(this.wordService.quizzableWords())
  );

  protected readonly dueCount = computed(() => this.dueWords().length);

  protected readonly quizModes = QUIZ_MODES;

  protected startMode(mode: string): void {
    this.quizService.createTempQuizSet(
      this.dueWords().map((w) => w.id)
    );
    void this.router.navigate(['/quiz', TEMP_QUIZ_ID, 'play'], {
      queryParams: { mode, direction: DEFAULT_QUIZ_DIRECTION },
    });
  }

  protected goBack(): void {
    void this.router.navigate(['/home']);
  }
}
