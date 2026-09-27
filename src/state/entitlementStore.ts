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
  /** The store's own page where THIS account manages its subscription (RevenueCat customerInfo.managementURL); null when there's none. */
  managementUrl: string | null;
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
 * Premium must never cross identities, yet must never be downgraded just
 * because the store was unreachable. So every applied status is tagged with
 * the identity it was for:
 * - requestedIdentity: the latest identity authStore asked for
 *   (undefined until the first identify of this run);
 * - statusIdentity: the identity the CURRENT isPremium/activePlan belongs to.
 * An unknown (null) status keeps the last known one only when it belongs to
 * the same identity; for a different identity the answer is "free".
 */
let requestedIdentity: string | null | undefined;
let statusIdentity: string | null | undefined;
let identifySequence = 0;

/**
 * The single place UI reads Premium state from. Premium is only ever set from
 * a status the purchase service reported — never optimistically, never from a
 * missing configuration (see src/data/purchases/index.ts).
 */
export const useEntitlementStore = create<EntitlementState>((set, get) => {
  const apply = (status: EntitlementStatus | null) => {
    // null = the store couldn't say right now (offline, store hiccup): keep
    // the last known status rather than downgrading a paying user.
    if (!status) return;
    statusIdentity = requestedIdentity;
    set({ isPremium: status.isPremium, activePlan: status.activePlan });
  };

  const refreshManagementUrl = async () => {
    const sequence = identifySequence;
    let url: string | null = null;
    try {
      url = (await purchaseService.getManagementUrl?.()) ?? null;
    } catch {
      url = null; // cosmetic: the manage button just stays hidden
    }
    if (sequence === identifySequence) set({ managementUrl: url });
  };

  return {
    isPremium: false,
    activePlan: null,
    isLoaded: false,
    serviceKind: purchaseService.kind,
    offers: [],
    offersState: 'idle',
    managementUrl: null,

    load: async () => {
      if (!unsubscribeStoreUpdates) unsubscribeStoreUpdates = purchaseService.subscribe((status) => apply(status));
      const sequence = identifySequence;
      const status = await purchaseService.getEntitlementStatus();
      // An identity change while this was in flight: the answer is stale.
      if (sequence === identifySequence) apply(status);
      set({ isLoaded: true });
      void refreshManagementUrl();
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
      const sequence = identifySequence;
      const result = await purchaseService.purchase(planId);
      if (result.ok && sequence === identifySequence) {
        apply(result.status);
        void refreshManagementUrl();
      }
      return result;
    },

    restore: async () => {
      const sequence = identifySequence;
      const result = await purchaseService.restorePurchases();
      if (result.ok && sequence === identifySequence) {
        apply(result.status);
        void refreshManagementUrl();
      }
      return result;
    },

    identify: async (userId) => {
      const sequence = ++identifySequence;
      requestedIdentity = userId;
      const status = await purchaseService.identify(userId);
      if (sequence !== identifySequence) return; // a newer identity change won
      if (status) {
        apply(status);
      } else if (statusIdentity !== userId) {
        // Unknown for a DIFFERENT identity than the one the current status
        // belongs to: never carry the previous account's Premium over (and
        // never fall back to the SDK's cached customer info — it can still
        // be the previous account's). Free until the store can say.
        statusIdentity = userId;
        set({ isPremium: false, activePlan: null });
      }
      // else: same identity, store unreachable — keep the last known status.
      set({ managementUrl: null });
      void refreshManagementUrl();
    },

    devDowngradeToFree: async () => {
      if (purchaseService.kind !== 'development') return;
      apply(await devResetToFree());
    },
  };
});
