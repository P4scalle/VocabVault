import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DEFAULT_QUIZ_DIRECTION, HasUnsavedChanges, QuizService } from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';
import { ChromeService, OnboardingService } from '@vocavault/util';
import { QuizSetForm, QuizSetFormData } from '../quiz-set-form/quiz-set-form';

@Component({
  selector: 'lib-quiz-create',
  imports: [QuizSetForm],
  template: `
    @if (showTeachingBanner()) {
      <div
        class="vv-card mb-4 flex items-start gap-3 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4 dark:from-emerald-900/30 dark:via-teal-900/20 dark:to-cyan-900/20"
        data-testid="create-quiz-teaching"
        role="note"
      >
        <i class="pi pi-info-circle mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true"></i>
        <p class="m-0 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          A quiz is an editable set of words you'd like to practice. Pick a few to get started.
        </p>
      </div>
    }
    <lib-quiz-set-form (saved)="onSaved($event)" (cancelled)="onCancelled()" (dirtyChange)="hasUnsavedChanges.set($event)" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex-1 flex flex-col' },
})
export class QuizCreate implements HasUnsavedChanges {
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly chrome = inject(ChromeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly onboarding = inject(OnboardingService);

  readonly mode = input<string>();
  readonly hasUnsavedChanges = signal(false);

  /** Teach what a quiz is while a first-run user is at the create-quiz milestone. */
  protected readonly showTeachingBanner = computed(
    () => this.onboarding.currentStep() === 'create-quiz',
  );

  constructor() {
    this.chrome.enterFocus();
    this.destroyRef.onDestroy(() => this.chrome.leaveFocus());
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  protected onSaved(data: QuizSetFormData): void {
    const { quizSet, ok } = this.quizService.addQuizSet(data);
    if (!ok) {
      this.toast.show('Could not save. Storage may be full.', 'error');
      return;
    }
    this.hasUnsavedChanges.set(false);
    this.toast.show('Quiz created!');
    const preselectedMode = this.mode();
    if (preselectedMode && quizSet) {
      void this.router.navigate(['/quiz', quizSet.id, 'play'], {
        queryParams: { mode: preselectedMode, direction: DEFAULT_QUIZ_DIRECTION },
      });
    } else {
      void this.router.navigate(['/quiz', quizSet?.id ?? '']);
    }
  }

  protected onCancelled(): void {
    this.hasUnsavedChanges.set(false);
    void this.router.navigate(['/quiz']);
  }
}
