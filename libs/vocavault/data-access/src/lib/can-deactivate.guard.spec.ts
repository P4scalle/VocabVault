// @vitest-environment jsdom
import { signal } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { unsavedChangesGuard, HasUnsavedChanges } from './can-deactivate.guard';

describe('unsavedChangesGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  function callGuard(component: HasUnsavedChanges) {
    return unsavedChangesGuard(component, route, state, state);
  }

  it('should allow navigation when hasUnsavedChanges is false', () => {
    expect(callGuard({ hasUnsavedChanges: signal(false) })).toBe(true);
  });

  it('should prompt when hasUnsavedChanges is true and user confirms', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(callGuard({ hasUnsavedChanges: signal(true) })).toBe(true);
    expect(window.confirm).toHaveBeenCalledWith('You have unsaved changes. Leave anyway?');
    vi.restoreAllMocks();
  });

  it('should block when hasUnsavedChanges is true and user cancels', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(callGuard({ hasUnsavedChanges: signal(true) })).toBe(false);
    vi.restoreAllMocks();
  });

  it('should allow navigation when component has no hasUnsavedChanges property', () => {
    expect(callGuard({} as HasUnsavedChanges)).toBe(true);
  });
});
