import type { ErrorEvent } from '@sentry/angular';
import { sentryBeforeSend } from './sentry-config';

function makeEvent(message: string): ErrorEvent {
  return {
    exception: {
      values: [{ value: message }],
    },
  } as ErrorEvent;
}

describe('sentryBeforeSend', () => {
  it('should drop "Word not found" errors (expected user action)', () => {
    const event = makeEvent('Word not found. Try a different spelling.');
    expect(sentryBeforeSend(event)).toBeNull();
  });

  it('should drop "Please enter a word" errors (empty input validation)', () => {
    const event = makeEvent('Please enter a word to look up');
    expect(sentryBeforeSend(event)).toBeNull();
  });

  it('should pass through rate limit errors (API health signal)', () => {
    const event = makeEvent('Rate limited while looking up "hello"');
    expect(sentryBeforeSend(event)).toBe(event);
  });

  it('should pass through connection errors (real issue)', () => {
    const event = makeEvent('Could not connect to dictionary. Check your internet connection.');
    expect(sentryBeforeSend(event)).toBe(event);
  });

  it('should pass through timeout errors (real issue)', () => {
    const event = makeEvent('Dictionary lookup timed out. Please try again.');
    expect(sentryBeforeSend(event)).toBe(event);
  });

  it('should pass through unexpected errors', () => {
    const event = makeEvent('Cannot read properties of undefined');
    expect(sentryBeforeSend(event)).toBe(event);
  });

  it('should pass through events with no exception values', () => {
    const event = {} as ErrorEvent;
    expect(sentryBeforeSend(event)).toBe(event);
  });

  it('should pass through events with empty exception values', () => {
    const event = { exception: { values: [] } } as ErrorEvent;
    expect(sentryBeforeSend(event)).toBe(event);
  });
});
