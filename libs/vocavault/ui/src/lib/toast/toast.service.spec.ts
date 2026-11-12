import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn()
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3')
        .mockReturnValue('uuid-fallback'),
    });

    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should add a toast to the signal on show()', () => {
    service.show('Hello');

    expect(service.toasts()).toEqual([
      { id: 'uuid-1', message: 'Hello', type: 'success' },
    ]);
  });

  it('should default to success type', () => {
    service.show('Done');

    expect(service.toasts()[0].type).toBe('success');
  });

  it('should accept error type', () => {
    service.show('Oops', 'error');

    expect(service.toasts()[0].type).toBe('error');
  });

  it('should accept info type', () => {
    service.show('FYI', 'info');

    expect(service.toasts()[0].type).toBe('info');
  });

  it('should accumulate multiple toasts', () => {
    service.show('First');
    service.show('Second');
    service.show('Third');

    expect(service.toasts().length).toBe(3);
    expect(service.toasts().map((t) => t.message)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });

  it('should dismiss a toast by ID', () => {
    service.show('Keep me');
    service.show('Remove me');

    expect(service.toasts().length).toBe(2);

    service.dismiss('uuid-2');

    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('Keep me');
  });

  it('should auto-dismiss after the default duration (3000ms)', () => {
    service.show('Temporary');

    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(2999);
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts().length).toBe(0);
  });

  it('should auto-dismiss after a custom duration', () => {
    service.show('Quick', 'info', 1000);

    vi.advanceTimersByTime(999);
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts().length).toBe(0);
  });

  it('should handle dismiss of non-existent ID gracefully', () => {
    service.show('Exists');

    service.dismiss('non-existent');

    expect(service.toasts().length).toBe(1);
  });

  describe('showWithAction', () => {
    it('stores action object in toast', () => {
      const callback = vi.fn();
      service.showWithAction('msg', { label: 'Undo', callback });

      const toast = service.toasts()[0];
      expect(toast.message).toBe('msg');
      expect(toast.action).toBeDefined();
      const action = toast.action;
      expect(action?.label).toBe('Undo');
      expect(action?.callback).toBe(callback);
    });

    it('uses 6000ms default duration', () => {
      service.showWithAction('Timed', { label: 'Undo', callback: vi.fn() });

      expect(service.toasts().length).toBe(1);

      vi.advanceTimersByTime(5999);
      expect(service.toasts().length).toBe(1);

      vi.advanceTimersByTime(1);
      expect(service.toasts().length).toBe(0);
    });

    it('accepts custom duration', () => {
      service.showWithAction('Quick', { label: 'Undo', callback: vi.fn() }, 'info', 2000);

      vi.advanceTimersByTime(1999);
      expect(service.toasts().length).toBe(1);

      vi.advanceTimersByTime(1);
      expect(service.toasts().length).toBe(0);
    });
  });
});
