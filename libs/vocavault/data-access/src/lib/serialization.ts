/** Matches ISO 8601 date strings for JSON reviver (validates realistic ranges) */
export const ISO_DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d/;

/** JSON reviver that auto-converts ISO date strings to Date objects */
export const jsonDateReviver = (_k: string, v: unknown): unknown =>
  typeof v === 'string' && ISO_DATE_RE.test(v) ? new Date(v) : v;

export const serialize = <T>(value: T): string => JSON.stringify(value);
export const deserialize = <T>(raw: string): T => JSON.parse(raw, jsonDateReviver) as T;
