import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Word, MASTERY_CONFIG } from '@vocavault/data-access';
import { SearchHighlightPipe } from '@vocavault/ui';

@Component({
  selector: 'lib-folder-word-item',
  imports: [SearchHighlightPipe],
  templateUrl: './folder-word-item.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolderWordItem {
  readonly word = input.required<Word>();
  readonly searchQuery = input('');
  readonly selected = output<Word>();
  readonly removeFromFolder = output<Word>();

  protected readonly badgeClass = computed(() =>
    MASTERY_CONFIG[this.word().masteryLevel].badgeClass,
  );

  protected readonly masteryLabel = computed(() =>
    MASTERY_CONFIG[this.word().masteryLevel].label,
  );
}
