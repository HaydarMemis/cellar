import { Amount, Unit } from './types';

export type HouseholdUnit = 'tsp' | 'tbsp' | 'shot' | 'oz';

export interface HouseholdApproximation {
  unit: HouseholdUnit;
  value: number;
}

const ML_PER_OZ = 29.5735;
const ML_PER_TSP = 5;
const ML_PER_TBSP = 15;
const SHOT_ML = 30;
const SHOT_TOLERANCE_ML = 3;
/** Above this, a household approximation stops being useful (it's a top-up pour, not something anyone measures). */
const MAX_APPROXIMATABLE_ML = 200;

const VOLUME_UNITS: Unit[] = ['ml', 'cl', 'oz'];

function toMl(amount: Amount): number | null {
  switch (amount.unit) {
    case 'ml':
      return amount.value;
    case 'cl':
      return amount.value * 10;
    case 'oz':
      return amount.value * ML_PER_OZ;
    default:
      return null;
  }
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * A practical, human-readable household-measure approximation of a precise
 * volume amount (e.g. 15 ml -> ~1 tbsp). The precise amount stays
 * authoritative everywhere this is used — this is a secondary convenience
 * line, never a replacement. Returns null for amounts that aren't a
 * convertible volume (dashes, pieces, leaves, barspoons, rinses are already
 * "practical" units) or that are too large to be worth approximating (a
 * 350 ml beer top-up doesn't need "≈ 11.75 oz").
 */
export function getHouseholdApproximation(amount: Amount): HouseholdApproximation | null {
  if (!VOLUME_UNITS.includes(amount.unit)) return null;

  const ml = toMl(amount);
  if (ml === null || ml <= 0 || ml > MAX_APPROXIMATABLE_ML) return null;

  if (ml <= 10) {
    return { unit: 'tsp', value: roundToNearest(ml / ML_PER_TSP, 0.25) };
  }
  if (Math.abs(ml - SHOT_ML) <= SHOT_TOLERANCE_ML) {
    return { unit: 'shot', value: 1 };
  }
  if (ml <= 40) {
    return { unit: 'tbsp', value: roundToNearest(ml / ML_PER_TBSP, 0.5) };
  }
  return { unit: 'oz', value: roundToNearest(ml / ML_PER_OZ, 0.25) };
}

const FRACTION_GLYPHS: Record<string, string> = {
  '0.25': '¼',
  '0.5': '½',
  '0.75': '¾',
};

/** Formats a decimal quantity using common fraction glyphs (1½) rather than raw decimals, for a human-readable approximation. */
export function formatQuantity(value: number): string {
  const whole = Math.floor(value);
  const fraction = Math.round((value - whole) * 100) / 100;

  const glyph = FRACTION_GLYPHS[String(fraction)];
  if (glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  if (fraction === 0) return String(whole);
  return String(Math.round(value * 100) / 100);
}
