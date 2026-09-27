import { Cocktail } from './types';

export type SortKey = 'recommended' | 'name' | 'difficulty' | 'prepTime' | 'abv';

const DIFFICULTY_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

/**
 * Sorts a cocktail list for display. `recommended` preserves the input
 * order (the collection's own curated/catalog order) rather than imposing
 * one — everything else is a stable, deterministic comparator.
 */
export function sortCocktails(cocktails: Cocktail[], sortKey: SortKey): Cocktail[] {
  if (sortKey === 'recommended') return cocktails;

  const sorted = [...cocktails];
  switch (sortKey) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'difficulty':
      sorted.sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]);
      break;
    case 'prepTime':
      sorted.sort((a, b) => a.prepTimeMinutes - b.prepTimeMinutes);
      break;
    case 'abv':
      sorted.sort((a, b) => (a.abv?.approx ?? -1) - (b.abv?.approx ?? -1));
      break;
  }
  return sorted;
}

export const sortKeys: SortKey[] = ['recommended', 'name', 'difficulty', 'prepTime', 'abv'];
