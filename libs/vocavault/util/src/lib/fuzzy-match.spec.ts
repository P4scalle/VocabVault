import { fuzzyMatch } from './fuzzy-match';

describe('fuzzyMatch', () => {
  it('returns exact match for identical strings', () => {
    const result = fuzzyMatch('hello world', 'hello world');
    expect(result.exact).toBe(true);
    expect(result.close).toBe(true);
    expect(result.similarity).toBe(1);
  });

  it('returns exact match for case-insensitive match', () => {
    const result = fuzzyMatch('Hello World', 'hello world');
    expect(result.exact).toBe(true);
  });

  it('returns exact match with leading/trailing whitespace', () => {
    const result = fuzzyMatch('  hello world  ', 'hello world');
    expect(result.exact).toBe(true);
  });

  it('detects close match for small typo', () => {
    const result = fuzzyMatch('helo world', 'hello world');
    expect(result.exact).toBe(false);
    expect(result.close).toBe(true);
    expect(result.similarity).toBeGreaterThan(0.8);
  });

  it('detects close match for missing word', () => {
    // "a large building" vs "a large spacious building" - token overlap > 60%
    const result = fuzzyMatch('a large building', 'a large spacious building');
    expect(result.close).toBe(true);
  });

  it('returns not close for completely different strings', () => {
    const result = fuzzyMatch('apple', 'orange juice beverage');
    expect(result.exact).toBe(false);
    expect(result.close).toBe(false);
    expect(result.similarity).toBeLessThan(0.5);
  });

  it('handles empty input', () => {
    const result = fuzzyMatch('', 'hello');
    expect(result.exact).toBe(false);
    expect(result.close).toBe(false);
    expect(result.similarity).toBe(0);
  });

  it('handles empty answer', () => {
    const result = fuzzyMatch('hello', '');
    expect(result.exact).toBe(false);
    expect(result.close).toBe(false);
    expect(result.similarity).toBe(0);
  });

  it('handles both empty', () => {
    const result = fuzzyMatch('', '');
    expect(result.exact).toBe(true);
    expect(result.similarity).toBe(1);
  });

  it('accepts close match with transposed letters', () => {
    const result = fuzzyMatch('teh definition', 'the definition');
    expect(result.close).toBe(true);
  });

  it('rejects very different length strings', () => {
    const result = fuzzyMatch('a', 'a very long definition that is nothing like the input');
    expect(result.close).toBe(false);
  });

  it('handles punctuation differences gracefully via token overlap', () => {
    const result = fuzzyMatch('showing great courage', 'showing great courage.');
    // Edit distance is small (1 char), so should be close
    expect(result.close).toBe(true);
  });

  describe('diacritics handling', () => {
    it('treats "cafe" vs "café" as a close match', () => {
      const result = fuzzyMatch('cafe', 'café');
      expect(result.close).toBe(true);
    });

    it('treats "naive" vs "naïve" as a close match', () => {
      const result = fuzzyMatch('naive', 'naïve');
      expect(result.close).toBe(true);
    });

    it('treats "resume" vs "résumé" as a close match', () => {
      const result = fuzzyMatch('resume', 'résumé');
      expect(result.close).toBe(true);
    });

    it('treats "cliche" vs "cliché" as a close match', () => {
      const result = fuzzyMatch('cliche', 'cliché');
      expect(result.close).toBe(true);
    });

    it('treats "uber" vs "über" as a close match', () => {
      const result = fuzzyMatch('uber', 'über');
      expect(result.close).toBe(true);
    });

    it('returns exact match when diacritics are the only difference', () => {
      // After normalization, "cafe" and "café" should be exact matches
      const result = fuzzyMatch('cafe', 'café');
      expect(result.exact).toBe(true);
      expect(result.similarity).toBe(1);
    });
  });
});
