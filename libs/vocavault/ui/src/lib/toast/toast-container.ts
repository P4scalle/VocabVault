import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { ToastService, ToastType } from './toast.service';

/** Static class map per toast type — avoids 18 conditional bindings in the template */
const TOAST_VARIANTS: Record<ToastType, { bg: string; iconClass: string; iconColor: string; textColor: string; btnColor: string }> = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900/80 border-l-green-500 border-green-200 dark:border-green-700',
    iconClass: 'pi pi-check-circle',
    iconColor: 'text-green-600 dark:text-green-400',
    textColor: 'text-green-800 dark:text-green-200',
    btnColor: 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 focus-visible:ring-green-400',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/80 border-l-red-500 border-red-200 dark:border-red-700',
    iconClass: 'pi pi-times-circle',
    iconColor: 'text-red-600 dark:text-red-400',
    textColor: 'text-red-800 dark:text-red-200',
    btnColor: 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus-visible:ring-red-400',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/80 border-l-blue-500 border-blue-200 dark:border-blue-700',
    iconClass: 'pi pi-info-circle',
    iconColor: 'text-blue-600 dark:text-blue-400',
    textColor: 'text-blue-800 dark:text-blue-200',
    btnColor: 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus-visible:ring-blue-400',
  },
};

@Component({
  selector: 'lib-toast-container',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes slide-down {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .animate-slide-down {
        animation: slide-down 0.2s ease-out forwards;
      }
    `,
  ],
  template: `
    <div
      class="fixed right-4 z-50 flex flex-col gap-2 w-full max-w-xs pointer-events-none"
      style="top: calc(1rem + var(--vv-nav-height, 0px))"
      aria-live="polite"
      aria-label="Notifications"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="animate-slide-down pointer-events-auto flex items-center gap-3 rounded-xl shadow-lg border-l-4 px-4 py-3 backdrop-blur-sm"
          [class]="variant(toast.type).bg"
          role="status"
        >
          <i
            [class]="variant(toast.type).iconClass + ' ' + variant(toast.type).iconColor + ' text-base flex-shrink-0'"
            aria-hidden="true"
          ></i>
          <span
            class="flex-1 text-sm font-medium"
            [class]="variant(toast.type).textColor"
          >{{ toast.message }}</span>
          @if (toast.action) {
            <button
              type="button"
              class="flex-shrink-0 text-xs font-bold underline transition-colors"
              [class.text-green-700]="toast.type === 'success'" [class.dark:text-green-300]="toast.type === 'success'"
              [class.text-red-700]="toast.type === 'error'" [class.dark:text-red-300]="toast.type === 'error'"
              [class.text-blue-700]="toast.type === 'info'" [class.dark:text-blue-300]="toast.type === 'info'"
              (click)="toast.action.callback(); toastService.dismiss(toast.id)"
            >{{ toast.action.label }}</button>
          }
          <button
            type="button"
            class="flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 rounded"
            [class]="variant(toast.type).btnColor"
            [attr.aria-label]="'Dismiss notification: ' + toast.message"
            (click)="toastService.dismiss(toast.id)"
          >
            <i class="pi pi-times text-xs" aria-hidden="true"></i>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  protected readonly toastService = inject(ToastService);

  protected variant(type: ToastType) {
    return TOAST_VARIANTS[type];
  }
}
