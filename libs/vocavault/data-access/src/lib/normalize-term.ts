/**
 * Shared, pure term normalization used by bulk import (for stored/displayed
 * words) and by the dictionary lookup (for the query sent to the API).
 *
 * Pasted vocab lists routinely carry leading list markers — "1. Apple",
 * "2) Banana", "- Orange", "• Grape", "a. Pear" — which make the dictionary
 * API 404 on every single entry. Stripping them here, at a single source of
 * truth, keeps the behaviour identical no matter where a term comes from.
 *
 * Deterministic and idempotent: normalizeHeadword(normalizeHeadword(x)) ===
 * normalizeHeadword(x). That property is what makes it safe to apply at both
 * the import layer and the lookup layer (defense-in-depth) without surprises.
 */

// A leading list marker: an ordinal number (1. / 12)), a single-letter
// ordinal (a. / b)), or a bullet/dash glyph — each followed by whitespace.
// The trailing-whitespace requirement is deliberate: it preserves real tokens
// like "1.5" (no space after the dot) that are not list markers.
const LEADING_LIST_MARKER = /^(?:\d{1,3}[.)]|[a-zA-Z][.)]|[-–—•·*▪◦‣])\s+/;

/**
 * Strip leading list markers from a term. Loops to handle stacked markers
 * (e.g. "1. - Apple"). Never returns an empty string: if stripping would
 * consume the whole token, the original is kept.
 */
export function normalizeHeadword(term: string): string {
  const trimmed = term.trim().replace(/\s+/g, ' ');
  let out = trimmed;
  let prev: string;
  do {
    prev = out;
    out = out.replace(LEADING_LIST_MARKER, '').trim();
  } while (out !== prev && out.length > 0);
  return out || trimmed;
}
