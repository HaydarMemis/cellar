import { RecipeIngredient } from './types';

export interface ShoppingListItem {
  ingredientId: string;
  neededForCount: number;
}

/**
 * Builds a deduplicated shopping list from one or more recipes' ingredient
 * lists, skipping garnish and anything already in the inventory. Pure and
 * deterministic — no quantities are summed across recipes (units can
 * differ), just which distinct ingredients to go buy and how many of the
 * given recipes call for each, most-needed first.
 */
export function buildShoppingList(
  ingredientLists: RecipeIngredient[][],
  inventoryIds: ReadonlySet<string>,
): ShoppingListItem[] {
  const counts = new Map<string, number>();

  for (const ingredients of ingredientLists) {
    const uniqueInThisRecipe = new Set(
      ingredients.filter((ri) => !ri.isGarnish && !inventoryIds.has(ri.ingredientId)).map((ri) => ri.ingredientId),
    );
    for (const id of uniqueInThisRecipe) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([ingredientId, neededForCount]) => ({ ingredientId, neededForCount }))
    .sort((a, b) => b.neededForCount - a.neededForCount || a.ingredientId.localeCompare(b.ingredientId));
}
