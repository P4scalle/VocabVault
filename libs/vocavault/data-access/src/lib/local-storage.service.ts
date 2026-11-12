import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';
import { deserialize } from './serialization';

@Injectable({ providedIn: 'root' })
export class LocalStorageService extends StorageService {
  get<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return deserialize<T>(raw);
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }

  clear(): void {
    localStorage.clear();
  }

  getUsagePercent(): number {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) total += (localStorage.getItem(key) ?? '').length;
    }
    // localStorage limit is ~5MB, chars are 2 bytes in UTF-16
    return (total * 2) / (5 * 1024 * 1024) * 100;
  }
}
