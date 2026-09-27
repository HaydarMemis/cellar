import { getSubstitutesFor } from './substitutions';
import { Cocktail, PersonalRecipe, RecipeIngredient } from './types';

function requiredIngredients(ingredients: RecipeIngredient[]): RecipeIngredient[] {
  return ingredients.filter((ri) => !ri.isOptional && !ri.isGarnish);
}

function isAvailable(ingredientId: string, inventoryIds: ReadonlySet<string>): boolean {
  if (inventoryIds.has(ingredientId)) return true;
  return getSubstitutesFor(ingredientId).some((sub) => inventoryIds.has(sub));
}

/**
 * A drink is makeable if every required ingredient is in the inventory, or
 * has a known substitute that is. Optional/garnish ingredients never block
 * a match.
 */
export function canMake(ingredients: RecipeIngredient[], inventoryIds: ReadonlySet<string>): boolean {
  return requiredIngredients(ingredients).every((ri) => isAvailable(ri.ingredientId, inventoryIds));
}

export function missingIngredientIds(
  ingredients: RecipeIngredient[],
  inventoryIds: ReadonlySet<string>,
): string[] {
  return requiredIngredients(ingredients)
    .filter((ri) => !isAvailable(ri.ingredientId, inventoryIds))
    .map((ri) => ri.ingredientId);
}

export type MatchTier = 'full' | 'high' | 'partial';

export interface MissingIngredient {
  ingredientId: string;
  /**
   * A curated substitute that would satisfy this ingredient IF the user
   * also had it — a purchase suggestion, not a claim they already have it.
   * By construction this ingredient is only ever in `missing` because
   * neither it nor any of its substitutes are in inventory, so this id is
   * never something already on hand (see SubstitutedIngredient for that).
   */
  substituteId?: string;
}

export interface SubstitutedIngredient {
  /** The ingredient the recipe actually calls for. */
  ingredientId: string;
  /** The ingredient genuinely in inventory being used in its place. */
  substituteId: string;
}

export interface CocktailMatch<T> {
  item: T;
  requiredTotal: number;
  requiredAvailable: number;
  missing: MissingIngredient[];
  /**
   * Required ingredients NOT directly in inventory but covered by a
   * curated substitute the user genuinely has. A "full" match with a
   * non-empty `substitutions` list must be disclosed in the UI (e.g. "using
   * Vodka instead of Gin") — it is never presented as an exact match. See
   * matching correctness audit: a silent substitution here previously made
   * "You Can Make Now" claim ingredients the user didn't actually have.
   */
  substitutions: SubstitutedIngredient[];
  /** 1 when every required ingredient is available (or substitutable); 0 when none are. */
  percentage: number;
  /**
   * `full` = nothing missing, `high` = missing exactly one required
   * ingredient, `partial` = missing two. Anything weaker than that is
   * `null` and excluded from ranked results — a huge list of low-quality
   * matches isn't useful (see project plan).
   */
  tier: MatchTier | null;
}

/** Scores a single cocktail against the given inventory. Pure and deterministic — no AI, no fuzzy matching. */
export function matchCocktail<T extends Cocktail | PersonalRecipe>(
  item: T,
  inventoryIds: ReadonlySet<string>,
): CocktailMatch<T> {
  const required = requiredIngredients(item.ingredients);
  const requiredTotal = required.length;

  const missing: MissingIngredient[] = [];
  const substitutions: SubstitutedIngredient[] = [];
  let requiredAvailable = 0;

  for (const ri of required) {
    if (inventoryIds.has(ri.ingredientId)) {
      requiredAvailable += 1;
      continue;
    }

    const availableSubstituteId = getSubstitutesFor(ri.ingredientId).find((sub) => inventoryIds.has(sub));
    if (availableSubstituteId) {
      requiredAvailable += 1;
      substitutions.push({ ingredientId: ri.ingredientId, substituteId: availableSubstituteId });
      continue;
    }

    const [suggestedSubstituteId] = getSubstitutesFor(ri.ingredientId);
    missing.push(suggestedSubstituteId ? { ingredientId: ri.ingredientId, substituteId: suggestedSubstituteId } : { ingredientId: ri.ingredientId });
  }

  const percentage = requiredTotal === 0 ? 1 : requiredAvailable / requiredTotal;

  let tier: MatchTier | null = null;
  if (missing.length === 0) tier = 'full';
  else if (missing.length === 1) tier = 'high';
  else if (missing.length === 2) tier = 'partial';

  return { item, requiredTotal, requiredAvailable, missing, substitutions, percentage, tier };
}

export function matchCocktails<T extends Cocktail | PersonalRecipe>(
  items: T[],
  inventoryIds: ReadonlySet<string>,
): CocktailMatch<T>[] {
  return items.map((item) => matchCocktail(item, inventoryIds));
}

const TIER_ORDER: Record<MatchTier, number> = { full: 0, high: 1, partial: 2 };
const DIFFICULTY_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

/**
 * Tiered, ranked matches for "I Have These Ingredients": full matches
 * first, then closest partial matches, weak/no matches excluded entirely.
 * Within a tier: higher match percentage, then fewer missing ingredients,
 * then easier, then quicker — see project plan, ranking section.
 */
export function rankMatches<T extends Cocktail | PersonalRecipe>(
  items: T[],
  inventoryIds: ReadonlySet<string>,
): (CocktailMatch<T> & { tier: MatchTier })[] {
  return matchCocktails(items, inventoryIds)
    .filter((m): m is CocktailMatch<T> & { tier: MatchTier } => m.tier !== null)
    .sort((a, b) => {
      if (TIER_ORDER[a.tier] !== TIER_ORDER[b.tier]) return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;

      const base = (m: CocktailMatch<T>) => m.item as unknown as { difficulty: string; prepTimeMinutes: number };
      const da = DIFFICULTY_ORDER[base(a).difficulty] ?? 1;
      const db = DIFFICULTY_ORDER[base(b).difficulty] ?? 1;
      if (da !== db) return da - db;
      return base(a).prepTimeMinutes - base(b).prepTimeMinutes;
    });
}
