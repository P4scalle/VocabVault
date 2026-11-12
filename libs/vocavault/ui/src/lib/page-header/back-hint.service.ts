import { Injectable, signal } from '@angular/core';

/**
 * Lightweight signal service to hint the user toward the back button.
 * The shell triggers it; PageHeader listens and plays a pulse animation.
 */
@Injectable({ providedIn: 'root' })
export class BackHintService {
  /** When true, the back button should pulse to draw attention */
  readonly pulse = signal(false);

  trigger(): void {
    this.pulse.set(true);
    setTimeout(() => this.pulse.set(false), 1200);
  }
}
