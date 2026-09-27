import { rankMatches } from './matching';
import { Cocktail } from './types';

const FEATURED_IDS = [
  'old-fashioned',
  'negroni',
  'margarita',
  'daiquiri',
  'whiskey-sour',
  'mojito',
  'martini',
  'espresso-martini',
];

export function getFeatured(cocktails: Cocktail[]): Cocktail[] {
  return FEATURED_IDS.map((id) => cocktails.find((c) => c.id === id)).filter(
    (c): c is Cocktail => !!c,
  );
}

export function getPopularClassics(cocktails: Cocktail[], limit = 8): Cocktail[] {
  return cocktails.filter((c) => c.category.includes('classic')).slice(0, limit);
}

export function getQuickAndEasy(cocktails: Cocktail[], limit = 8): Cocktail[] {
  return cocktails.filter((c) => c.difficulty === 'easy' && c.prepTimeMinutes <= 3).slice(0, limit);
}

export function getSomethingSour(cocktails: Cocktail[], limit = 8): Cocktail[] {
  return cocktails
    .filter((c) => c.tags.includes('sour') || c.category.includes('sour'))
    .slice(0, limit);
}

/**
 * Home's "Based on your bar" shows only EXACT full matches — every
 * ingredient genuinely in inventory, no substitution involved. A match
 * reached only via a substitute is disclosed explicitly on the dedicated
 * "I Have These Ingredients" screen instead; Home's compact card has no
 * room to show "using X instead of Y", so it never claims one there.
 */
export function getBasedOnYourBar(
  cocktails: Cocktail[],
  inventoryIds: ReadonlySet<string>,
  limit = 8,
): Cocktail[] {
  if (inventoryIds.size === 0) return [];
  return rankMatches(cocktails, inventoryIds)
    .filter((m) => m.tier === 'full' && m.substitutions.length === 0)
    .slice(0, limit)
    .map((m) => m.item);
}

export type GreetingId = 'night' | 'morning' | 'afternoon' | 'evening';

/** Returns an id, not text — the UI maps it to `home.greeting${Id}` via i18n. */
export function getGreetingId(date = new Date()): GreetingId {
  const hour = date.getHours();
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
