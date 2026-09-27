import { getRelatedCocktails } from '../related';
import { Cocktail } from '../types';

function makeCocktail(overrides: Partial<Cocktail>): Cocktail {
  return {
    id: 'base',
    name: 'Base',
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

describe('getRelatedCocktails', () => {
  it('never includes the target cocktail itself', () => {
    const target = makeCocktail({ id: 'martini', baseSpirit: 'gin' });
    const all = [target, makeCocktail({ id: 'negroni', baseSpirit: 'gin' })];

    const related = getRelatedCocktails(target, all);
    expect(related.find((c) => c.id === 'martini')).toBeUndefined();
  });

  it('excludes cocktails that share nothing (no spirit group, category, or tag overlap)', () => {
    const target = makeCocktail({ id: 'martini', baseSpirit: 'gin', category: ['classic'], tags: ['dry'] });
    const unrelated = makeCocktail({ id: 'painkiller', baseSpirit: 'dark-rum', category: ['tiki'], tags: ['sweet'] });

    const related = getRelatedCocktails(target, [target, unrelated]);
    expect(related).toHaveLength(0);
  });

  it('ranks a same-spirit-group match above a category-only match', () => {
    const target = makeCocktail({ id: 'martini', baseSpirit: 'gin', category: ['classic', 'martini'], tags: ['dry'] });
    const sameSpirit = makeCocktail({ id: 'negroni', baseSpirit: 'gin', category: ['other'], tags: ['bitter'] });
    const sameCategoryOnly = makeCocktail({
      id: 'manhattan',
      baseSpirit: 'rye-whiskey',
      category: ['classic'],
      tags: ['bitter'],
    });

    const related = getRelatedCocktails(target, [target, sameCategoryOnly, sameSpirit]);
    expect(related.map((c) => c.id)).toEqual(['negroni', 'manhattan']);
  });

  it('respects the limit parameter', () => {
    const target = makeCocktail({ id: 'martini', baseSpirit: 'gin' });
    const many = Array.from({ length: 10 }, (_, i) => makeCocktail({ id: `gin-drink-${i}`, baseSpirit: 'gin' }));

    const related = getRelatedCocktails(target, [target, ...many], 3);
    expect(related).toHaveLength(3);
  });
});
