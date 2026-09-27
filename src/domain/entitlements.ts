/**
 * Centralized definition of what Premium unlocks and what the free tier
 * allows. Nothing in the UI layer should ever hardcode `isPremium = true` or
 * scatter its own feature checks — screens ask `useEntitlementStore` (which
 * asks the active PurchaseService, see src/data/purchases) and gate through
 * the helpers below. This file has zero UI/storage dependencies so the rule
 * set itself is easy to reason about and unit test.
 */

export type PlanId = 'monthly' | 'yearly' | 'lifetime';

export const planIds: PlanId[] = ['monthly', 'yearly', 'lifetime'];

/**
 * Reference USD pricing — informs the real product/pricing strategy and
 * what the paywall UI displays today, but is NOT a live store price. A real
 * App Store/Play product's price (in the buyer's actual currency, set in
 * App Store Connect / Play Console) always wins once billing is connected;
 * see src/data/purchases/PurchaseService.ts. Benchmarked against comparable
 * cocktail/recipe apps (typically $2.99–4.99/mo, ~$20–30/yr) — priced at
 * the upper end given this app's broader feature set (accounts/publishing,
 * scaling, shopping lists, a tasting journal), with yearly positioned as
 * the clear best value (50% off the monthly rate) and lifetime priced
 * above a year of the subscription on purpose, to nudge toward recurring
 * revenue while still rewarding a genuine one-time commitment.
 */
export const referencePricingUsd: Record<PlanId, number> = {
  monthly: 4.99,
  yearly: 29.99,
  lifetime: 59.99,
};

/** Effective monthly-equivalent price when paying yearly, for the "save X%" framing on the paywall. Real math, not a fabricated discount. */
export function yearlyEffectiveMonthlyUsd(): number {
  return Math.round((referencePricingUsd.yearly / 12) * 100) / 100;
}

export function yearlySavingsPercent(): number {
  const fullYearAtMonthlyRate = referencePricingUsd.monthly * 12;
  return Math.round((1 - referencePricingUsd.yearly / fullYearAtMonthlyRate) * 100);
}

export type PremiumFeature =
  | 'unlimitedRecipes'
  | 'recipeScaling'
  | 'shoppingList'
  | 'tastingJournal'
  | 'adFree';

export const premiumFeatures: PremiumFeature[] = [
  'unlimitedRecipes',
  'recipeScaling',
  'shoppingList',
  'tastingJournal',
];
// 'adFree' stays a valid PremiumFeature (AdSlot already hides ads for
// Premium), but it is NOT advertised on the paywall: no ad network is
// integrated, so "remove ads" would be a benefit that doesn't exist.

/** Personal recipes (private + public combined) a free account may keep. Browsing/search/matching/favorites on the built-in catalog stay unlimited and free regardless. */
export const FREE_RECIPE_LIMIT = 12;

export function hasFeature(isPremium: boolean, feature: PremiumFeature): boolean {
  if (isPremium) return true;
  return false;
}

export function canCreateAnotherRecipe(isPremium: boolean, currentRecipeCount: number): boolean {
  if (isPremium) return true;
  return currentRecipeCount < FREE_RECIPE_LIMIT;
}
