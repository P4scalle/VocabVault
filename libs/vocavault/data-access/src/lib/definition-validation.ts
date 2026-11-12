export const DEFINITION_BLOCKLIST = [
  'definition',
  'placeholder',
  'test',
  'meaning',
  'word',
  'example',
  'description',
  'enter definition',
  'type here',
  'add definition',
  'your definition',
  'write definition',
  'tbd',
  'todo',
  'n/a',
  'none',
  'xxx',
  'abc',
  'lorem',
  'ipsum',
  'sample',
  'demo',
] as const;

export const DEFINITION_MIN_LENGTH = 3;

/**
 * Returns true when `text` is a placeholder/junk definition that should not
 * be treated as a real definition.
 *
 * Rejects:
 * - Strings shorter than DEFINITION_MIN_LENGTH (after trimming)
 * - Exact matches (case-insensitive) against DEFINITION_BLOCKLIST
 * - Repeated-character strings like "aaa", "...", "!!!"
 */
export function isPlaceholderDefinition(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < DEFINITION_MIN_LENGTH) return true;
  const lower = trimmed.toLowerCase();
  if (DEFINITION_BLOCKLIST.some((b) => lower === b)) return true;
  if (/^(.)\1{2,}$/.test(trimmed)) return true;
  return false;
}
