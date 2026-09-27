import { canCreateAnotherRecipe, FREE_RECIPE_LIMIT, hasFeature, planIds, referencePricingUsd, yearlyEffectiveMonthlyUsd, yearlySavingsPercent } from '../entitlements';

describe('hasFeature', () => {
  it('never grants a feature to a non-premium user', () => {
    expect(hasFeature(false, 'recipeScaling')).toBe(false);
    expect(hasFeature(false, 'unlimitedRecipes')).toBe(false);
  });

  it('grants every feature to a premium user', () => {
    expect(hasFeature(true, 'recipeScaling')).toBe(true);
    expect(hasFeature(true, 'shoppingList')).toBe(true);
    expect(hasFeature(true, 'tastingJournal')).toBe(true);
    expect(hasFeature(true, 'adFree')).toBe(true);
  });
});

describe('canCreateAnotherRecipe', () => {
  it('is unlimited for a premium user regardless of current count', () => {
    expect(canCreateAnotherRecipe(true, 0)).toBe(true);
    expect(canCreateAnotherRecipe(true, FREE_RECIPE_LIMIT)).toBe(true);
    expect(canCreateAnotherRecipe(true, FREE_RECIPE_LIMIT * 10)).toBe(true);
  });

  it('allows a free user up to the limit and blocks at it', () => {
    expect(canCreateAnotherRecipe(false, 0)).toBe(true);
    expect(canCreateAnotherRecipe(false, FREE_RECIPE_LIMIT - 1)).toBe(true);
    expect(canCreateAnotherRecipe(false, FREE_RECIPE_LIMIT)).toBe(false);
    expect(canCreateAnotherRecipe(false, FREE_RECIPE_LIMIT + 5)).toBe(false);
  });
});

describe('reference pricing', () => {
  it('defines a positive USD reference price for every plan', () => {
    for (const planId of planIds) {
      expect(referencePricingUsd[planId]).toBeGreaterThan(0);
    }
  });

  it('the yearly plan is genuinely cheaper per-month than paying monthly (a real, non-fabricated discount)', () => {
    expect(yearlyEffectiveMonthlyUsd()).toBeLessThan(referencePricingUsd.monthly);
  });

  it('the yearly savings percent is a real, positive number under 100', () => {
    const percent = yearlySavingsPercent();
    expect(percent).toBeGreaterThan(0);
    expect(percent).toBeLessThan(100);
    // Sanity-check the actual math rather than a hardcoded expected number, so this stays correct if pricing changes.
    const expected = Math.round((1 - referencePricingUsd.yearly / (referencePricingUsd.monthly * 12)) * 100);
    expect(percent).toBe(expected);
  });

  it('lifetime costs more than a single year of the subscription, to keep recurring revenue the more attractive default', () => {
    expect(referencePricingUsd.lifetime).toBeGreaterThan(referencePricingUsd.yearly);
  });

  it('monthly costs less than yearly, and yearly costs less than lifetime — plans are strictly ordered by commitment', () => {
    expect(referencePricingUsd.monthly).toBeLessThan(referencePricingUsd.yearly);
    expect(referencePricingUsd.yearly).toBeLessThan(referencePricingUsd.lifetime);
  });
});
