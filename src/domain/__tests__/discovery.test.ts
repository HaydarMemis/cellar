import {
  discoveryCollections,
  discoveryCollectionsById,
  getCollectionCocktails,
  getNonEmptyCollections,
} from '../discovery';
import { Cocktail } from '../types';

function makeCocktail(overrides: Partial<Cocktail> & { id: string }): Cocktail {
  return {
    name: overrides.id,
    description: '',
    baseSpirit: 'gin',
    category: [],
    tags: [],
    ingredients: [],
    method: 'stir',
    steps: [],
    glass: ['coupe'],
    abv: { approx: 20 },
    difficulty: 'easy',
    prepTimeMinutes: 3,
    similarCocktailIds: [],
    ...overrides,
  };
}

describe('discoveryCollections registry', () => {
  it('has unique ids', () => {
    const ids = discoveryCollections.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every collection has either a predicate (dynamic) or explicit cocktailIds (curated), not neither', () => {
    for (const c of discoveryCollections) {
      expect(!!c.predicate || !!c.cocktailIds).toBe(true);
    }
  });

  it('discoveryCollectionsById is in sync with the array', () => {
    expect(discoveryCollectionsById.size).toBe(discoveryCollections.length);
    for (const c of discoveryCollections) {
      expect(discoveryCollectionsById.get(c.id)).toBe(c);
    }
  });
});

describe('getCollectionCocktails', () => {
  const gin1 = makeCocktail({ id: 'gin1', baseSpirit: 'gin' });
  const gin2 = makeCocktail({ id: 'gin2', baseSpirit: 'gin' });
  const vodka1 = makeCocktail({ id: 'vodka1', baseSpirit: 'vodka' });
  const all = [gin1, gin2, vodka1];

  it('filters correctly for a dynamic collection', () => {
    const collection = discoveryCollectionsById.get('spirit-gin')!;
    expect(getCollectionCocktails(collection, all).map((c) => c.id).sort()).toEqual(['gin1', 'gin2']);
  });

  it('resolves ids in order for a curated collection, skipping any that no longer exist', () => {
    const collection = { id: 'test', group: 'featured' as const, kind: 'curated' as const, cocktailIds: ['vodka1', 'missing-id', 'gin1'] };
    expect(getCollectionCocktails(collection, all).map((c) => c.id)).toEqual(['vodka1', 'gin1']);
  });

  it('returns an empty array for a collection matching nothing', () => {
    const collection = discoveryCollectionsById.get('spirit-mezcal')!;
    expect(getCollectionCocktails(collection, [gin1, vodka1])).toEqual([]);
  });
});

describe('getNonEmptyCollections', () => {
  it('excludes a spirit collection with zero matching cocktails', () => {
    const onlyGin = [makeCocktail({ id: 'g1', baseSpirit: 'gin' })];
    const result = getNonEmptyCollections('spirit', onlyGin);
    expect(result.map((r) => r.collection.id)).toEqual(['spirit-gin']);
  });

  it('includes every spirit collection when the catalog covers them all', () => {
    const all = ['gin', 'vodka', 'bourbon', 'white-rum', 'blanco-tequila', 'mezcal', 'cognac'].map((baseSpirit, i) =>
      makeCocktail({ id: `c${i}`, baseSpirit }),
    );
    const result = getNonEmptyCollections('spirit', all);
    expect(result.length).toBe(7);
  });
});
