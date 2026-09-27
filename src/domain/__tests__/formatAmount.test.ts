import { computeDisplayAmount } from '../formatAmount';

describe('computeDisplayAmount', () => {
  it('passes ml through unchanged when preference is ml', () => {
    expect(computeDisplayAmount({ value: 60, unit: 'ml' }, 'ml')).toEqual({ value: 60, unit: 'ml' });
  });

  it('converts ml to oz, rounded to the nearest quarter', () => {
    expect(computeDisplayAmount({ value: 60, unit: 'ml' }, 'oz')).toEqual({ value: 2, unit: 'oz' });
    expect(computeDisplayAmount({ value: 22, unit: 'ml' }, 'oz')).toEqual({ value: 0.75, unit: 'oz' });
  });

  it('converts oz to ml, rounded to the nearest whole number', () => {
    expect(computeDisplayAmount({ value: 2, unit: 'oz' }, 'ml')).toEqual({ value: 59, unit: 'ml' });
  });

  it('leaves non-volume units (dash, leaf, tsp) untouched regardless of preference', () => {
    expect(computeDisplayAmount({ value: 2, unit: 'dash' }, 'oz')).toEqual({ value: 2, unit: 'dash' });
    expect(computeDisplayAmount({ value: 8, unit: 'leaf' }, 'oz')).toEqual({ value: 8, unit: 'leaf' });
  });
});
