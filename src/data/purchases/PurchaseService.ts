import { PlanId } from '../../domain/entitlements';

export interface EntitlementStatus {
  isPremium: boolean;
  activePlan: PlanId | null;
}

export type IntroPeriodUnit = 'day' | 'week' | 'month' | 'year';

/**
 * A free trial or introductory price, as the store describes it — only ever
 * present when THIS user is eligible for it (iOS: checked with StoreKit via
 * RevenueCat; Android: Google Play only offers eligible offers). The screen
 * formats it (see src/data/purchases/introOfferText.ts).
 */
export interface IntroOffer {
  /** 'free-trial' when the intro price is 0. */
  kind: 'free-trial' | 'intro-price';
  /** The store's localized intro price per period (e.g. "$0.99"; "$0.00" for a trial). */
  priceString: string;
  periodUnit: IntroPeriodUnit;
  /** Length of ONE intro billing period, in `periodUnit`s (e.g. 1 week, 3 months). */
  periodCount: number;
  /** How many intro billing periods (e.g. 3 × 1 month at the intro price). */
  cycles: number;
}

/** One purchasable plan as the STORE describes it — `priceString` is the store's own localized price (e.g. "₺149,99"), never a hardcoded number. */
export interface PlanOffer {
  planId: PlanId;
  priceString: string;
  /** Store price per month for a yearly plan, pre-formatted by the store SDK when it can provide it. */
  pricePerMonthString?: string;
  /** Free trial / intro price, only when the store says this user is eligible. */
  introOffer?: IntroOffer;
}

/**
 * - cancelled: the user backed out of the store sheet — not an error to show.
 * - pending: the purchase awaits approval (Ask to Buy / deferred payment).
 * - network: couldn't reach the store; try again.
 * - not-allowed: purchases are disabled on this device (parental controls).
 * - already-owned: the store says this is already purchased — restore instead.
 * - unavailable: billing isn't available in this build/region, or no product is configured.
 * - other-account: the store receipt is already linked to a DIFFERENT app
 *   account (RevenueCat RECEIPT_ALREADY_IN_USE / RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER).
 * - store-problem: a transient App Store / Play problem; retryable.
 * - not-activated: the store completed the transaction but Premium isn't
 *   active (yet) — the person may have paid; restore / contact support.
 * - failed: anything else.
 */
export type PurchaseErrorCode =
  | 'cancelled'
  | 'pending'
  | 'network'
  | 'not-allowed'
  | 'already-owned'
  | 'unavailable'
  | 'other-account'
  | 'store-problem'
  | 'not-activated'
  | 'failed';

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
  /** Where THIS account manages its subscription (the store's own page), or null if it has none / unknown. Optional — only real billing has one. */
  getManagementUrl?(): Promise<string | null>;
  /** iOS: presents the App Store's manage-subscriptions sheet. Resolves false if it couldn't. Optional. */
  showManageSubscriptions?(): Promise<boolean>;
}
