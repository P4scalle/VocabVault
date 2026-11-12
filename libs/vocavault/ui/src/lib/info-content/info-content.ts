import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { INFO_TOPICS } from './info-topics';

@Component({
  selector: 'lib-info-content',
  templateUrl: './info-content.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class InfoContent {
  readonly topic = input.required<string>();
  protected readonly data = computed(() => INFO_TOPICS[this.topic()] ?? null);
}
