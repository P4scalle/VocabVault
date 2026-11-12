import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'lib-info-button',
  template: `
    <button
      type="button"
      class="w-8 h-8 flex items-center justify-center rounded-full text-vv-brand hover:bg-vv-brandLight dark:hover:bg-vv-brand/20 transition-colors vv-focus-ring"
      [attr.aria-label]="ariaLabel()"
    >
      <i class="pi pi-info-circle text-sm" aria-hidden="true"></i>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class InfoButton {
  readonly ariaLabel = input('More info');
}
