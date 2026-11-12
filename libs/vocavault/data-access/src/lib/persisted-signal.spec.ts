import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { persistedSignal } from './persisted-signal';

describe('persistedSignal', () => {
  let storage: StorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageService, useClass: LocalStorageService },
      ],
    });
    storage = TestBed.inject(StorageService);
  });

  describe('initialization', () => {
    it('should use default value when storage key does not exist', () => {
      const ps = persistedSignal(storage, 'missing-key', 'default');
      expect(ps.value()).toBe('default');
    });

    it('should load value from storage when key exists', () => {
      storage.set('existing-key', 'stored-value');
      const ps = persistedSignal(storage, 'existing-key', 'default');
      expect(ps.value()).toBe('stored-value');
    });

    it('should use default value when storage returns null', () => {
      const ps = persistedSignal(storage, 'no-key', { items: [] });
      expect(ps.value()).toEqual({ items: [] });
    });

    it('should call migrate function during initialization', () => {
      storage.set('migrate-key', { version: 1, data: 'old' });
      const migrate = vi.fn((raw: { version: number; data: string }) => ({
        ...raw,
        version: 2,
      }));

      const ps = persistedSignal(storage, 'migrate-key', { version: 1, data: '' }, { migrate });

      expect(migrate).toHaveBeenCalledOnce();
      expect(migrate).toHaveBeenCalledWith({ version: 1, data: 'old' });
      expect(ps.value()).toEqual({ version: 2, data: 'old' });
    });

    it('should call migrate on default value when key does not exist', () => {
      const migrate = vi.fn((raw: string) => raw.toUpperCase());

      const ps = persistedSignal(storage, 'no-key', 'hello', { migrate });

      expect(migrate).toHaveBeenCalledWith('hello');
      expect(ps.value()).toBe('HELLO');
    });

    it('should NOT call migrate when no option is provided', () => {
      storage.set('key', 'value');
      const ps = persistedSignal(storage, 'key', 'default');

      // No migrate was passed, so value should be the raw stored value
      expect(ps.value()).toBe('value');
    });
  });

  describe('value', () => {
    it('should return a readonly signal with the current state', () => {
      const ps = persistedSignal(storage, 'key', 42);
      expect(ps.value()).toBe(42);

      // The readonly signal should reflect writes to _writable
      ps._writable.set(99);
      expect(ps.value()).toBe(99);
    });
  });

  describe('_writable', () => {
    it('should be a writable signal', () => {
      const ps = persistedSignal(storage, 'key', 'initial');

      ps._writable.set('changed');
      expect(ps._writable()).toBe('changed');
      expect(ps.value()).toBe('changed');
    });

    it('should NOT auto-persist when set directly', () => {
      const ps = persistedSignal(storage, 'key', 'initial');

      ps._writable.set('changed');
      // Storage should still have nothing (was never persisted)
      expect(storage.get('key')).toBeNull();
    });
  });

  describe('persist()', () => {
    it('should write the current value to storage', () => {
      const ps = persistedSignal(storage, 'key', 'initial');

      ps._writable.set('updated');
      ps.persist();

      expect(storage.get('key')).toBe('updated');
    });

    it('should persist the default value if nothing has changed', () => {
      const ps = persistedSignal(storage, 'key', 'default-val');

      ps.persist();

      expect(storage.get('key')).toBe('default-val');
    });

    it('should return true on successful persist', () => {
      const ps = persistedSignal(storage, 'key', 'val');
      expect(ps.persist()).toBe(true);
    });

    it('should return false when storage.set fails', () => {
      const failingStorage: StorageService = {
        get: () => null,
        set: () => false,
        remove: () => { /* mock: no-op */ },
        clear: () => { /* mock: no-op */ },
      };
      const ps = persistedSignal(failingStorage, 'key', 'val');
      expect(ps.persist()).toBe(false);
    });
  });

  describe('update()', () => {
    it('should apply the update function and auto-persist', () => {
      const ps = persistedSignal(storage, 'counter', 0);

      ps.update((current) => current + 1);

      expect(ps.value()).toBe(1);
      expect(storage.get('counter')).toBe(1);
    });

    it('should return true on successful update', () => {
      const ps = persistedSignal(storage, 'counter', 0);
      expect(ps.update((c) => c + 1)).toBe(true);
    });

    it('should return false when storage fails during update', () => {
      const failingStorage: StorageService = {
        get: () => null,
        set: () => false,
        remove: () => { /* mock: no-op */ },
        clear: () => { /* mock: no-op */ },
      };
      const ps = persistedSignal(failingStorage, 'key', 0);
      expect(ps.update((c) => c + 1)).toBe(false);
    });

    it('should NOT update the signal value when storage fails (atomic rollback)', () => {
      const failingStorage: StorageService = {
        get: () => null,
        set: () => false,
        remove: () => { /* mock: no-op */ },
        clear: () => { /* mock: no-op */ },
      };
      const ps = persistedSignal(failingStorage, 'key', 0);
      ps.update((c) => c + 1);
      expect(ps.value()).toBe(0);
    });

    it('should propagate exceptions from fn and leave signal unchanged', () => {
      const ps = persistedSignal(storage, 'throw-key', 'safe');
      expect(() =>
        ps.update(() => { throw new Error('boom'); })
      ).toThrow('boom');
      expect(ps.value()).toBe('safe');
      expect(storage.get('throw-key')).toBeNull();
    });

    it('should handle multiple chained update() calls', () => {
      const ps = persistedSignal(storage, 'counter', 0);

      ps.update((c) => c + 1);
      ps.update((c) => c + 10);
      ps.update((c) => c * 2);

      expect(ps.value()).toBe(22);
      expect(storage.get('counter')).toBe(22);
    });

    it('should work with arrays (push pattern)', () => {
      const ps = persistedSignal<string[]>(storage, 'list', []);

      ps.update((items) => [...items, 'apple']);
      ps.update((items) => [...items, 'banana']);
      ps.update((items) => [...items, 'cherry']);

      expect(ps.value()).toEqual(['apple', 'banana', 'cherry']);
      expect(storage.get<string[]>('list')).toEqual(['apple', 'banana', 'cherry']);
    });

    it('should work with objects (spread pattern)', () => {
      interface UserProfile {
        name: string;
        score: number;
        level: number;
      }

      const ps = persistedSignal<UserProfile>(storage, 'profile', {
        name: '',
        score: 0,
        level: 1,
      });

      ps.update((p) => ({ ...p, name: 'Alice' }));
      ps.update((p) => ({ ...p, score: p.score + 100 }));
      ps.update((p) => ({ ...p, level: p.level + 1 }));

      expect(ps.value()).toEqual({ name: 'Alice', score: 100, level: 2 });
      expect(storage.get<UserProfile>('profile')).toEqual({
        name: 'Alice',
        score: 100,
        level: 2,
      });
    });
  });

  describe('cross-tab sync via StorageEvent', () => {
    it('should update signal when another tab writes to same key', () => {
      const ps = persistedSignal(storage, 'sync-key', 'initial');
      expect(ps.value()).toBe('initial');

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'sync-key',
          newValue: JSON.stringify('from-other-tab'),
        })
      );

      expect(ps.value()).toBe('from-other-tab');
    });

    it('should ignore StorageEvents for different keys', () => {
      const ps = persistedSignal(storage, 'my-key', 'mine');

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'other-key',
          newValue: JSON.stringify('nope'),
        })
      );

      expect(ps.value()).toBe('mine');
    });

    it('should ignore StorageEvents with null newValue', () => {
      const ps = persistedSignal(storage, 'del-key', 'existing');

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'del-key',
          newValue: null,
        })
      );

      expect(ps.value()).toBe('existing');
    });

    it('should stop listening after cleanup()', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const ps = persistedSignal(storage, 'clean-key', 'before');
      ps.cleanup();

      expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function));

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'clean-key',
          newValue: JSON.stringify('after'),
        })
      );
      removeSpy.mockRestore();

      expect(ps.value()).toBe('before');
    });
  });

  describe('quota exceeded', () => {
    it('update() returns false and signal keeps old value when storage.set() returns false', () => {
      const ps = persistedSignal(storage, 'quota-key', 10);
      vi.spyOn(storage, 'set').mockReturnValue(false);

      const result = ps.update((val) => val + 5);

      expect(result).toBe(false);
      expect(ps.value()).toBe(10);
    });

    it('persist() returns false when storage.set() returns false but signal retains writable value', () => {
      const ps = persistedSignal(storage, 'quota-persist', 'original');
      ps._writable.set('updated-in-memory');
      vi.spyOn(storage, 'set').mockReturnValue(false);

      const result = ps.persist();

      expect(result).toBe(false);
      expect(ps.value()).toBe('updated-in-memory');
    });

    it('subsequent update works after quota is freed', () => {
      const ps = persistedSignal(storage, 'quota-recover', 0);
      const spy = vi.spyOn(storage, 'set').mockReturnValue(false);

      ps.update((c) => c + 1);
      expect(ps.value()).toBe(0);

      spy.mockRestore();

      const ok = ps.update((c) => c + 1);
      expect(ok).toBe(true);
      expect(ps.value()).toBe(1);
    });
  });

  describe('cross-tab sync conflicts', () => {
    it('should update signal when receiving valid JSON via StorageEvent', () => {
      const ps = persistedSignal(storage, 'conflict-key', { count: 0 });

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'conflict-key',
          newValue: JSON.stringify({ count: 42 }),
        })
      );

      expect(ps.value()).toEqual({ count: 42 });
    });

    it('should silently ignore malformed JSON in StorageEvent', () => {
      const ps = persistedSignal(storage, 'malformed-key', 'safe-value');

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'malformed-key',
          newValue: 'not-json{{{',
        })
      );

      expect(ps.value()).toBe('safe-value');
    });

    it('should ignore StorageEvent for a different key', () => {
      const ps = persistedSignal(storage, 'my-specific-key', 100);

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'some-other-key',
          newValue: JSON.stringify(999),
        })
      );

      expect(ps.value()).toBe(100);
    });

    it('should ignore StorageEvent with newValue=null', () => {
      const ps = persistedSignal(storage, 'null-event-key', 'keep-me');

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'null-event-key',
          newValue: null,
        })
      );

      expect(ps.value()).toBe('keep-me');
    });

    it('should handle rapid conflicting updates without crashing', () => {
      const ps = persistedSignal(storage, 'rapid-key', 0);

      for (let i = 1; i <= 10; i++) {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'rapid-key',
            newValue: JSON.stringify(i),
          })
        );
      }

      expect(ps.value()).toBe(10);
    });
  });

  describe('round-trip with storage', () => {
    it('should survive a full persist-then-reload cycle', () => {
      const ps1 = persistedSignal(storage, 'data', { count: 0 });
      ps1.update((d) => ({ count: d.count + 5 }));

      // Simulate "reload" by creating a new persisted signal with the same key
      const ps2 = persistedSignal(storage, 'data', { count: 0 });
      expect(ps2.value()).toEqual({ count: 5 });
    });
  });
});
