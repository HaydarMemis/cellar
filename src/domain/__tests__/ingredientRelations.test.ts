import { getCocktailsUsingIngredient, getRelatedIngredients } from '../ingredientRelations';
import { Cocktail, RecipeIngredient } from '../types';

function ing(ingredientId: string): RecipeIngredient {
  return { ingredientId, amount: { value: 30, unit: 'ml' }, isOptional: false, isGarnish: false };
}

function makeCocktail(id: string, ingredientIds: string[]): Cocktail {
  return {
    id,
    name: id,
    description: '',
    baseSpirit: 'gin',
    category: [],
    tags: [],
    ingredients: ingredientIds.map(ing),
    method: 'stir',
    steps: [],
    glass: ['coupe'],
    abv: { approx: 20 },
    difficulty: 'easy',
    prepTimeMinutes: 3,
    similarCocktailIds: [],
  };
}

describe('getCocktailsUsingIngredient', () => {
  const martini = makeCocktail('martini', ['gin', 'dry-vermouth']);
  const negroni = makeCocktail('negroni', ['gin', 'campari', 'sweet-vermouth']);
  const daiquiri = makeCocktail('daiquiri', ['white-rum', 'lime-juice']);

  it('finds every cocktail listing the ingredient', () => {
    const result = getCocktailsUsingIngredient('gin', [martini, negroni, daiquiri]);
    expect(result.map((c) => c.id).sort()).toEqual(['martini', 'negroni']);
  });

  it('returns an empty array when nothing uses it', () => {
    expect(getCocktailsUsingIngredient('mezcal', [martini, negroni, daiquiri])).toEqual([]);
  });
});

describe('getRelatedIngredients', () => {
  const martini = makeCocktail('martini', ['gin', 'dry-vermouth']);
  const negroni = makeCocktail('negroni', ['gin', 'campari', 'sweet-vermouth']);
  const martinez = makeCocktail('martinez', ['gin', 'sweet-vermouth']);
  const daiquiri = makeCocktail('daiquiri', ['white-rum', 'lime-juice']);
  const all = [martini, negroni, martinez, daiquiri];

  it('ranks co-occurring ingredients by frequency, most common first', () => {
    const related = getRelatedIngredients('gin', all);
    // sweet-vermouth appears with gin twice (negroni, martinez); dry-vermouth and campari once each.
    expect(related[0]).toBe('sweet-vermouth');
    expect(related).toEqual(expect.arrayContaining(['dry-vermouth', 'campari']));
  });

  it('never includes the ingredient itself', () => {
    expect(getRelatedIngredients('gin', all)).not.toContain('gin');
  });

  it('is empty for an ingredient used in nothing', () => {
    expect(getRelatedIngredients('mezcal', all)).toEqual([]);
  });

  it('respects the limit parameter', () => {
    expect(getRelatedIngredients('gin', all, 1)).toHaveLength(1);
  });
});
