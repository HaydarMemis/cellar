import { formatQuantity, getHouseholdApproximation } from '../measurementApproximation';

describe('getHouseholdApproximation', () => {
  it('approximates a small amount as teaspoons', () => {
    expect(getHouseholdApproximation({ value: 5, unit: 'ml' })).toEqual({ unit: 'tsp', value: 1 });
  });

  it('approximates 7.5 ml as one and a half teaspoons', () => {
    expect(getHouseholdApproximation({ value: 7.5, unit: 'ml' })).toEqual({ unit: 'tsp', value: 1.5 });
  });

  it('approximates 15 ml as one tablespoon', () => {
    expect(getHouseholdApproximation({ value: 15, unit: 'ml' })).toEqual({ unit: 'tbsp', value: 1 });
  });

  it('recognizes a standard 30 ml pour as one shot', () => {
    expect(getHouseholdApproximation({ value: 30, unit: 'ml' })).toEqual({ unit: 'shot', value: 1 });
  });

  it('treats values within tolerance of 30 ml as one shot too', () => {
    expect(getHouseholdApproximation({ value: 28, unit: 'ml' })).toEqual({ unit: 'shot', value: 1 });
    expect(getHouseholdApproximation({ value: 32, unit: 'ml' })).toEqual({ unit: 'shot', value: 1 });
  });

  it('approximates larger amounts in ounces', () => {
    expect(getHouseholdApproximation({ value: 60, unit: 'ml' })).toEqual({ unit: 'oz', value: 2 });
  });

  it('converts cl to ml before approximating', () => {
    expect(getHouseholdApproximation({ value: 1.5, unit: 'cl' })).toEqual({ unit: 'tbsp', value: 1 });
  });

  it('converts an oz amount before approximating', () => {
    // 2 oz ≈ 59.15 ml → well outside the shot tolerance band, falls in the oz tier.
    expect(getHouseholdApproximation({ value: 2, unit: 'oz' })).toEqual({ unit: 'oz', value: 2 });
  });

  it('recognizes that 1 oz is close enough to a standard shot to be called one', () => {
    // 1 oz ≈ 29.57 ml, within tolerance of the 30 ml shot — this is accurate bartending knowledge, not a bug.
    expect(getHouseholdApproximation({ value: 1, unit: 'oz' })).toEqual({ unit: 'shot', value: 1 });
  });

  it('returns null for units that are already practical (dash, piece, leaf, barspoon, tsp, rinse)', () => {
    expect(getHouseholdApproximation({ value: 2, unit: 'dash' })).toBeNull();
    expect(getHouseholdApproximation({ value: 1, unit: 'piece' })).toBeNull();
    expect(getHouseholdApproximation({ value: 8, unit: 'leaf' })).toBeNull();
    expect(getHouseholdApproximation({ value: 1, unit: 'barspoon' })).toBeNull();
    expect(getHouseholdApproximation({ value: 1, unit: 'tsp' })).toBeNull();
    expect(getHouseholdApproximation({ value: 1, unit: 'rinse' })).toBeNull();
  });

  it('returns null for a large top-up pour where approximation is not useful', () => {
    expect(getHouseholdApproximation({ value: 350, unit: 'ml' })).toBeNull();
  });

  it('returns null for a zero or negative amount', () => {
    expect(getHouseholdApproximation({ value: 0, unit: 'ml' })).toBeNull();
  });

  it('never produces more than two decimal digits of precision', () => {
    const result = getHouseholdApproximation({ value: 22, unit: 'ml' });
    expect(result).not.toBeNull();
    expect(Number.isInteger((result!.value * 100) as number)).toBe(true);
  });
});

describe('formatQuantity', () => {
  it('formats a whole number plainly', () => {
    expect(formatQuantity(2)).toBe('2');
    expect(formatQuantity(1)).toBe('1');
  });

  it('formats common fractions with glyphs', () => {
    expect(formatQuantity(0.25)).toBe('¼');
    expect(formatQuantity(0.5)).toBe('½');
    expect(formatQuantity(0.75)).toBe('¾');
    expect(formatQuantity(1.5)).toBe('1½');
    expect(formatQuantity(1.25)).toBe('1¼');
    expect(formatQuantity(1.75)).toBe('1¾');
  });

  it('falls back to a trimmed decimal for uncommon fractions', () => {
    expect(formatQuantity(1.1)).toBe('1.1');
  });
});
