import { PurchaseService } from './PurchaseService';

/**
 * What a RELEASE build uses when RevenueCat isn't configured (missing API
 * key for this platform). It never grants Premium and never pretends a
 * purchase happened — the paywall shows "purchases aren't available" instead.
 *
 * This exists because the previous fallback (DevPurchaseService) was also
 * used in release builds, where tapping "Continue" on the paywall silently
 * granted Premium for free.
 */
export const unavailablePurchaseService: PurchaseService = {
  kind: 'unavailable',
  async getEntitlementStatus() {
    return { isPremium: false, activePlan: null };
  },
  async getOffers() {
    return [];
  },
  async purchase() {
    return { ok: false, error: 'unavailable' };
  },
  async restorePurchases() {
    return { ok: false, error: 'unavailable' };
  },
  async identify() {
    return { isPremium: false, activePlan: null };
  },
  subscribe() {
    return () => undefined;
  },
};
