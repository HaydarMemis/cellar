import { scaleAmount, scaleIngredient, scaleIngredients } from '../scaling';
import { RecipeIngredient } from '../types';

describe('scaleAmount', () => {
  it('multiplies the value by the servings factor', () => {
    expect(scaleAmount({ value: 50, unit: 'ml' }, 2)).toEqual({ value: 100, unit: 'ml' });
  });

  it('handles fractional servings and rounds to two decimals', () => {
    expect(scaleAmount({ value: 25, unit: 'ml' }, 1.5)).toEqual({ value: 37.5, unit: 'ml' });
    expect(scaleAmount({ value: 33.333, unit: 'ml' }, 3)).toEqual({ value: 100, unit: 'ml' });
  });

  it('never changes the unit', () => {
    expect(scaleAmount({ value: 2, unit: 'dash' }, 4).unit).toBe('dash');
  });
});

describe('scaleIngredient', () => {
  it('scales an ingredient with an amount', () => {
    const ri: RecipeIngredient = {
      ingredientId: 'gin',
      amount: { value: 60, unit: 'ml' },
      isOptional: false,
      isGarnish: false,
    };
    expect(scaleIngredient(ri, 2).amount).toEqual({ value: 120, unit: 'ml' });
  });

  it('leaves a null amount ("to top") untouched regardless of servings', () => {
    const ri: RecipeIngredient = { ingredientId: 'soda-water', amount: null, isOptional: false, isGarnish: false };
    expect(scaleIngredient(ri, 4)).toEqual(ri);
  });
});

describe('scaleIngredients', () => {
  it('scales every ingredient in a recipe consistently', () => {
    const ingredients: RecipeIngredient[] = [
      { ingredientId: 'gin', amount: { value: 60, unit: 'ml' }, isOptional: false, isGarnish: false },
      { ingredientId: 'lime-juice', amount: { value: 20, unit: 'ml' }, isOptional: false, isGarnish: false },
      { ingredientId: 'soda-water', amount: null, isOptional: false, isGarnish: false },
    ];

    const scaled = scaleIngredients(ingredients, 2);
    expect(scaled[0].amount).toEqual({ value: 120, unit: 'ml' });
    expect(scaled[1].amount).toEqual({ value: 40, unit: 'ml' });
    expect(scaled[2].amount).toBeNull();
  });

  it('at 1 serving, returns amounts equal to the originals', () => {
    const ingredients: RecipeIngredient[] = [
      { ingredientId: 'gin', amount: { value: 60, unit: 'ml' }, isOptional: false, isGarnish: false },
    ];
    expect(scaleIngredients(ingredients, 1)).toEqual(ingredients);
  });
});
