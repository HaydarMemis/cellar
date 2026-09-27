import { formatLocaleNumber } from '../formatNumber';

describe('formatLocaleNumber', () => {
  it('formats a whole number the same way in both locales', () => {
    expect(formatLocaleNumber(50, 'en')).toBe('50');
    expect(formatLocaleNumber(50, 'tr')).toBe('50');
  });

  it('uses a period decimal separator in English', () => {
    expect(formatLocaleNumber(2.5, 'en')).toBe('2.5');
  });

  it('uses a comma decimal separator in Turkish', () => {
    expect(formatLocaleNumber(2.5, 'tr')).toBe('2,5');
  });

  it('respects the maxFractionDigits cap', () => {
    expect(formatLocaleNumber(2.5, 'en', 0)).toBe('3'); // Intl rounds, doesn't truncate
    expect(formatLocaleNumber(2.333, 'en', 1)).toBe('2.3');
  });

  it('never throws on an unusual value', () => {
    expect(() => formatLocaleNumber(0, 'en')).not.toThrow();
    expect(() => formatLocaleNumber(-5, 'tr')).not.toThrow();
  });
});
