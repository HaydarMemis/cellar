import { ingredientContentOverrides } from '../../../i18n/locales/tr/ingredientContent';
import { IngredientCategory } from '../../../domain/types';
import { ingredients, ingredientsById } from '../ingredients';

const validCategories = new Set<IngredientCategory>([
  'spirit',
  'liqueur',
  'vermouth',
  'wine',
  'mixer',
  'juice',
  'produce',
  'sweetener',
  'syrup',
  'bitters',
  'garnish',
  'other',
]);

describe('ingredient catalog integrity', () => {
  it('has unique ids', () => {
    const ids = ingredients.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only known category ids', () => {
    for (const ingredient of ingredients) {
      expect(validCategories.has(ingredient.category)).toBe(true);
    }
  });

  it('gives every homemade ingredient a homemadeRecipe, and vice versa', () => {
    for (const ingredient of ingredients) {
      expect(!!ingredient.isHomemade).toBe(!!ingredient.homemadeRecipe);
    }
  });

  it('every homemade recipe references only known ingredient ids', () => {
    for (const ingredient of ingredients) {
      if (!ingredient.homemadeRecipe) continue;
      for (const ri of ingredient.homemadeRecipe.ingredients) {
        expect(ingredientsById.has(ri.ingredientId)).toBe(true);
      }
    }
  });

  it('every homemade recipe has a positive yield, at least one ingredient, and at least one step', () => {
    for (const ingredient of ingredients) {
      if (!ingredient.homemadeRecipe) continue;
      expect(ingredient.homemadeRecipe.yield.value).toBeGreaterThan(0);
      expect(ingredient.homemadeRecipe.ingredients.length).toBeGreaterThan(0);
      expect(ingredient.homemadeRecipe.steps.length).toBeGreaterThan(0);
      expect(ingredient.homemadeRecipe.storageNote.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no stray Turkish content overlay entries for ingredients that no longer exist', () => {
    for (const overrideId of Object.keys(ingredientContentOverrides)) {
      expect(ingredientsById.has(overrideId)).toBe(true);
    }
  });

  it("every homemade ingredient's Turkish overlay has the same number of steps as English", () => {
    for (const ingredient of ingredients) {
      if (!ingredient.homemadeRecipe) continue;
      const override = ingredientContentOverrides[ingredient.id];
      if (override?.homemadeSteps) {
        expect(override.homemadeSteps.length).toBe(ingredient.homemadeRecipe.steps.length);
      }
    }
  });
});
