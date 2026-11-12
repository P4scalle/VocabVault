import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'lib-empty-state',
  imports: [],
  templateUrl: './empty-state.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly iconClass = input<string>('pi pi-inbox');
  readonly heading = input.required<string>();
  readonly body = input<string>('');
  readonly actionLabel = input<string>('');
  readonly action = output<void>();
}
