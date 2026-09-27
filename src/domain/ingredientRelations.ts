import { Cocktail } from './types';

/** Every cocktail (built-in or personal) that lists this ingredient as a required or optional component. */
export function getCocktailsUsingIngredient<T extends { ingredients: { ingredientId: string }[] }>(
  ingredientId: string,
  cocktails: T[],
): T[] {
  return cocktails.filter((c) => c.ingredients.some((ri) => ri.ingredientId === ingredientId));
}

/**
 * Ingredients that most often co-occur with `ingredientId` across the
 * catalog — a deterministic, computed "related ingredients" list rather
 * than a hand-maintained one, so it stays accurate as the catalog grows.
 */
export function getRelatedIngredients(ingredientId: string, cocktails: Cocktail[], limit = 8): string[] {
  const counts = new Map<string, number>();

  for (const cocktail of cocktails) {
    const ids = cocktail.ingredients.map((ri) => ri.ingredientId);
    if (!ids.includes(ingredientId)) continue;
    for (const id of ids) {
      if (id === ingredientId) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
