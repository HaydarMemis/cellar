import { emptyFilterState, matchesFilters, matchesQuery, searchCatalog } from '../search';
import { Cocktail } from '../types';

const names: Record<string, string[]> = { gin: ['Gin', 'Cin'], 'lime-juice': ['Lime Juice', 'Misket Limonu Suyu'] };
const resolveIngredientName = (id: string) => names[id] ?? [];

function makeCocktail(overrides: Partial<Cocktail> = {}): Cocktail {
  return {
    id: 'gimlet',
    name: 'Gimlet',
    description: '',
    baseSpirit: 'gin',
    category: ['sour', 'classic'],
    tags: ['sour', 'refreshing'],
    ingredients: [
      { ingredientId: 'gin', amount: { value: 60, unit: 'ml' }, isOptional: false, isGarnish: false },
      { ingredientId: 'lime-juice', amount: { value: 20, unit: 'ml' }, isOptional: false, isGarnish: false },
    ],
    method: 'shake',
    steps: [],
    glass: ['coupe'],
    abv: { approx: 20 },
    difficulty: 'easy',
    prepTimeMinutes: 3,
    similarCocktailIds: [],
    ...overrides,
  };
}

describe('matchesQuery', () => {
  const cocktail = makeCocktail();

  it('matches by name', () => {
    expect(matchesQuery(cocktail, 'gim', resolveIngredientName)).toBe(true);
  });

  it('matches by ingredient name', () => {
    expect(matchesQuery(cocktail, 'lime', resolveIngredientName)).toBe(true);
  });

  it('matches by tag', () => {
    expect(matchesQuery(cocktail, 'refreshing', resolveIngredientName)).toBe(true);
  });

  it('is case-insensitive and whitespace-tolerant', () => {
    expect(matchesQuery(cocktail, '  GIN  ', resolveIngredientName)).toBe(true);
  });

  it('returns false for unrelated queries', () => {
    expect(matchesQuery(cocktail, 'whiskey', resolveIngredientName)).toBe(false);
  });

  it('treats an empty query as matching everything', () => {
    expect(matchesQuery(cocktail, '', resolveIngredientName)).toBe(true);
  });

  it('matches an ingredient by its Turkish name variant even though the fixture cocktail carries no locale', () => {
    expect(matchesQuery(cocktail, 'cin', resolveIngredientName)).toBe(true);
    expect(matchesQuery(cocktail, 'misket limonu', resolveIngredientName)).toBe(true);
  });

  it('is Turkish-character insensitive: a query typed without Turkish diacritics still matches text spelled with them', () => {
    const sourCocktail = makeCocktail({ name: 'Ekşi Kokteyl' });
    expect(matchesQuery(sourCocktail, 'eksi', resolveIngredientName)).toBe(true);
    expect(matchesQuery(sourCocktail, 'EKŞİ', resolveIngredientName)).toBe(true);
  });

  it('the Turkish dotted/dotless I is normalized correctly (the classic "Turkish I problem")', () => {
    const cocktailWithI = makeCocktail({ name: 'İstanbul Sour' });
    expect(matchesQuery(cocktailWithI, 'istanbul', resolveIngredientName)).toBe(true);
    expect(matchesQuery(cocktailWithI, 'İSTANBUL', resolveIngredientName)).toBe(true);
  });

  it('matches description text when description variants are supplied', () => {
    const described = makeCocktail({ description: 'A bright citrus classic.' });
    expect(matchesQuery(described, 'citrus', resolveIngredientName, undefined, undefined, ['A bright citrus classic.', 'Parlak bir narenciye klasiği.'])).toBe(true);
    expect(matchesQuery(described, 'narenciye', resolveIngredientName, undefined, undefined, ['A bright citrus classic.', 'Parlak bir narenciye klasiği.'])).toBe(true);
  });
});

describe('matchesFilters', () => {
  const cocktail = makeCocktail();

  it('passes with no active filters', () => {
    expect(matchesFilters(cocktail, emptyFilterState)).toBe(true);
  });

  it('filters by grouped base spirit, not the raw ingredient id', () => {
    const whiskeyCocktail = makeCocktail({ baseSpirit: 'rye-whiskey' });
    expect(matchesFilters(whiskeyCocktail, { ...emptyFilterState, baseSpirits: ['whiskey'] })).toBe(true);
    expect(matchesFilters(cocktail, { ...emptyFilterState, baseSpirits: ['whiskey'] })).toBe(false);
  });

  it('filters by difficulty', () => {
    expect(matchesFilters(cocktail, { ...emptyFilterState, difficulties: ['easy'] })).toBe(true);
    expect(matchesFilters(cocktail, { ...emptyFilterState, difficulties: ['hard'] })).toBe(false);
  });

  it('filters alcohol-free only against the alcohol-free base spirit', () => {
    const mocktail = makeCocktail({ baseSpirit: 'alcohol-free' });
    expect(matchesFilters(mocktail, { ...emptyFilterState, alcoholFreeOnly: true })).toBe(true);
    expect(matchesFilters(cocktail, { ...emptyFilterState, alcoholFreeOnly: true })).toBe(false);
  });

  it('filters by a maximum prep time', () => {
    // fixture default prepTimeMinutes is 3
    expect(matchesFilters(cocktail, { ...emptyFilterState, maxPrepTimeMinutes: 5 })).toBe(true);
    expect(matchesFilters(cocktail, { ...emptyFilterState, maxPrepTimeMinutes: 2 })).toBe(false);
  });

  it('a null maxPrepTimeMinutes applies no cap', () => {
    const slow = makeCocktail({ prepTimeMinutes: 60 });
    expect(matchesFilters(slow, { ...emptyFilterState, maxPrepTimeMinutes: null })).toBe(true);
  });
});

describe('searchCatalog', () => {
  it('combines query and filters', () => {
    const cocktails = [makeCocktail(), makeCocktail({ id: 'martini', name: 'Martini', tags: ['dry', 'strong'] })];
    const results = searchCatalog(cocktails, 'gin', { ...emptyFilterState, tastes: ['refreshing'] }, resolveIngredientName);
    expect(results.map((c) => c.id)).toEqual(['gimlet']);
  });
});
