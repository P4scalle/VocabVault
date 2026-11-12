import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { BottomSheet } from '../bottom-sheet/bottom-sheet';
import { InfoContent } from '../info-content/info-content';

@Component({
  selector: 'lib-info-drawer',
  template: `
    <lib-bottom-sheet [visible]="!!topic()" (visibleChange)="topic.set(null)">
      @if (topic(); as t) {
        <lib-info-content [topic]="t" />
      }
    </lib-bottom-sheet>
  `,
  imports: [BottomSheet, InfoContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class InfoDrawer {
  readonly topic = model<string | null>(null);
}
