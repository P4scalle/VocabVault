import { DestroyRef, signal, Signal, WritableSignal } from '@angular/core';
import { StorageService } from './storage.service';
import { ISO_DATE_RE } from './serialization';

export interface PersistedSignalResult<T> {
  readonly value: Signal<T>;
  readonly _writable: WritableSignal<T>;
  persist(): boolean;
  update(fn: (current: T) => T): boolean;
  cleanup(): void;
}

export interface PersistedSignalOptions<T> {
  migrate?: (raw: T) => T;
  destroyRef?: DestroyRef;
}

export function persistedSignal<T>(
  storage: StorageService,
  key: string,
  defaultValue: T,
  options?: PersistedSignalOptions<T>,
): PersistedSignalResult<T> {
  const stored = storage.get<T>(key);
  let initial = stored ?? defaultValue;
  const didMigrate = options?.migrate && stored !== null;
  if (options?.migrate) {
    initial = options.migrate(initial);
  }

  const _writable = signal<T>(initial);

  const cleanupSync = syncAcrossTabs(key, _writable, options);

  const persist = () => storage.set(key, _writable());

  // Auto-persist after migration so callers don't need to
  if (didMigrate) {
    persist();
  }

  return {
    value: _writable.asReadonly(),
    _writable,
    persist,
    update(fn: (current: T) => T): boolean {
      const next = fn(_writable());
      const ok = storage.set(key, next);
      if (ok) _writable.set(next);
      return ok;
    },
    cleanup: cleanupSync,
  };
}

function syncAcrossTabs<T>(
  key: string,
  writable: WritableSignal<T>,
  options?: PersistedSignalOptions<T>,
): () => void {
  if (typeof window === 'undefined') return () => { /* no storage listener to tear down without window */ };

  const handler = (event: StorageEvent): void => {
    if (event.key !== key || event.newValue === null) return;
    try {
      let parsed = JSON.parse(event.newValue, (_k, v) =>
        typeof v === 'string' && ISO_DATE_RE.test(v) ? new Date(v) : v,
      ) as T;
      if (options?.migrate) parsed = options.migrate(parsed);
      writable.set(parsed);
    } catch {
      // ignore malformed data from other tabs
    }
  };

  window.addEventListener('storage', handler);
  options?.destroyRef?.onDestroy(() => window.removeEventListener('storage', handler));

  return () => window.removeEventListener('storage', handler);
}
