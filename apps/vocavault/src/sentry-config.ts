import type { ErrorEvent } from '@sentry/angular';

/** Filters out expected user-facing errors that aren't bugs */
export function sentryBeforeSend(event: ErrorEvent): ErrorEvent | null {
  const msg = event.exception?.values?.[0]?.value ?? '';
  if (msg.includes('Word not found') || msg.includes('Please enter a word')) {
    return null;
  }
  return event;
}
