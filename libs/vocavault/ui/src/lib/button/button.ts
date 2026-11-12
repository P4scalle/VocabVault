import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

@Component({
  selector: 'lib-button',
  template: `
    <button
      [type]="type()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-disabled]="disabled() || null"
      [class]="hostClasses()"
    >
      <ng-content />
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly size = input<'sm' | 'md'>('md');
  readonly fullWidth = input(false);
  readonly ariaLabel = input<string>('');
  readonly styleClass = input<string>('');

  protected hostClasses(): string {
    const v = this.variant();
    const base = v === 'primary'
      ? 'vv-btn-primary'
      : v === 'danger'
        ? 'vv-btn-danger'
        : 'vv-btn-secondary';

    const sizeClass = this.size() === 'sm' ? 'text-sm py-2.5' : 'py-3';
    const width = this.fullWidth() ? 'w-full' : '';
    const extra = this.styleClass();

    return `${base} ${sizeClass} rounded-xl vv-focus-ring ${width} ${extra}`.trim().replace(/\s+/g, ' ');
  }
}
