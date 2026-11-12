import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChromeService } from './chrome.service';

describe('ChromeService', () => {
  let service: ChromeService;

  beforeEach(() => {
    service = TestBed.inject(ChromeService);
  });

  it('starts with focus mode off', () => {
    expect(service.focusMode()).toBe(false);
  });

  describe('imperative enter/leave', () => {
    it('enterFocus turns focus mode on, leaveFocus turns it off', () => {
      service.enterFocus();
      expect(service.focusMode()).toBe(true);
      service.leaveFocus();
      expect(service.focusMode()).toBe(false);
    });

    it('is idempotent — two enters need only one leave (boolean, not a counter)', () => {
      service.enterFocus();
      service.enterFocus();
      service.leaveFocus();
      expect(service.focusMode()).toBe(false);
    });
  });

  describe('registerFocusWhile', () => {
    it('reflects the source reactively — flipping the signal flips focus mode', () => {
      const unsaved = signal(false);
      service.registerFocusWhile(unsaved);

      expect(service.focusMode()).toBe(false);
      unsaved.set(true);
      expect(service.focusMode()).toBe(true);
      unsaved.set(false);
      expect(service.focusMode()).toBe(false);
    });

    it('unregistering removes the source so it no longer affects focus mode', () => {
      const unsaved = signal(true);
      const unregister = service.registerFocusWhile(unsaved);
      expect(service.focusMode()).toBe(true);

      unregister();
      expect(service.focusMode()).toBe(false);

      // Further changes to the detached source are ignored.
      unsaved.set(true);
      expect(service.focusMode()).toBe(false);
    });
  });

  describe('combined sources (OR semantics)', () => {
    it('is true while either the imperative flag or any registered source is true', () => {
      const a = signal(false);
      const b = signal(false);
      service.registerFocusWhile(a);
      service.registerFocusWhile(b);

      expect(service.focusMode()).toBe(false);

      service.enterFocus();
      expect(service.focusMode()).toBe(true);
      service.leaveFocus();
      expect(service.focusMode()).toBe(false);

      // With two sources, focus stays on until the last true one goes false —
      // guards against the computed dropping a dependency on short-circuit.
      a.set(true);
      expect(service.focusMode()).toBe(true);
      b.set(true);
      expect(service.focusMode()).toBe(true);
      a.set(false);
      expect(service.focusMode()).toBe(true);
      b.set(false);
      expect(service.focusMode()).toBe(false);
    });
  });
});
