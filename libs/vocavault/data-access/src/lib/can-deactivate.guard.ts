import { Signal } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

export interface HasUnsavedChanges {
  hasUnsavedChanges: Signal<boolean>;
}

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (
  component: HasUnsavedChanges,
) => {
  if (component?.hasUnsavedChanges?.()) {
    return window.confirm('You have unsaved changes. Leave anyway?');
  }
  return true;
};
