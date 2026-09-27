import { PlanId } from '../../domain/entitlements';

export interface EntitlementStatus {
  isPremium: boolean;
  activePlan: PlanId | null;
}

/** One purchasable plan as the STORE describes it — `priceString` is the store's own localized price (e.g. "₺149,99"), never a hardcoded number. */
export interface PlanOffer {
  planId: PlanId;
  priceString: string;
  /** Store price per month for a yearly plan, pre-formatted by the store SDK when it can provide it. */
  pricePerMonthString?: string;
  /** Free-trial / intro-offer description if the store product has one (e.g. "1 week free"). */
  introOffer?: string;
}

/**
 * - cancelled: the user backed out of the store sheet — not an error to show.
 * - pending: the purchase awaits approval (Ask to Buy / deferred payment).
 * - network: couldn't reach the store; try again.
 * - not-allowed: purchases are disabled on this device (parental controls).
 * - already-owned: the store says this is already purchased — restore instead.
 * - unavailable: billing isn't available in this build/region, or no product is configured.
 * - failed: anything else.
 */
export type PurchaseErrorCode = 'cancelled' | 'pending' | 'network' | 'not-allowed' | 'already-owned' | 'unavailable' | 'failed';

export type PurchaseResult = { ok: true; status: EntitlementStatus } | { ok: false; error: PurchaseErrorCode };

/**
 * - store: real billing (RevenueCat → StoreKit / Play Billing).
 * - development: the local stand-in, ONLY ever selected in `__DEV__` builds.
 * - unavailable: a release build without billing configured. It can never
 *   grant Premium — see src/data/purchases/index.ts.
 */
export type PurchaseServiceKind = 'store' | 'development' | 'unavailable';

/**
 * The seam between the app and billing. Every premium screen goes through
 * this interface (never a hardcoded flag).
 */
export interface PurchaseService {
  readonly kind: PurchaseServiceKind;
  /** null = unknown right now (offline / store error). Callers keep the last known status instead of downgrading a paying user. */
  getEntitlementStatus(): Promise<EntitlementStatus | null>;
  /** Plans the store currently offers, with localized prices. Empty when nothing is purchasable. */
  getOffers(): Promise<PlanOffer[]>;
  purchase(planId: PlanId): Promise<PurchaseResult>;
  restorePurchases(): Promise<PurchaseResult>;
  /** Ties billing to the signed-in account (null on sign-out) and returns that identity's status (null if unknown). */
  identify(userId: string | null): Promise<EntitlementStatus | null>;
  /** Pushes status changes the store reports on its own (renewal, expiration, refund). Returns an unsubscribe function. */
  subscribe(listener: (status: EntitlementStatus) => void): () => void;
}
