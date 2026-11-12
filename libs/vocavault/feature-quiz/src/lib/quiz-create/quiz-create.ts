import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DEFAULT_QUIZ_DIRECTION, HasUnsavedChanges, QuizService } from '@vocavault/data-access';
import { ToastService } from '@vocavault/ui';
import { ChromeService } from '@vocavault/util';
import { QuizSetForm, QuizSetFormData } from '../quiz-set-form/quiz-set-form';

@Component({
  selector: 'lib-quiz-create',
  imports: [QuizSetForm],
  template: `<lib-quiz-set-form (saved)="onSaved($event)" (cancelled)="onCancelled()" (dirtyChange)="hasUnsavedChanges.set($event)" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex-1 flex flex-col' },
})
export class QuizCreate implements HasUnsavedChanges {
  private readonly quizService = inject(QuizService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly chrome = inject(ChromeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = input<string>();
  readonly hasUnsavedChanges = signal(false);

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
      this.toast.show('Could not save — storage may be full', 'error');
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
