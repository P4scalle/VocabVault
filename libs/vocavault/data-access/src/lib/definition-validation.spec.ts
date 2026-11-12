import {
  isPlaceholderDefinition,
  DEFINITION_BLOCKLIST,
  DEFINITION_MIN_LENGTH,
} from './definition-validation';

describe('isPlaceholderDefinition', () => {
  // ── Constants ────────────────────────────────────────────────

  describe('exports', () => {
    it('exports DEFINITION_MIN_LENGTH as 3', () => {
      expect(DEFINITION_MIN_LENGTH).toBe(3);
    });

    it('exports DEFINITION_BLOCKLIST as a non-empty array', () => {
      expect(Array.isArray(DEFINITION_BLOCKLIST)).toBe(true);
      expect(DEFINITION_BLOCKLIST.length).toBeGreaterThan(0);
    });
  });

  // ── Under minimum length ─────────────────────────────────────

  describe('strings under minimum length', () => {
    it('returns true for empty string', () => {
      expect(isPlaceholderDefinition('')).toBe(true);
    });

    it('returns true for single character', () => {
      expect(isPlaceholderDefinition('x')).toBe(true);
    });

    it('returns true for two characters', () => {
      expect(isPlaceholderDefinition('ab')).toBe(true);
    });

    it('returns true for whitespace-only string under min length', () => {
      expect(isPlaceholderDefinition('  ')).toBe(true);
    });

    it('returns false for exactly 3 characters (meets minimum)', () => {
      expect(isPlaceholderDefinition('cat')).toBe(false);
    });
  });

  // ── Blocklist: exact case-insensitive matches ───────────────

  describe('blocklist words (exact match, case-insensitive)', () => {
    it('returns true for "definition" (lowercase)', () => {
      expect(isPlaceholderDefinition('definition')).toBe(true);
    });

    it('returns true for "Definition" (title case)', () => {
      expect(isPlaceholderDefinition('Definition')).toBe(true);
    });

    it('returns true for "DEFINITION" (uppercase)', () => {
      expect(isPlaceholderDefinition('DEFINITION')).toBe(true);
    });

    it('returns true for "placeholder"', () => {
      expect(isPlaceholderDefinition('placeholder')).toBe(true);
    });

    it('returns true for "Test"', () => {
      expect(isPlaceholderDefinition('Test')).toBe(true);
    });

    it('returns true for "tbd"', () => {
      expect(isPlaceholderDefinition('tbd')).toBe(true);
    });

    it('returns true for "n/a"', () => {
      expect(isPlaceholderDefinition('n/a')).toBe(true);
    });

    it('returns true for "todo"', () => {
      expect(isPlaceholderDefinition('todo')).toBe(true);
    });

    it('returns true for "none"', () => {
      expect(isPlaceholderDefinition('none')).toBe(true);
    });

    it('returns true for "lorem"', () => {
      expect(isPlaceholderDefinition('lorem')).toBe(true);
    });

    it('returns true for "sample"', () => {
      expect(isPlaceholderDefinition('sample')).toBe(true);
    });
  });

  // ── Blocklist: substring does NOT trigger ───────────────────

  describe('blocklist words as substrings should NOT trigger', () => {
    it('returns false for "adj. very beautiful" (contains no blocklist exact match)', () => {
      expect(isPlaceholderDefinition('adj. very beautiful')).toBe(false);
    });

    it('returns false for "A testing environment for software" (contains "test" as substring)', () => {
      expect(isPlaceholderDefinition('A testing environment for software')).toBe(false);
    });

    it('returns false for "sample text in a longer sentence" (contains "sample" as substring)', () => {
      expect(isPlaceholderDefinition('sample text in a longer sentence')).toBe(false);
    });
  });

  // ── Repeated characters ───────────────────────────────────────

  describe('repeated character strings', () => {
    it('returns true for "aaa"', () => {
      expect(isPlaceholderDefinition('aaa')).toBe(true);
    });

    it('returns true for "aaaa"', () => {
      expect(isPlaceholderDefinition('aaaa')).toBe(true);
    });

    it('returns true for "..."', () => {
      expect(isPlaceholderDefinition('...')).toBe(true);
    });

    it('returns true for "!!!"', () => {
      expect(isPlaceholderDefinition('!!!')).toBe(true);
    });

    it('returns true for "---"', () => {
      expect(isPlaceholderDefinition('---')).toBe(true);
    });

    it('returns true for "   " (3 spaces, single repeated char)', () => {
      // After trim this is empty (< min length), but repeating space also triggers length guard
      expect(isPlaceholderDefinition('   ')).toBe(true);
    });

    it('returns false for "abx" (not all same char, not blocklisted)', () => {
      expect(isPlaceholderDefinition('abx')).toBe(false);
    });
  });

  // ── Valid definitions ─────────────────────────────────────────

  describe('valid definitions (should return false)', () => {
    it('returns false for "Lasting only a short time"', () => {
      expect(isPlaceholderDefinition('Lasting only a short time')).toBe(false);
    });

    it('returns false for "A type of food"', () => {
      expect(isPlaceholderDefinition('A type of food')).toBe(false);
    });

    it('returns false for "adj. very beautiful"', () => {
      expect(isPlaceholderDefinition('adj. very beautiful')).toBe(false);
    });

    it('returns false for "The act of running quickly"', () => {
      expect(isPlaceholderDefinition('The act of running quickly')).toBe(false);
    });

    it('returns false for a multi-sentence definition', () => {
      expect(
        isPlaceholderDefinition(
          'A large aquatic mammal. Lives in the ocean and breathes air.',
        ),
      ).toBe(false);
    });

    it('returns false for "cat" (3-char word that is not blocklisted)', () => {
      expect(isPlaceholderDefinition('cat')).toBe(false);
    });
  });
});
