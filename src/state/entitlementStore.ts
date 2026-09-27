import { create } from 'zustand';
import { devResetToFree, EntitlementStatus, PlanOffer, purchaseService, PurchaseResult, PurchaseServiceKind } from '../data/purchases';
import { PlanId } from '../domain/entitlements';

interface EntitlementState {
  isPremium: boolean;
  activePlan: PlanId | null;
  isLoaded: boolean;
  /** Which billing backend this build uses — the paywall shows "purchases unavailable" for 'unavailable'. */
  serviceKind: PurchaseServiceKind;
  offers: PlanOffer[];
  offersState: 'idle' | 'loading' | 'loaded' | 'error';
  load: () => Promise<void>;
  loadOffers: () => Promise<void>;
  purchase: (planId: PlanId) => Promise<PurchaseResult>;
  restore: () => Promise<PurchaseResult>;
  /** Called by authStore whenever the signed-in identity changes (sign-in, sign-out, account switch, deletion). */
  identify: (userId: string | null) => Promise<void>;
  /** `__DEV__` builds only (see app/(tabs)/profile.tsx). */
  devDowngradeToFree: () => Promise<void>;
}

let unsubscribeStoreUpdates: (() => void) | null = null;

/**
 * The single place UI reads Premium state from. Premium is only ever set from
 * a status the purchase service reported — never optimistically, never from a
 * missing configuration (see src/data/purchases/index.ts).
 */
export const useEntitlementStore = create<EntitlementState>((set, get) => {
  const apply = (status: EntitlementStatus | null) => {
    // null = the store couldn't say right now (offline, store hiccup): keep
    // the last known status rather than downgrading a paying user.
    if (status) set({ isPremium: status.isPremium, activePlan: status.activePlan });
  };

  return {
    isPremium: false,
    activePlan: null,
    isLoaded: false,
    serviceKind: purchaseService.kind,
    offers: [],
    offersState: 'idle',

    load: async () => {
      if (!unsubscribeStoreUpdates) unsubscribeStoreUpdates = purchaseService.subscribe((status) => apply(status));
      apply(await purchaseService.getEntitlementStatus());
      set({ isLoaded: true });
    },

    loadOffers: async () => {
      if (get().offersState === 'loading') return;
      set({ offersState: 'loading' });
      try {
        const offers = await purchaseService.getOffers();
        set({ offers, offersState: 'loaded' });
      } catch {
        set({ offersState: 'error' });
      }
    },

    purchase: async (planId) => {
      const result = await purchaseService.purchase(planId);
      if (result.ok) apply(result.status);
      return result;
    },

    restore: async () => {
      const result = await purchaseService.restorePurchases();
      if (result.ok) apply(result.status);
      return result;
    },

    identify: async (userId) => {
      const status = await purchaseService.identify(userId);
      if (status) {
        apply(status);
      } else if (purchaseService.kind !== 'development') {
        // Identity unknown after an account change: re-read rather than
        // carrying the previous account's Premium over.
        const fresh = await purchaseService.getEntitlementStatus();
        if (fresh) apply(fresh);
        else if (!userId) set({ isPremium: false, activePlan: null });
      }
    },

    devDowngradeToFree: async () => {
      if (purchaseService.kind !== 'development') return;
      apply(await devResetToFree());
    },
  };
});
