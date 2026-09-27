import { ingredients } from '../../../data/catalog/ingredients';

/**
 * English ingredient names are single-sourced from the domain ingredient
 * catalog itself (its `name` field), so there is exactly one place that
 * defines them. Only the Turkish translation is authored separately.
 */
export const ingredientNames: Record<string, string> = Object.fromEntries(
  ingredients.map((i) => [i.id, i.name]),
);
