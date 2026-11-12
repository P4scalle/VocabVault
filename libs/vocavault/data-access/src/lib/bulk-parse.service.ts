import { Injectable } from '@angular/core';
import Papa from 'papaparse';

export type DetectedDelimiter = 'tab' | 'dash' | 'colon' | 'comma' | 'semicolon' | 'equals' | '';

/**
 * Natural-text separators to try when input has no standard CSV delimiter.
 * Order matters. Try the most unambiguous first.
 */
const SMART_SEPARATORS = [
  { label: 'dash' as DetectedDelimiter, sep: ' - ' },
  { label: 'dash' as DetectedDelimiter, sep: ' \u2014 ' },
  { label: 'dash' as DetectedDelimiter, sep: ' \u2013 ' },
  { label: 'colon' as DetectedDelimiter, sep: ': ' },
  { label: 'equals' as DetectedDelimiter, sep: ' = ' },
  { label: 'semicolon' as DetectedDelimiter, sep: '; ' },
] as const;

const SUPPORTED_EXTENSIONS = new Set(['csv', 'txt', 'xlsx', 'docx']);

/**
 * Try to split lines using natural-text separators (dash, colon, etc.).
 * Returns parsed data and detected delimiter label, or null if no match.
 */
function trySplitLines(
  lines: string[]
): { data: string[][]; delimiter: DetectedDelimiter } | null {
  if (lines.length === 0) return null;

  for (const { label, sep } of SMART_SEPARATORS) {
    let matchCount = 0;
    const parsed: string[][] = [];

    for (const line of lines) {
      const idx = line.indexOf(sep);
      if (idx === -1) {
        parsed.push([line.trim(), '']);
        continue;
      }

      const left = line.slice(0, idx).trim();
      const right = line.slice(idx + sep.length).trim();

      // Left side should be a word or short phrase (≤5 words)
      const wordCount = left.split(/\s+/).length;
      if (left && right && wordCount <= 5) {
        parsed.push([left, right]);
        matchCount++;
      } else {
        parsed.push([line.trim(), '']);
      }
    }

    // Accept if at least 1 line matched (for small inputs) or ≥50% for larger ones
    const threshold = lines.length <= 3 ? 1 / lines.length : 0.5;
    if (matchCount > 0 && matchCount / lines.length >= threshold) {
      return { data: parsed, delimiter: label };
    }
  }

  return null;
}

/**
 * After a primary separator is chosen, check if any other separators
 * would match lines that didn't match the primary one.
 * Returns labels of other separators found (empty if input is consistent).
 */
function detectMixedSeparators(
  lines: string[],
  primaryLabel: DetectedDelimiter
): DetectedDelimiter[] {
  // Find lines that did NOT match the primary separator
  const primarySeps = SMART_SEPARATORS.filter((s) => s.label === primaryLabel);
  const unmatchedLines = lines.filter((line) => {
    for (const { sep } of primarySeps) {
      const idx = line.indexOf(sep);
      if (idx !== -1) {
        const left = line.slice(0, idx).trim();
        const right = line.slice(idx + sep.length).trim();
        if (left && right && left.split(/\s+/).length <= 5) return false;
      }
    }
    return true;
  });

  if (unmatchedLines.length === 0) return [];

  // Check which other separators match unmatched lines
  const otherLabels = new Set<DetectedDelimiter>();
  const otherSeps = SMART_SEPARATORS.filter((s) => s.label !== primaryLabel);

  for (const line of unmatchedLines) {
    for (const { label, sep } of otherSeps) {
      if (otherLabels.has(label)) continue;
      const idx = line.indexOf(sep);
      if (idx === -1) continue;
      const left = line.slice(0, idx).trim();
      const right = line.slice(idx + sep.length).trim();
      if (left && right && left.split(/\s+/).length <= 5) {
        otherLabels.add(label);
      }
    }
  }

  return Array.from(otherLabels);
}

