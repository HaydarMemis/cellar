import { Cocktail } from '../domain/types';
import { catalogOverrides } from './locales/tr/catalog';
import { Locale } from './types';

export interface CocktailContent {
  description: string;
  steps: string[];
  garnish?: string;
}

/**
 * Resolves the locale-appropriate prose for a catalog cocktail. This lives
 * in the i18n layer, not domain — domain/business logic must never depend
 * on translated strings. English is single-sourced on the Cocktail record
 * itself; only a Turkish overlay exists (locales/tr/catalog.ts), falling
 * back to English per-field so a partial translation never renders blank.
 * Personal recipes have no overlay — they're the user's own words, shown
 * as entered regardless of locale.
 */
export function getCocktailContent(cocktail: Cocktail, locale: Locale): CocktailContent {
  if (locale === 'en') {
    return { description: cocktail.description, steps: cocktail.steps, garnish: cocktail.garnish };
  }

  const override = catalogOverrides[cocktail.id];
  return {
    description: override?.description ?? cocktail.description,
    steps: override?.steps ?? cocktail.steps,
    garnish: override?.garnish ?? cocktail.garnish,
  };
}
