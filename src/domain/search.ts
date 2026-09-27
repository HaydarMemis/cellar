import { getSpiritGroup } from './spiritGroups';
import { Cocktail } from './types';

export interface FilterState {
  baseSpirits: string[];
  tastes: string[];
  difficulties: string[];
  types: string[];
  alcoholFreeOnly: boolean;
  /** null = no cap; otherwise the cocktail's prepTimeMinutes must be <= this. */
  maxPrepTimeMinutes: number | null;
}

export const emptyFilterState: FilterState = {
  baseSpirits: [],
  tastes: [],
  difficulties: [],
  types: [],
  alcoholFreeOnly: false,
  maxPrepTimeMinutes: null,
};

export function isFilterActive(filters: FilterState): boolean {
  return (
    filters.baseSpirits.length > 0 ||
    filters.tastes.length > 0 ||
    filters.difficulties.length > 0 ||
    filters.types.length > 0 ||
    filters.alcoholFreeOnly ||
    filters.maxPrepTimeMinutes !== null
  );
}

export function activeFilterCount(filters: FilterState): number {
  return (
    filters.baseSpirits.length +
    filters.tastes.length +
    filters.difficulties.length +
    filters.types.length +
    (filters.alcoholFreeOnly ? 1 : 0) +
    (filters.maxPrepTimeMinutes !== null ? 1 : 0)
  );
}

/**
 * Case- and Turkish-character-insensitive normalization for search.
 * `toLocaleLowerCase('tr')` (not plain `toLowerCase()`) is required so a
 * dotted capital İ lowercases to a plain "i" rather than "i̇" (i + a
 * combining dot, U+0307) — the classic "Turkish I problem" that plain
 * `toLowerCase()` gets wrong and would otherwise silently break matching
 * for any Turkish text containing İ. Diacritics are then folded to their
 * plain-ASCII base letter so a query typed without a Turkish keyboard
 * ("eksi", "eglenceli") still matches text spelled correctly ("ekşi",
 * "eğlenceli") — deterministic, no fuzzy/AI matching (see project plan).
 */
export function normalize(text: string): string {
  let lower: string;
  try {
    lower = text.trim().toLocaleLowerCase('tr');
  } catch {
    lower = text.trim().toLowerCase();
  }
  return lower
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function includesNormalized(haystack: string, normalizedQuery: string): boolean {
  return normalize(haystack).includes(normalizedQuery);
}

/**
 * Deterministic local search across name, tags, category and ingredient
 * names. No fuzzy/AI matching by design (see project plan, Section 7).
 *
 * Domain code never hardcodes display text, so the caller supplies name
 * resolvers. Each resolver returns every known display-text *variant* for
 * an id (e.g. both the English and Turkish ingredient name) rather than
 * just the currently-active locale's — so a Turkish-locale user typing
 * "lemon" still finds "Lemon Juice"/"Limon Suyu", and an English-locale
 * user typing "ekşi" still finds tags labeled "Sour" in English. This
 * function itself stays a plain, language-agnostic string matcher.
 */
export function matchesQuery(
  cocktail: Cocktail,
  query: string,
  resolveIngredientNames: (ingredientId: string) => string[],
  resolveTagLabels: (id: string) => string[] = (id) => [id],
  resolveCategoryLabels: (id: string) => string[] = (id) => [id],
  /** Every language's description text for this cocktail — falls back to the English record field alone if omitted. */
  descriptionVariants: string[] = cocktail.description ? [cocktail.description] : [],
): boolean {
  const q = normalize(query);
  if (!q) return true;

  if (includesNormalized(cocktail.name, q)) return true;
  if (cocktail.tags.some((t) => resolveTagLabels(t).some((label) => includesNormalized(label, q)))) return true;
  if (cocktail.category.some((c) => resolveCategoryLabels(c).some((label) => includesNormalized(label, q)))) return true;
  if (resolveIngredientNames(cocktail.baseSpirit).some((name) => includesNormalized(name, q))) return true;
  if (descriptionVariants.some((d) => includesNormalized(d, q))) return true;

  return cocktail.ingredients.some((ri) => resolveIngredientNames(ri.ingredientId).some((name) => includesNormalized(name, q)));
}

export function matchesFilters(cocktail: Cocktail, filters: FilterState): boolean {
  if (filters.alcoholFreeOnly && cocktail.baseSpirit !== 'alcohol-free') return false;

  if (
    filters.baseSpirits.length > 0 &&
    !filters.baseSpirits.includes(getSpiritGroup(cocktail.baseSpirit))
  ) {
    return false;
  }

  if (filters.difficulties.length > 0 && !filters.difficulties.includes(cocktail.difficulty)) {
    return false;
  }

  if (filters.tastes.length > 0 && !filters.tastes.some((t) => cocktail.tags.includes(t))) {
    return false;
  }

  if (filters.types.length > 0 && !filters.types.some((t) => cocktail.category.includes(t))) {
    return false;
  }

  if (filters.maxPrepTimeMinutes !== null && cocktail.prepTimeMinutes > filters.maxPrepTimeMinutes) {
    return false;
  }

  return true;
}

export function searchCatalog(
  cocktails: Cocktail[],
  query: string,
  filters: FilterState,
  resolveIngredientNames: (ingredientId: string) => string[],
  resolveTagLabels?: (id: string) => string[],
  resolveCategoryLabels?: (id: string) => string[],
  resolveDescriptionVariants?: (cocktail: Cocktail) => string[],
): Cocktail[] {
  return cocktails.filter(
    (c) =>
      matchesQuery(c, query, resolveIngredientNames, resolveTagLabels, resolveCategoryLabels, resolveDescriptionVariants?.(c)) &&
      matchesFilters(c, filters),
  );
}
