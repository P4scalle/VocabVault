/**
 * Returns true if the word starts with the query (case-insensitive),
 * or is an exact match.
 */
export function wordStartsWith(word: string, query: string): boolean {
  const w = word.toLowerCase();
  return w === query || w.startsWith(query);
}
