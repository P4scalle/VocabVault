import { normalizeHeadword } from './normalize-term';

describe('normalizeHeadword', () => {
  it('strips numbered list markers ("1." / "2)")', () => {
    expect(normalizeHeadword('1. Apple')).toBe('Apple');
    expect(normalizeHeadword('2) Banana')).toBe('Banana');
    expect(normalizeHeadword('141. Spoon')).toBe('Spoon');
  });

  it('strips bullet and dash markers', () => {
    expect(normalizeHeadword('- Apple')).toBe('Apple');
    expect(normalizeHeadword('• Banana')).toBe('Banana');
    expect(normalizeHeadword('– Orange')).toBe('Orange');
    expect(normalizeHeadword('* Pear')).toBe('Pear');
  });

  it('strips single-letter ordinals ("a." / "b)")', () => {
    expect(normalizeHeadword('a. Apple')).toBe('Apple');
    expect(normalizeHeadword('b) Banana')).toBe('Banana');
  });

  it('strips stacked markers', () => {
    expect(normalizeHeadword('1. - Apple')).toBe('Apple');
  });

  it('preserves decimals and marker-like tokens with no trailing space', () => {
    expect(normalizeHeadword('1.5 liters')).toBe('1.5 liters');
    expect(normalizeHeadword('3.14')).toBe('3.14');
  });

  it('leaves clean words untouched', () => {
    expect(normalizeHeadword('Apple')).toBe('Apple');
    expect(normalizeHeadword('ice cream')).toBe('ice cream');
  });

  it('trims and collapses internal whitespace', () => {
    expect(normalizeHeadword('  2.   Banana  split ')).toBe('Banana split');
  });

  it('never returns an empty string when the term is only a marker', () => {
    expect(normalizeHeadword('1.')).toBe('1.');
    expect(normalizeHeadword('-')).toBe('-');
  });

  it('is idempotent: f(f(x)) === f(x)', () => {
    for (const input of ['1. Apple', '- a. Banana', 'Orange', '2) 3) Grape', '1.5 L']) {
      const once = normalizeHeadword(input);
      expect(normalizeHeadword(once)).toBe(once);
    }
  });
});
