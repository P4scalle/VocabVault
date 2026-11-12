import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Word, Folder, MASTERY_CONFIG, parseDefinition, POS_BADGE_CLASSES } from '@vocavault/data-access';
import { HoldButton, SearchHighlightPipe } from '@vocavault/ui';

export type { Word as MockWord };

@Component({
  selector: 'lib-word-card',
  imports: [HoldButton, SearchHighlightPipe],
  templateUrl: './word-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordCard {
  readonly word = input.required<Word>();
  readonly folder = input<Folder | undefined>(undefined);
  readonly selectable = input(false);
  readonly isSelected = input(false);
  readonly selected = output<Word>();
  readonly deleteRequested = output<Word>();
  readonly folderRequested = output<Word>();
  readonly selectionToggled = output<Word>();
  readonly flagToggled = output<Word>();
  readonly searchQuery = input('');

  protected readonly isFlagged = computed(() => this.word().flag != null);

  protected readonly badgeClass = computed(() =>
    MASTERY_CONFIG[this.word().masteryLevel].badgeClass,
  );

  protected readonly masteryLabel = computed(() =>
    MASTERY_CONFIG[this.word().masteryLevel].label,
  );

  protected readonly parsed = computed(() =>
    parseDefinition(this.word().definition),
  );

  protected readonly primaryMeaning = computed(() =>
    this.parsed().meanings[0] ?? null,
  );

  protected readonly secondaryMeanings = computed(() =>
    this.parsed().meanings.slice(1),
  );

  protected readonly firstExample = computed(() =>
    this.word().examples?.[0] ?? null,
  );

  protected readonly posBadgeClass = (pos: string | null): string =>
    pos
      ? POS_BADGE_CLASSES[pos] ??
        'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
      : '';

}
