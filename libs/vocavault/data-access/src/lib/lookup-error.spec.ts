import { classifyLookupError, LOOKUP_FAILURE_LABEL } from './lookup-error';
import { RateLimitError } from './dictionary-api.service';

describe('classifyLookupError', () => {
  it('classifies RateLimitError as rate-limited', () => {
    expect(classifyLookupError(new RateLimitError('apple'))).toBe('rate-limited');
  });

  it('classifies "Word not found" messages as not-found', () => {
    expect(classifyLookupError(new Error('Word not found. Try a different spelling.'))).toBe('not-found');
  });

  it('classifies timeout messages as timeout', () => {
    expect(classifyLookupError(new Error('Dictionary lookup timed out. Please try again.'))).toBe('timeout');
  });

  it('classifies connectivity messages as network', () => {
    expect(classifyLookupError(new Error('Could not connect to dictionary. Check your internet connection.'))).toBe('network');
  });

  it('falls back to unexpected for anything unrecognized', () => {
    expect(classifyLookupError(new Error('Unexpected response from dictionary API'))).toBe('unexpected');
    expect(classifyLookupError('a bare string')).toBe('unexpected');
    expect(classifyLookupError(null)).toBe('unexpected');
  });

  it('has a human-readable label for every reason it can return', () => {
    for (const reason of ['not-found', 'rate-limited', 'network', 'timeout', 'unexpected'] as const) {
      expect(LOOKUP_FAILURE_LABEL[reason]).toBeTruthy();
    }
  });
});