export interface ParseTextResult {
  data: string[][];
  delimiter: DetectedDelimiter | string;
  wordsOnly: boolean;
  mixedSeparators: DetectedDelimiter[];
}

@Injectable({ providedIn: 'root' })
export class BulkParseService {
  parseText(text: string, overrideDelimiter?: DetectedDelimiter | string): ParseTextResult {
    const result = Papa.parse<string[]>(text, {
      delimiter: overrideDelimiter ?? '',
      skipEmptyLines: 'greedy',
      header: false,
      dynamicTyping: false,
    });

    const data = result.data as string[][];
    const papaDelim = result.meta.delimiter ?? '';

    const rawLines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (overrideDelimiter) {
      return { data, delimiter: overrideDelimiter, wordsOnly: false, mixedSeparators: [] };
    }

    const multiColCount = data.filter((row) => row.length > 1 && row[1]?.trim()).length;
    const multiColRatio = data.length > 0 ? multiColCount / data.length : 0;

    const smartResult = trySplitLines(rawLines);

    if (smartResult) {
      const mixed = detectMixedSeparators(rawLines, smartResult.delimiter);
      return { data: smartResult.data, delimiter: smartResult.delimiter, wordsOnly: false, mixedSeparators: mixed };
    } else if (papaDelim === '\t' && multiColRatio >= 0.5) {
      return { data, delimiter: '\t', wordsOnly: false, mixedSeparators: [] };
    } else if (multiColRatio >= 0.5 && papaDelim) {
      return { data, delimiter: papaDelim === ',' ? 'comma' : papaDelim, wordsOnly: false, mixedSeparators: [] };
    } else {
      return { data, delimiter: '', wordsOnly: true, mixedSeparators: [] };
    }
  }

  async parseFile(file: File): Promise<{ ok: true; result: ParseTextResult } | { ok: false; error: string }> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return { ok: false, error: `Unsupported file type ".${ext}". Use .csv, .txt, .xlsx, or .docx files.` };
    }

    if (ext === 'docx') {
      try {
        const buffer = await file.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        return { ok: true, result: this.parseText(result.value) };
      } catch {
        return { ok: false, error: 'Could not read .docx file. Make sure the file is a valid Word document with readable text content.' };
      }
    }

    if (ext === 'xlsx') {
      try {
        const buffer = await file.arrayBuffer();
        const { read, utils } = await import('xlsx');
        const wb = read(buffer);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
        const rows = data.filter((row) => row.length > 0 && row[0]);
        return { ok: true, result: { data: rows, delimiter: '', wordsOnly: false, mixedSeparators: [] } };
      } catch {
        return { ok: false, error: 'Could not read .xlsx file. Expected format: Column A = word, Column B = definition.' };
      }
    }

    return new Promise((resolve) => {
      Papa.parse(file, {
        delimiter: '',
        skipEmptyLines: 'greedy',
        header: false,
        dynamicTyping: false,
        complete: (result) => {
          const data = result.data as string[][];
          if (data.length === 0) {
            const hint = ext === 'csv'
              ? ' Expected format: word,definition (one per line).'
              : ' Expected format: word - definition (one per line).';
            resolve({ ok: false, error: `File appears empty or unreadable.${hint}` });
            return;
          }
          const delimiter = result.meta.delimiter ?? '';
          const multiColCount = data.filter((row) => row.length > 1 && row[1]?.trim()).length;
          const wordsOnly = data.length > 0 ? multiColCount / data.length < 0.5 : true;
          resolve({ ok: true, result: { data, delimiter, wordsOnly, mixedSeparators: [] } });
        },
        error: () => {
          const hint = ext === 'csv'
            ? ' Expected format: word,definition (one per line).'
            : ' Expected format: word - definition (one per line).';
          resolve({ ok: false, error: `Could not read .${ext} file.${hint}` });
        },
      });
    });
  }
}
