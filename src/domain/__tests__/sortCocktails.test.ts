import { sortCocktails } from '../sortCocktails';
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

describe('sortCocktails', () => {
  const items = [
    makeCocktail({ id: 'c', name: 'Charlie', difficulty: 'hard', prepTimeMinutes: 8, abv: { approx: 30 } }),
    makeCocktail({ id: 'a', name: 'Alpha', difficulty: 'easy', prepTimeMinutes: 2, abv: { approx: 10 } }),
    makeCocktail({ id: 'b', name: 'Bravo', difficulty: 'medium', prepTimeMinutes: 5, abv: null }),
  ];

  it('recommended preserves input order', () => {
    expect(sortCocktails(items, 'recommended').map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('name sorts alphabetically', () => {
    expect(sortCocktails(items, 'name').map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('difficulty sorts easy, medium, hard', () => {
    expect(sortCocktails(items, 'difficulty').map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('prepTime sorts quickest first', () => {
    expect(sortCocktails(items, 'prepTime').map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('abv sorts lowest first, treating a null (alcohol-free) ABV as lowest', () => {
    expect(sortCocktails(items, 'abv').map((c) => c.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the input array', () => {
    const original = [...items];
    sortCocktails(items, 'name');
    expect(items).toEqual(original);
  });
});
