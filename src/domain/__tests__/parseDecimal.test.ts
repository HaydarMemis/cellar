import { parseDecimal } from '../parseDecimal';

describe('parseDecimal', () => {
  it('parses a plain integer', () => {
    expect(parseDecimal('50')).toBe(50);
  });

  it('parses a period-decimal value', () => {
    expect(parseDecimal('2.5')).toBe(2.5);
  });

  it('parses a comma-decimal value (Turkish keyboards)', () => {
    expect(parseDecimal('2,5')).toBe(2.5);
  });

  it('trims surrounding whitespace', () => {
    expect(parseDecimal('  18  ')).toBe(18);
  });

  it('returns null for empty input', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
  });

  it('returns null for non-numeric input instead of NaN', () => {
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('12abc')).toBeNull();
  });
});
