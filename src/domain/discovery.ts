import { bySearchSpirit, searchSpiritIds } from './searchSpirits';
import { Cocktail, Difficulty, PreparationMethod } from './types';

export type DiscoveryCollectionKind = 'dynamic' | 'curated';
export type DiscoveryCollectionGroup = 'spirit' | 'taste' | 'style' | 'method' | 'featured';

/** The four major discovery dimensions shown as large cards at the top of Search. Order here is display order. */
export const discoveryDimensions: Exclude<DiscoveryCollectionGroup, 'featured'>[] = ['spirit', 'style', 'taste', 'method'];

export interface DiscoveryCollection {
  id: string;
  group: DiscoveryCollectionGroup;
  kind: DiscoveryCollectionKind;
  /** Curated collections list explicit ids in display order; dynamic ones compute membership from `predicate`. */
  cocktailIds?: string[];
  predicate?: (cocktail: Cocktail) => boolean;
}

function byStyle(type: string) {
  return (c: Cocktail) => c.category.includes(type);
}

function byTaste(tag: string) {
  return (c: Cocktail) => c.tags.includes(tag);
}

function byDifficulty(difficulty: Difficulty) {
  return (c: Cocktail) => c.difficulty === difficulty;
}

function byMethod(method: PreparationMethod) {
  return (c: Cocktail) => c.method === method;
}

const methodIds: PreparationMethod[] = ['shake', 'stir', 'build', 'muddle', 'blend', 'layer'];

const methodCollections: DiscoveryCollection[] = methodIds.map((method) => ({
  id: `method-${method}`,
  group: 'method',
  kind: 'dynamic',
  predicate: byMethod(method),
}));

const spiritCollections: DiscoveryCollection[] = searchSpiritIds.map((spiritId) => ({
  id: `spirit-${spiritId}`,
  group: 'spirit',
  kind: 'dynamic',
  predicate: bySearchSpirit(spiritId),
}));

const styleCollections: DiscoveryCollection[] = [
  'classic',
  'tiki',
  'contemporary',
  'highball',
  'sour',
  'martini',
  'old-fashioned',
  'collins',
  'fizz',
  'punch',
  'spritz',
  'frozen',
  'alcohol-free',
].map((type) => ({ id: `style-${type}`, group: 'style', kind: 'dynamic', predicate: byStyle(type) }));

const tasteCollections: DiscoveryCollection[] = [
  'sweet',
  'sour',
  'bitter',
  'dry',
  'fruity',
  'herbal',
  'smoky',
  'spicy',
  'refreshing',
  'strong',
  'light',
].map((tag) => ({ id: `taste-${tag}`, group: 'taste', kind: 'dynamic', predicate: byTaste(tag) }));

/**
 * Editorial rows for the Search screen. Some are dynamic (computed from a
 * real recipe attribute — prep time, ABV, tags); some are curated
 * (`kind: 'curated'`), meaning a hand-picked, explicitly labeled
 * "Curated Collection" rather than a claimed objective ranking (see
 * project brief — no fabricated "best of" numbers or fake popularity).
 */
const featuredCollections: DiscoveryCollection[] = [
  {
    id: 'essential-classics',
    group: 'featured',
    kind: 'curated',
    cocktailIds: [
      'old-fashioned',
      'manhattan',
      'martini',
      'negroni',
      'daiquiri',
      'margarita',
      'whiskey-sour',
      'mojito',
      'moscow-mule',
      'sidecar',
      'aviation',
      'last-word',
      'tom-collins',
      'gimlet',
      'sazerac',
      'boulevardier',
      'french-75',
      'cosmopolitan',
      'espresso-martini',
      'mai-tai',
    ],
  },
  {
    id: 'under-5-minutes',
    group: 'featured',
    kind: 'dynamic',
    predicate: (c) => c.prepTimeMinutes <= 5,
  },
  {
    id: 'strong-spirit-forward',
    group: 'featured',
    kind: 'dynamic',
    predicate: byTaste('strong'),
  },
  {
    id: 'tiki-tropical',
    group: 'featured',
    kind: 'dynamic',
    predicate: byStyle('tiki'),
  },
  {
    id: 'low-abv-alcohol-free',
    group: 'featured',
    kind: 'dynamic',
    predicate: (c) => c.abv === null || c.abv.approx <= 12,
  },
  {
    id: 'beginner-friendly',
    group: 'featured',
    kind: 'dynamic',
    predicate: byDifficulty('easy'),
  },
  {
    id: 'date-night-classics',
    group: 'featured',
    kind: 'curated',
    cocktailIds: [
      'french-75',
      'sidecar',
      'aviation',
      'kir-royale',
      'espresso-martini',
      'bramble',
      'corpse-reviver-no-2',
      'martinez',
    ],
  },
  {
    id: 'party-favorites',
    group: 'featured',
    kind: 'curated',
    cocktailIds: [
      'margarita',
      'mojito',
      'moscow-mule',
      'pina-colada',
      'aperol-spritz',
      'long-island-iced-tea',
      'jungle-bird',
      'hurricane',
    ],
  },
];

export const discoveryCollections: DiscoveryCollection[] = [
  ...featuredCollections,
  ...spiritCollections,
  ...styleCollections,
  ...tasteCollections,
  ...methodCollections,
];

export const discoveryCollectionsById: ReadonlyMap<string, DiscoveryCollection> = new Map(
  discoveryCollections.map((c) => [c.id, c]),
);

export function getCollectionCocktails(collection: DiscoveryCollection, all: Cocktail[]): Cocktail[] {
  if (collection.kind === 'curated' && collection.cocktailIds) {
    return collection.cocktailIds
      .map((id) => all.find((c) => c.id === id))
      .filter((c): c is Cocktail => !!c);
  }
  if (collection.predicate) return all.filter(collection.predicate);
  return [];
}

/** Collections in a group that actually have at least one matching cocktail — an empty spirit/style row is just noise. */
export function getNonEmptyCollections(
  group: DiscoveryCollectionGroup,
  all: Cocktail[],
): { collection: DiscoveryCollection; cocktails: Cocktail[] }[] {
  return discoveryCollections
    .filter((c) => c.group === group)
    .map((collection) => ({ collection, cocktails: getCollectionCocktails(collection, all) }))
    .filter((entry) => entry.cocktails.length > 0);
}
