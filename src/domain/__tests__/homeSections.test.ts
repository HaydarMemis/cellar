import {
  getBasedOnYourBar,
  getFeatured,
  getGreetingId,
  getPopularClassics,
  getQuickAndEasy,
  getSomethingSour,
} from '../homeSections';
import { Cocktail } from '../types';

function makeCocktail(overrides: Partial<Cocktail>): Cocktail {
  return {
    id: 'x',
    name: 'X',
    description: '',
    baseSpirit: 'gin',
    category: [],
    tags: [],
    ingredients: [{ ingredientId: 'gin', amount: { value: 30, unit: 'ml' }, isOptional: false, isGarnish: false }],
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

describe('getGreetingId', () => {
  it.each([
    [new Date('2024-01-01T02:00:00'), 'night'],
    [new Date('2024-01-01T09:00:00'), 'morning'],
    [new Date('2024-01-01T15:00:00'), 'afternoon'],
    [new Date('2024-01-01T20:00:00'), 'evening'],
  ] as const)('classifies %s as %s', (date, expected) => {
    expect(getGreetingId(date)).toBe(expected);
  });

  it('treats the boundary hours correctly (5, 12, 18)', () => {
    expect(getGreetingId(new Date('2024-01-01T04:59:00'))).toBe('night');
    expect(getGreetingId(new Date('2024-01-01T05:00:00'))).toBe('morning');
    expect(getGreetingId(new Date('2024-01-01T11:59:00'))).toBe('morning');
    expect(getGreetingId(new Date('2024-01-01T12:00:00'))).toBe('afternoon');
    expect(getGreetingId(new Date('2024-01-01T17:59:00'))).toBe('afternoon');
    expect(getGreetingId(new Date('2024-01-01T18:00:00'))).toBe('evening');
  });
});

describe('getFeatured', () => {
  it('silently skips a featured id that is missing from the catalog', () => {
    const cocktails = [makeCocktail({ id: 'martini' })];
    expect(getFeatured(cocktails).every((c) => c !== undefined)).toBe(true);
  });
});

describe('getPopularClassics / getQuickAndEasy / getSomethingSour', () => {
  const classic = makeCocktail({ id: 'a', category: ['classic'], difficulty: 'medium', prepTimeMinutes: 6 });
  const quick = makeCocktail({ id: 'b', difficulty: 'easy', prepTimeMinutes: 2 });
  const slow = makeCocktail({ id: 'c', difficulty: 'easy', prepTimeMinutes: 10 });
  const sourByTag = makeCocktail({ id: 'd', tags: ['sour'], difficulty: 'medium', prepTimeMinutes: 6 });
  const sourByCategory = makeCocktail({ id: 'e', category: ['sour'], difficulty: 'medium', prepTimeMinutes: 6 });
  const cocktails = [classic, quick, slow, sourByTag, sourByCategory];

  it('filters popular classics by category', () => {
    expect(getPopularClassics(cocktails).map((c) => c.id)).toEqual(['a']);
  });

  it('filters quick & easy by difficulty and prep time', () => {
    expect(getQuickAndEasy(cocktails).map((c) => c.id)).toEqual(['b']);
  });

  it('matches "something sour" by tag or category', () => {
    expect(getSomethingSour(cocktails).map((c) => c.id).sort()).toEqual(['d', 'e']);
  });

  it('respects the limit parameter', () => {
    const many = Array.from({ length: 10 }, (_, i) => makeCocktail({ id: `classic-${i}`, category: ['classic'] }));
    expect(getPopularClassics(many, 3)).toHaveLength(3);
  });
});

describe('getBasedOnYourBar', () => {
  const alwaysMakeable = makeCocktail({ id: 'always-makeable', ingredients: [] });
  // cranberry-juice has no defined substitute, so it's a clean have/missing fixture.
  const needsCranberryJuice = makeCocktail({
    id: 'needs-cranberry-juice',
    ingredients: [{ ingredientId: 'cranberry-juice', amount: { value: 30, unit: 'ml' }, isOptional: false, isGarnish: false }],
  });

  it('returns nothing when the inventory is empty', () => {
    expect(getBasedOnYourBar([alwaysMakeable, needsCranberryJuice], new Set())).toEqual([]);
  });

  it('includes a cocktail once its required ingredient is in the inventory', () => {
    const result = getBasedOnYourBar([alwaysMakeable, needsCranberryJuice], new Set(['cranberry-juice']));
    expect(result.map((c) => c.id).sort()).toEqual(['always-makeable', 'needs-cranberry-juice']);
  });

  it('excludes a cocktail whose required ingredient is missing from the inventory', () => {
    const result = getBasedOnYourBar([alwaysMakeable, needsCranberryJuice], new Set(['vodka']));
    expect(result.map((c) => c.id)).toEqual(['always-makeable']);
  });

  it('only includes full (100%) matches, not partial ones', () => {
    const highMatch = makeCocktail({
      id: 'high-match',
      ingredients: [
        { ingredientId: 'gin', amount: { value: 30, unit: 'ml' }, isOptional: false, isGarnish: false },
        { ingredientId: 'cranberry-juice', amount: { value: 30, unit: 'ml' }, isOptional: false, isGarnish: false },
      ],
    });
    const result = getBasedOnYourBar([alwaysMakeable, highMatch], new Set(['gin']));
    expect(result.map((c) => c.id)).toEqual(['always-makeable']);
  });
});
