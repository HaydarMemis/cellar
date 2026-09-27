import { PlanId, planIds, referencePricingUsd } from '../../domain/entitlements';
import { JsonStore } from '../storage/jsonStore';
import { EntitlementStatus, PurchaseService } from './PurchaseService';

/**
 * DEVELOPMENT-ONLY stand-in for a real store, so the entitlement-gated UI can
 * be exercised in a dev client / Expo Go without StoreKit. `purchase()` flips
 * a local flag.
 *
 * It is selected ONLY when `__DEV__` is true (see ./index.ts). A release
 * build without RevenueCat gets UnavailablePurchaseService instead, which can
 * never grant Premium.
 */
function isEntitlementStatus(value: unknown): value is EntitlementStatus {
  const v = value as Partial<EntitlementStatus> | null;
  return !!v && typeof v.isPremium === 'boolean';
}

const store = new JsonStore<EntitlementStatus>('@purchases/devEntitlement', isEntitlementStatus, {
  isPremium: false,
  activePlan: null,
});

export const devPurchaseService: PurchaseService = {
  kind: 'development',

  async getEntitlementStatus() {
    return store.read();
  },

  async getOffers() {
    return planIds.map((planId) => ({ planId, priceString: `$${referencePricingUsd[planId].toFixed(2)}` }));
  },

  async purchase(planId: PlanId) {
    const status: EntitlementStatus = { isPremium: true, activePlan: planId };
    await store.write(status);
    return { ok: true, status };
  },

  async restorePurchases() {
    const status = await store.read();
    return { ok: true, status };
  },

  async identify() {
    return store.read();
  },

  subscribe() {
    return () => undefined;
  },
};

/** Dev-only affordance (a real store has no client-callable downgrade). Only reachable from a `__DEV__`-gated control. */
export async function devResetToFree(): Promise<EntitlementStatus> {
  const status: EntitlementStatus = { isPremium: false, activePlan: null };
  await store.write(status);
  return status;
}
