import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';
import { Word, formatMeaning, getQuizExample, getQuizMeaning } from '@vocavault/data-access';
import { BottomSheet } from '@vocavault/ui';

/** Payload that opens the sheet: the correct word + what the user actually answered. */
export interface QuizExplanation {
  word: Word;
  picked: string;
}

/**
 * Bottom-sheet shown when a learner taps "Why?" on a wrong answer. Explains the
 * mistake: the expected word, its definition + an example, and what they chose.
 * Shared by multiple-choice and type quizzes (identical content), so the "why"
 * lives in one place. Reuses the app-wide BottomSheet (swipe-to-dismiss, focus
 * trap, scroll lock) — no new modal mechanics.
 */
@Component({
  selector: 'lib-quiz-explain-sheet',
  imports: [BottomSheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <lib-bottom-sheet [visible]="!!data()" (visibleChange)="data.set(null)">
      @if (data(); as d) {
        <div class="space-y-4">
          <div>
            <p class="text-xl font-bold text-green-700 dark:text-green-400">{{ d.word.word }}</p>
            @if (d.word.pronunciation) {
              <p class="text-sm text-slate-400">{{ d.word.pronunciation }}</p>
            }
          </div>

          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Meaning</p>
            <p class="mt-0.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{{ definition() }}</p>
          </div>

          @if (example(); as ex) {
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">In context</p>
              <p class="mt-0.5 text-sm italic leading-relaxed text-slate-600 dark:text-slate-400">“{{ ex }}”</p>
            </div>
          }

          @if (d.picked.trim()) {
            <div class="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <p class="text-xs font-medium uppercase tracking-wide text-red-400 dark:text-red-500">You answered</p>
              <p class="mt-0.5 text-sm text-red-700 dark:text-red-400">{{ d.picked }}</p>
            </div>
          }
        </div>
      }
    </lib-bottom-sheet>
  `,
})
export class QuizExplainSheet {
  readonly data = model<QuizExplanation | null>(null);

  protected readonly definition = computed(() => {
    const d = this.data();
    return d ? formatMeaning(getQuizMeaning(d.word)) : '';
  });

  protected readonly example = computed(() => {
    const d = this.data();
    return d ? getQuizExample(d.word) : undefined;
  });
}
