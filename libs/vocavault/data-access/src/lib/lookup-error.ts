import { RateLimitError } from './dictionary-api.service';

/**
 * Stable, user-facing reasons a dictionary lookup can fail. Stored on each row
 * so a failure is never silent — "word genuinely not in the dictionary" must
 * look different from "the service was unreachable" or "we were rate-limited".
 */
export type LookupFailureReason =
  | 'not-found'
  | 'rate-limited'
  | 'network'
  | 'timeout'
  | 'unexpected';

/** Short label shown next to "Lookup failed" in the UI. */
export const LOOKUP_FAILURE_LABEL: Record<LookupFailureReason, string> = {
  'not-found': 'not in dictionary',
  'rate-limited': 'rate limited — try again',
  network: 'no connection',
  timeout: 'timed out',
  unexpected: 'unexpected error',
};

/**
 * Classify a caught lookup error into a stable reason. Driven off the error
 * type and the messages thrown by DictionaryApiService.lookupFrom(), so a new
 * failure mode surfaces as 'unexpected' rather than masquerading as not-found.
 */
export function classifyLookupError(error: unknown): LookupFailureReason {
  if (error instanceof RateLimitError) return 'rate-limited';

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('not found')) return 'not-found';
  if (message.includes('timed out')) return 'timeout';
  if (message.includes('connect') || message.includes('internet')) return 'network';
  return 'unexpected';
}
