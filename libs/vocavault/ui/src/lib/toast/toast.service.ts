import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: { label: string; callback: () => void };
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(
    message: string,
    type: ToastType = 'success',
    duration = 3000,
  ): void {
    const id = crypto.randomUUID();
    this._toasts.update((t) => [...t, { id, message, type }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  /** Show a toast with an action button (e.g. "Undo") */
  showWithAction(
    message: string,
    action: { label: string; callback: () => void },
    type: ToastType = 'success',
    duration = 6000,
  ): void {
    const id = crypto.randomUUID();
    this._toasts.update((t) => [...t, { id, message, type, action }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  dismiss(id: string): void {
    this._toasts.update((t) => t.filter((toast) => toast.id !== id));
  }
}
