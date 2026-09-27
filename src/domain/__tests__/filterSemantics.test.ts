import { emptyFilterState, matchesFilters, activeFilterCount, isFilterActive, FilterState } from '../search';
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

/**
 * Documents and locks in the filter semantics referenced in app/filters.tsx:
 * within one category, values OR together; across categories, the result
 * must satisfy every active category (AND). See also matchesFilters unit
 * tests in search.test.ts for the base-case coverage this extends.
 */
describe('filter semantics — within-category OR, across-category AND', () => {
  const gin = makeCocktail({ id: 'gin-drink', baseSpirit: 'gin', tags: ['sour'] });
  const vodka = makeCocktail({ id: 'vodka-drink', baseSpirit: 'vodka', tags: ['sweet'] });
  const whiskey = makeCocktail({ id: 'whiskey-drink', baseSpirit: 'bourbon', tags: ['strong'] });

  it('a single spirit filter matches only that spirit group', () => {
    const filters: FilterState = { ...emptyFilterState, baseSpirits: ['gin'] };
    expect(matchesFilters(gin, filters)).toBe(true);
    expect(matchesFilters(vodka, filters)).toBe(false);
  });

  it('two spirits in the same filter category are OR\'d together', () => {
    const filters: FilterState = { ...emptyFilterState, baseSpirits: ['gin', 'vodka'] };
    expect(matchesFilters(gin, filters)).toBe(true);
    expect(matchesFilters(vodka, filters)).toBe(true);
    expect(matchesFilters(whiskey, filters)).toBe(false);
  });

  it('spirit + taste across two categories is AND\'d — must satisfy both', () => {
    const ginSour = makeCocktail({ id: 'gin-sour', baseSpirit: 'gin', tags: ['sour'] });
    const ginSweet = makeCocktail({ id: 'gin-sweet', baseSpirit: 'gin', tags: ['sweet'] });
    const vodkaSour = makeCocktail({ id: 'vodka-sour', baseSpirit: 'vodka', tags: ['sour'] });

    const filters: FilterState = { ...emptyFilterState, baseSpirits: ['gin'], tastes: ['sour'] };
    expect(matchesFilters(ginSour, filters)).toBe(true); // satisfies both
    expect(matchesFilters(ginSweet, filters)).toBe(false); // wrong taste
    expect(matchesFilters(vodkaSour, filters)).toBe(false); // wrong spirit
  });

  it('three active categories simultaneously all apply', () => {
    const match = makeCocktail({ id: 'triple-match', baseSpirit: 'gin', tags: ['sour'], difficulty: 'easy', prepTimeMinutes: 3 });
    const wrongDifficulty = makeCocktail({ id: 'wrong-difficulty', baseSpirit: 'gin', tags: ['sour'], difficulty: 'hard', prepTimeMinutes: 3 });

    const filters: FilterState = { ...emptyFilterState, baseSpirits: ['gin'], tastes: ['sour'], difficulties: ['easy'] };
    expect(matchesFilters(match, filters)).toBe(true);
    expect(matchesFilters(wrongDifficulty, filters)).toBe(false);
  });

  it('clearing all filters (emptyFilterState) matches everything', () => {
    expect(matchesFilters(gin, emptyFilterState)).toBe(true);
    expect(matchesFilters(vodka, emptyFilterState)).toBe(true);
    expect(isFilterActive(emptyFilterState)).toBe(false);
    expect(activeFilterCount(emptyFilterState)).toBe(0);
  });

  it('an over-constrained combination correctly yields zero matches rather than throwing', () => {
    const filters: FilterState = { ...emptyFilterState, baseSpirits: ['gin'], alcoholFreeOnly: true };
    // A gin cocktail can never also be baseSpirit === 'alcohol-free' — this is a legitimate zero-result state, not a bug.
    expect(() => matchesFilters(gin, filters)).not.toThrow();
    expect(matchesFilters(gin, filters)).toBe(false);
  });

  it('an empty catalog produces zero results without throwing', () => {
    const filters: FilterState = { ...emptyFilterState, baseSpirits: ['gin'] };
    const emptyCatalog: Cocktail[] = [];
    expect(() => emptyCatalog.filter((c) => matchesFilters(c, filters))).not.toThrow();
    expect(emptyCatalog.filter((c) => matchesFilters(c, filters))).toHaveLength(0);
  });

  it('a malformed filter state (unexpected extra category values) never throws — unknown ids simply never match', () => {
    const filters: FilterState = { ...emptyFilterState, baseSpirits: ['not-a-real-spirit-group'] };
    expect(() => matchesFilters(gin, filters)).not.toThrow();
    expect(matchesFilters(gin, filters)).toBe(false);
  });

  it('activeFilterCount reflects the total number of active selections across all categories', () => {
    const filters: FilterState = {
      baseSpirits: ['gin', 'vodka'],
      tastes: ['sour'],
      types: [],
      difficulties: ['easy', 'medium'],
      alcoholFreeOnly: true,
      maxPrepTimeMinutes: 5,
    };
    // 2 spirits + 1 taste + 0 types + 2 difficulties + 1 alcohol-free + 1 time = 7
    expect(activeFilterCount(filters)).toBe(7);
    expect(isFilterActive(filters)).toBe(true);
  });

  it('the time filter is a single exclusive value, not additive with itself', () => {
    const filters: FilterState = { ...emptyFilterState, maxPrepTimeMinutes: 5 };
    const quick = makeCocktail({ id: 'quick', prepTimeMinutes: 4 });
    const slow = makeCocktail({ id: 'slow', prepTimeMinutes: 8 });
    expect(matchesFilters(quick, filters)).toBe(true);
    expect(matchesFilters(slow, filters)).toBe(false);
  });
});
