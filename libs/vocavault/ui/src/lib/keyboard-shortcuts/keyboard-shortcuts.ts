import { A11yModule } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  signal,
} from '@angular/core';

export interface ShortcutEntry {
  keys: string;
  description: string;
}

const GLOBAL_SHORTCUTS: ShortcutEntry[] = [
  { keys: '?', description: 'Show keyboard shortcuts' },
  { keys: 'Esc', description: 'Close drawer / modal' },
];

const QUIZ_SHORTCUTS: ShortcutEntry[] = [
  { keys: 'Space', description: 'Flip flashcard' },
  { keys: '1-4', description: 'Select answer (multiple choice)' },
  { keys: 'Enter', description: 'Submit / Next' },
];

const DICTIONARY_SHORTCUTS: ShortcutEntry[] = [
  { keys: 'Esc', description: 'Cancel editing' },
];

@Component({
  selector: 'lib-keyboard-shortcuts',
  imports: [A11yModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div
          class="absolute inset-0 bg-black/40 dark:bg-black/60 animate-fade-in"
          aria-hidden="true"
          (click)="visible.set(false)"
        ></div>
        <div
          class="relative w-full max-w-sm mx-4 rounded-2xl bg-vv-surface dark:bg-slate-800 shadow-xl animate-scale-in p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard Shortcuts"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          tabindex="-1"
          (click)="$event.stopPropagation()"
          (keydown)="$event.stopPropagation()"
          (keydown.escape)="visible.set(false)"
        >
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">Keyboard Shortcuts</h2>
            <button
              type="button"
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              cdkFocusInitial
              (click)="visible.set(false)"
              aria-label="Close"
            >
              <i class="pi pi-times text-sm text-slate-500" aria-hidden="true"></i>
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Global</h3>
              @for (s of globalShortcuts; track s.keys) {
                <div class="flex items-center justify-between py-1.5">
                  <span class="text-sm text-slate-700 dark:text-slate-300">{{ s.description }}</span>
                  <kbd class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">{{ s.keys }}</kbd>
                </div>
              }
            </div>
            <div>
              <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Quiz</h3>
              @for (s of quizShortcuts; track s.keys) {
                <div class="flex items-center justify-between py-1.5">
                  <span class="text-sm text-slate-700 dark:text-slate-300">{{ s.description }}</span>
                  <kbd class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">{{ s.keys }}</kbd>
                </div>
              }
            </div>
            <div>
              <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Dictionary</h3>
              @for (s of dictShortcuts; track s.keys) {
                <div class="flex items-center justify-between py-1.5">
                  <span class="text-sm text-slate-700 dark:text-slate-300">{{ s.description }}</span>
                  <kbd class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">{{ s.keys }}</kbd>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class KeyboardShortcuts {
  readonly visible = signal(false);
  protected readonly globalShortcuts = GLOBAL_SHORTCUTS;
  protected readonly quizShortcuts = QUIZ_SHORTCUTS;
  protected readonly dictShortcuts = DICTIONARY_SHORTCUTS;

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === '?' && !this.isInputFocused()) {
      event.preventDefault();
      this.visible.update((v) => !v);
    }
    if (event.key === 'Escape' && this.visible()) {
      this.visible.set(false);
    }
  }

  private isInputFocused(): boolean {
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }
}
