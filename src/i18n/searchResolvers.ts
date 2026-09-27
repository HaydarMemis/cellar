import { getByPath } from './translate';
import { ingredientNameDictionaries, uiDictionaries, vocabDictionaries } from './dictionaries';
import { supportedLocales } from './types';

/**
 * Search must find a result regardless of which language the UI is
 * currently displaying — a Turkish-locale user typing "lemon" should still
 * find "Limon Suyu", and an English-locale user typing "ekşi" should still
 * find tags labeled "Sour". These resolvers return every locale's variant
 * of a display string (deduplicated), for `matchesQuery`/`searchCatalog`
 * (src/domain/search.ts) to check all of at once. Domain code stays
 * language-independent — it only ever sees the resolved string list.
 */
export function getIngredientNameVariants(ingredientId: string): string[] {
  const variants = supportedLocales.map((locale) => ingredientNameDictionaries[locale][ingredientId]).filter((v): v is string => !!v);
  return Array.from(new Set(variants));
}

export function getVocabVariants(path: string): string[] {
  const variants = supportedLocales
    .map((locale) => getByPath(vocabDictionaries[locale], path))
    .filter((v): v is string => typeof v === 'string');
  return Array.from(new Set(variants));
}

export function getUiTextVariants(path: string): string[] {
  const variants = supportedLocales
    .map((locale) => getByPath(uiDictionaries[locale], path))
    .filter((v): v is string => typeof v === 'string');
  return Array.from(new Set(variants));
}
