// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from './local-storage.service';
import { StorageService } from './storage.service';

describe('LocalStorageService', () => {
  let service: LocalStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: StorageService, useClass: LocalStorageService },
      ],
    });
    service = TestBed.inject(StorageService) as LocalStorageService;
  });

  it('should return null when key is missing', () => {
    expect(service.get('nonexistent')).toBeNull();
  });

  it('should round-trip an object via JSON with set/get', () => {
    const obj = { name: 'test', value: 42, nested: { x: true } };
    service.set('test-key', obj);
    const result = service.get<typeof obj>('test-key');
    expect(result).toEqual(obj);
  });

  it('should return true on successful set', () => {
    expect(service.set('key', 'value')).toBe(true);
  });

  it('should return false when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(service.set('key', 'value')).toBe(false);
    vi.restoreAllMocks();
  });

  it('should remove a key', () => {
    service.set('to-remove', 'some value');
    expect(service.get('to-remove')).toBe('some value');
    service.remove('to-remove');
    expect(service.get('to-remove')).toBeNull();
  });

  it('should clear all keys', () => {
    service.set('key1', 'value1');
    service.set('key2', 'value2');
    service.clear();
    expect(service.get('key1')).toBeNull();
    expect(service.get('key2')).toBeNull();
  });

  it('should return null for malformed JSON', () => {
    localStorage.setItem('bad-json', 'not-json{{{');
    expect(service.get('bad-json')).toBeNull();
  });

  describe('getUsagePercent', () => {
    it('should return 0 when localStorage is empty', () => {
      localStorage.clear();
      expect(service.getUsagePercent()).toBe(0);
    });

    it('should return a positive number when localStorage has data', () => {
      localStorage.setItem('test', 'x'.repeat(1000));
      expect(service.getUsagePercent()).toBeGreaterThan(0);
    });

    it('should calculate usage as percentage of 5MB', () => {
      localStorage.clear();
      // Store 100 chars: 100 chars * 2 bytes = 200 bytes
      // 200 / (5 * 1024 * 1024) * 100 ~= 0.0038%
      localStorage.setItem('k', 'x'.repeat(100));
      const percent = service.getUsagePercent();
      // Key 'k' is 1 char, value is 100 chars = 101 chars total
      // But getUsagePercent only counts values, so 100 chars * 2 = 200 bytes
      expect(percent).toBeGreaterThan(0);
      expect(percent).toBeLessThan(1);
    });
  });

  describe('Date deserialization', () => {
    it('should round-trip an object with a Date property as instanceof Date', () => {
      const original = { createdAt: new Date('2025-06-15T10:30:00.000Z') };
      service.set('date-obj', original);

      const result = service.get<typeof original>('date-obj');
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.createdAt.toISOString()).toBe('2025-06-15T10:30:00.000Z');
    });

    it('should round-trip nested Date properties correctly', () => {
      const original = {
        profile: {
          updatedAt: new Date('2025-03-20T14:00:00.000Z'),
        },
      };
      service.set('nested-date', original);

      const result = service.get<typeof original>('nested-date');
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.profile.updatedAt).toBeInstanceOf(Date);
      expect(result.profile.updatedAt.toISOString()).toBe('2025-03-20T14:00:00.000Z');
    });

    it('should round-trip an array of objects with Dates correctly', () => {
      const original = [
        { word: 'hello', addedAt: new Date('2025-01-10T08:00:00.000Z') },
        { word: 'world', addedAt: new Date('2025-02-20T12:30:00.000Z') },
        { word: 'test', addedAt: new Date('2025-03-05T18:45:00.000Z') },
      ];
      service.set('date-array', original);

      const result = service.get<typeof original>('date-array');
      expect(result).not.toBeNull();
      expect(result).toHaveLength(3);
      if (!result) return;
      result.forEach((item, i) => {
        expect(item.addedAt).toBeInstanceOf(Date);
        expect(item.addedAt.toISOString()).toBe(original[i].addedAt.toISOString());
      });
    });

    it('should NOT convert date-only strings without T separator (e.g. "2025-02-01")', () => {
      const original = { dateStr: '2025-02-01' };
      service.set('date-only', original);

      const result = service.get<typeof original>('date-only');
      expect(result).not.toBeNull();
      if (!result) return;
      expect(typeof result.dateStr).toBe('string');
      expect(result.dateStr).toBe('2025-02-01');
    });

    it('should convert strings that match ISO date pattern with T separator', () => {
      // The regex /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ matches any string
      // starting with the ISO datetime pattern, so manually stored ISO strings
      // will be converted to Date objects on retrieval.
      const isoString = '2025-07-04T00:00:00.000Z';
      localStorage.setItem('iso-str', JSON.stringify({ ts: isoString }));

      const result = service.get<{ ts: Date | string }>('iso-str');
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.ts).toBeInstanceOf(Date);
    });
  });
});
