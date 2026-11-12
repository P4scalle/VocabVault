import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HasUnsavedChanges, QuizService } from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';
import { ChromeService } from '@vocavault/util';
import { QuizSetForm, QuizSetFormData } from '../quiz-set-form/quiz-set-form';

@Component({
  selector: 'lib-quiz-edit',
  imports: [QuizSetForm],
  template: `
    @if (quizSet(); as qs) {
      <lib-quiz-set-form
        [editQuizSet]="qs"
        (saved)="onSaved($event)"
        (cancelled)="onCancelled()"
        (deleteRequested)="onDelete()"
        (dirtyChange)="hasUnsavedChanges.set($event)"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuizEdit implements HasUnsavedChanges {
  private readonly router = inject(Router);
  private readonly quizService = inject(QuizService);
  private readonly toast = inject(ToastService);
  private readonly chrome = inject(ChromeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();
  readonly hasUnsavedChanges = signal(false);

  constructor() {
    this.chrome.enterFocus();
    this.destroyRef.onDestroy(() => this.chrome.leaveFocus());
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }

  protected readonly quizSet = computed(() =>
    this.quizService.getQuizSet(this.id()),
  );

  protected onSaved(data: QuizSetFormData): void {
    this.hasUnsavedChanges.set(false);
    if (this.quizService.updateQuizSet(this.id(), data)) {
      this.toast.show('Quiz updated!');
      void this.router.navigate(['/quiz', this.id()]);
    } else {
      this.toast.show('Could not save. Storage may be full.', 'error');
    }
  }

  protected onCancelled(): void {
    this.hasUnsavedChanges.set(false);
    void this.router.navigate(['/quiz', this.id()]);
  }

  protected onDelete(): void {
    const quizSet = this.quizSet();
    this.hasUnsavedChanges.set(false);
    if (this.quizService.deleteQuizSet(this.id())) {
      this.toast.showWithAction(
        'Quiz deleted',
        {
          label: 'Undo',
          callback: () => {
            if (quizSet) {
              this.quizService.restoreQuizSet(quizSet);
              void this.router.navigate(['/quiz', this.id(), 'edit']);
            }
          },
        },
        'info',
      );
      void this.router.navigate(['/quiz']);
    } else {
      this.toast.show('Could not save. Storage may be full.', 'error');
    }
  }
}
