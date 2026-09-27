import { Locale } from './types';

const intlTags: Record<Locale, string> = { en: 'en-US', tr: 'tr-TR' };

/** Locale-aware number formatting (decimal separator etc.), with a plain fallback if Intl is unavailable. */
export function formatLocaleNumber(value: number, locale: Locale, maxFractionDigits = 2): string {
  try {
    return new Intl.NumberFormat(intlTags[locale], { maximumFractionDigits: maxFractionDigits }).format(value);
  } catch {
    return String(value);
  }
}
