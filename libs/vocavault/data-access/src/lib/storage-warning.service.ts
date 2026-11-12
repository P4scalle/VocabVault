import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';

const STORAGE_WARNING_THRESHOLD = 80;

@Injectable({ providedIn: 'root' })
export class StorageWarningService {
  private readonly storage = inject(StorageService);
  private warnedThisSession = false;

  checkAndWarn(): { warning: boolean; percent: number } {
    if (this.warnedThisSession) return { warning: false, percent: 0 };
    const percent = this.storage.getUsagePercent();
    if (percent >= STORAGE_WARNING_THRESHOLD) {
      this.warnedThisSession = true;
      return { warning: true, percent: Math.round(percent) };
    }
    return { warning: false, percent: Math.round(percent) };
  }
}
