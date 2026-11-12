import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');

    // Mock matchMedia for jsdom
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    service = TestBed.inject(ThemeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('defaults to system mode when no stored preference', () => {
    expect(service.mode()).toBe('system');
  });

  it('toggle switches to dark', () => {
    service.toggle();
    expect(service.mode()).toBe('dark');
  });

  it('toggle from dark goes to light', () => {
    service.setMode('dark');
    service.toggle();
    expect(service.mode()).toBe('light');
  });

  it('setMode updates mode signal', () => {
    service.setMode('dark');
    expect(service.mode()).toBe('dark');
    expect(service.isDark()).toBe(true);
  });

  it('isDark is false when mode is light', () => {
    service.setMode('light');
    expect(service.isDark()).toBe(false);
  });

  it('isDark is false for system mode when system prefers light', () => {
    service.setMode('system');
    // matchMedia returns false for prefers-color-scheme: dark
    expect(service.isDark()).toBe(false);
  });
});
