import { Amount, RecipeIngredient } from './types';

/**
 * Recipes are written for 1 serving; scaling multiplies structured amounts.
 * Not wired into any MVP screen yet, but the data model (Amount as
 * {value, unit} rather than a display string) exists specifically so this
 * never needs a data migration when the scaling UI ships.
 */
export function scaleAmount(amount: Amount, servings: number): Amount {
  return { value: roundToTwoDecimals(amount.value * servings), unit: amount.unit };
}

export function scaleIngredient(
  ingredient: RecipeIngredient,
  servings: number,
): RecipeIngredient {
  if (!ingredient.amount) return ingredient;
  return { ...ingredient, amount: scaleAmount(ingredient.amount, servings) };
}

export function scaleIngredients(
  ingredients: RecipeIngredient[],
  servings: number,
): RecipeIngredient[] {
  return ingredients.map((ri) => scaleIngredient(ri, servings));
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
