import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { BackHintService } from './back-hint.service';

@Component({
  selector: 'lib-page-header',
  imports: [],
  templateUrl: './page-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly showBack = input<boolean>(false);
  readonly backClicked = output<void>();
  protected readonly backHint = inject(BackHintService);
}
