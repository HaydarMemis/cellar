import { Amount, Unit } from './types';

const ML_PER_OZ = 29.5735;

export type UnitPreference = 'ml' | 'oz';

export interface DisplayAmount {
  value: number;
  unit: Unit;
}

/**
 * Converts ml <-> oz for display; every other unit passes through unchanged.
 * Returns a bare numeric value and unit id — no language-specific text.
 * The unit's translated word and locale-formatted number are resolved by
 * the presentation layer (see src/i18n), keeping this function free of any
 * hardcoded language.
 */
export function computeDisplayAmount(amount: Amount, preference: UnitPreference): DisplayAmount {
  if (amount.unit === 'ml' && preference === 'oz') {
    return { value: roundToQuarter(amount.value / ML_PER_OZ), unit: 'oz' };
  }
  if (amount.unit === 'oz' && preference === 'ml') {
    return { value: Math.round(amount.value * ML_PER_OZ), unit: 'ml' };
  }
  return { value: amount.value, unit: amount.unit };
}

function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}
