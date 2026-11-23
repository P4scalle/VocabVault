import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal, Signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { DEFAULT_QUIZ_DIRECTION, HasUnsavedChanges } from '@vocavault/data-access';
import { InfoButton, InfoDrawer, PageHeader } from '@vocavault/ui';
import { ChromeService } from '@vocavault/util';
import { FlashcardQuiz } from '../flashcard-quiz/flashcard-quiz';
import { MultipleChoiceQuiz } from '../multiple-choice-quiz/multiple-choice-quiz';
import { TypeQuiz } from '../type-quiz/type-quiz';
import { MatchQuiz } from '../match-quiz/match-quiz';
import { normalizeDirection } from '../quiz-shared/quiz-direction';

@Component({
  selector: 'lib-quiz-play-router',
  imports: [FlashcardQuiz, MultipleChoiceQuiz, TypeQuiz, MatchQuiz, PageHeader, InfoButton, InfoDrawer],
  template: `
    <div class="sticky top-0 z-30 -mx-4 px-4 bg-vv-bg dark:bg-slate-900 md:static md:mx-0 md:px-0 md:bg-transparent dark:md:bg-transparent">
      <lib-page-header
        [title]="modeLabel()"
        [showBack]="true"
        (backClicked)="onQuit()"
      >
        @if (howToTopic()) {
          <lib-info-button ariaLabel="How this quiz works" (click)="infoTopic.set(howToTopic())" />
        }
      </lib-page-header>
    </div>
    <lib-info-drawer [(topic)]="infoTopic" />
    @switch (mode()) {
      @case ('flashcard') {
        <lib-flashcard-quiz [direction]="direction()" />
      }
      @case ('multiple-choice') {
        <lib-multiple-choice-quiz [direction]="direction()" />
      }
      @case ('type') {
        <lib-type-quiz [direction]="direction()" />
      }
      @case ('match') {
        <lib-match-quiz [direction]="direction()" />
      }
      @default {
        <p class="text-slate-500 dark:text-slate-400">Unknown quiz mode.</p>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizPlayRouter implements HasUnsavedChanges {
  private readonly router = inject(Router);
  private readonly chrome = inject(ChromeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();
  readonly mode = input<string>('flashcard');
  readonly direction = input(DEFAULT_QUIZ_DIRECTION, { transform: normalizeDirection });

  protected readonly modeLabel = computed(() => ({
    flashcard: 'Flashcard',
    'multiple-choice': 'Multiple Choice',
    type: 'Type / Write',
    match: 'Match',
  } as Record<string, string>)[this.mode()] ?? 'Quiz');

  /** Which "what to do" topic the info button opens, or null for unknown modes. */
  private static readonly KNOWN_MODES = ['flashcard', 'multiple-choice', 'type', 'match'];
  protected readonly howToTopic = computed(() =>
    QuizPlayRouter.KNOWN_MODES.includes(this.mode()) ? `howto-${this.mode()}` : null,
  );

  /** Info drawer topic (null = closed). Opened from the title info button. */
  protected readonly infoTopic = signal<string | null>(null);

  private readonly flashcard = viewChild(FlashcardQuiz);
  private readonly multipleChoice = viewChild(MultipleChoiceQuiz);
  private readonly typeQuiz = viewChild(TypeQuiz);
  private readonly matchQuiz = viewChild(MatchQuiz);

  readonly hasUnsavedChanges: Signal<boolean> = computed(() => {
    const child = this.flashcard() ?? this.multipleChoice() ?? this.typeQuiz() ?? this.matchQuiz();
    return child?.hasUnsavedChanges() ?? false;
  });

  constructor() {
    this.chrome.enterFocus();
    this.destroyRef.onDestroy(() => this.chrome.leaveFocus());
  }

  protected onQuit(): void {
    if (this.hasUnsavedChanges()) {
      const leave = window.confirm('Your quiz progress will be lost. Leave anyway?');
      if (!leave) return;
    }
    void this.router.navigate(['/quiz']);
  }
}
