import { POS_ABBREV_SET, POS_ABBREV_TO_FULL } from './pos-abbreviations';
import { Word } from './models';

export interface ParsedMeaning {
  pos: string | null;
  posLabel: string | null;
  text: string;
}

export interface ParsedDefinition {
  meanings: ParsedMeaning[];
  hasStructure: boolean;
}

export function parseDefinition(
  definition: string | null | undefined,
): ParsedDefinition {
  if (!definition?.trim()) {
    return { meanings: [], hasStructure: false };
  }

  const segments = definition.split(' \u00B7 ');
  const meanings: ParsedMeaning[] = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const posMatch = trimmed.match(/^([a-z]+\.)\s+(.+)$/i);
    if (posMatch && POS_ABBREV_SET.has(posMatch[1].toLowerCase())) {
      const abbrev = posMatch[1].toLowerCase();
      meanings.push({
        pos: abbrev,
        posLabel: POS_ABBREV_TO_FULL[abbrev] ?? null,
        text: posMatch[2],
      });
    } else {
      meanings.push({ pos: null, posLabel: null, text: trimmed });
    }
  }

  return {
    meanings,
    hasStructure: meanings.some((m) => m.pos !== null),
  };
}

export function getQuizMeaning(
  word: Pick<Word, 'definition' | 'quizMeaningIndex'>,
): ParsedMeaning {
  const parsed = parseDefinition(word.definition);
  const idx = word.quizMeaningIndex ?? 0;
  return (
    parsed.meanings[idx] ??
    parsed.meanings[0] ?? { pos: null, posLabel: null, text: word.definition ?? '' }
  );
}

export function getQuizExample(
  word: Pick<Word, 'examples' | 'quizMeaningIndex'>,
): string | undefined {
  const idx = word.quizMeaningIndex ?? 0;
  return word.examples[idx] ?? word.examples[0];
}

export function formatMeaning(meaning: ParsedMeaning): string {
  return meaning.pos ? `${meaning.pos} ${meaning.text}` : (meaning.text || '');
}

export function stringifyMeanings(meanings: ParsedMeaning[]): string {
  return meanings.map(formatMeaning).join(' · ');
}

export function removeMeaning(definition: string, text: string): string {
  const target = text.trim().toLowerCase();
  const { meanings } = parseDefinition(definition);
  const filtered = meanings.filter((m) => m.text.trim().toLowerCase() !== target);
  return stringifyMeanings(filtered);
}
