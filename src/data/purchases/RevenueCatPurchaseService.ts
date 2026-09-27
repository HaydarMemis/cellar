import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesIntroPrice, PurchasesPackage } from 'react-native-purchases';
import { PlanId } from '../../domain/entitlements';
import { reportError } from '../../lib/crashReporting';
import { EntitlementStatus, IntroOffer, IntroPeriodUnit, PlanOffer, PurchaseErrorCode, PurchaseService } from './PurchaseService';

/**
 * A REAL billing implementation against RevenueCat (wraps StoreKit on iOS,
 * Play Billing on Android, behind one API and one entitlement model — the
 * "simplest robust architecture" call the production audit asked for,
 * versus hand-rolling react-native-iap + separate receipt validation for
 * each store). This is genuinely production-shaped code, not a stub — but
 * it is only reachable when isRevenueCatConfigured() is true (see
 * src/data/purchases/index.ts), and even then most of what it needs still
 * has to be created by a human in two dashboards; see the doc block below.
 *
 * `react-native-purchases` is a native module: it cannot load inside Expo
 * Go, only a custom dev client / standalone build. Every entry point here
 * dynamically requires it inside a try/catch, exactly like
 * SupabaseSocialAuthProvider's Apple import, so tapping "Upgrade" in Expo
 * Go degrades to `{ ok: false, error: 'unavailable' }` instead of crashing.
 *
 * External setup this needs before it does anything real (see the launch
 * tracker for the authoritative list):
 *  - A RevenueCat project, with an entitlement literally named `premium`
 *    (see PREMIUM_ENTITLEMENT_ID below — must match exactly) attached to
 *    three subscription/non-consumable products.
 *  - Those three products actually created in App Store Connect (In-App
 *    Purchases) and Google Play Console (Products), priced per
 *    src/domain/entitlements.ts's referencePricingUsd, and attached to a
 *    RevenueCat Offering as its `monthly` / `annual` / `lifetime` package
 *    slots (RevenueCat's own package-type shortcuts — no custom ID scheme
 *    to invent or get wrong).
 *  - EXPO_PUBLIC_REVENUECAT_IOS_API_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
 *    (RevenueCat project settings -> API keys -> Public app-specific key).
 *  - Sandbox testing on a real device/TestFlight build (Expo Go and the
 *    Simulator cannot complete a real StoreKit transaction) before this can
 *    be called verified, not just "should work."
 */

/** Must match the entitlement identifier configured in the RevenueCat dashboard (Entitlements tab) exactly, or every purchase will look like it granted nothing. */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

let reportedTestKeyInRelease = false;

/**
 * RevenueCat "Test Store" keys (prefix `test_`) simulate purchases without
 * charging anyone. A release build must never use one — treat billing as
 * unavailable there (the paywall says so) and report it loudly.
 */
export function usableRevenueCatKey(key: string | undefined, isDev: boolean): string | undefined {
  if (!key) return undefined;
  if (!isDev && key.startsWith('test_')) {
    if (!reportedTestKeyInRelease) {
      reportedTestKeyInRelease = true;
      reportError(new Error('RevenueCat Test Store key (test_…) in a release build — billing disabled'), { module: 'RevenueCatPurchaseService', action: 'apiKey' });
    }
    return undefined;
  }
  return key;
}

function revenueCatApiKey(): string | undefined {
  const key = Platform.select<string | undefined>({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    default: undefined,
  });
  return usableRevenueCatKey(key, typeof __DEV__ !== 'undefined' && __DEV__);
}

export function isRevenueCatConfigured(): boolean {
  return !!revenueCatApiKey();
}

type PurchasesDefault = typeof import('react-native-purchases').default;

let cachedSdk: PurchasesDefault | null = null;
let inFlight: Promise<PurchasesDefault | null> | null = null;

async function getSdk(): Promise<PurchasesDefault | null> {
  if (cachedSdk) return cachedSdk;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const apiKey = revenueCatApiKey();
    if (!apiKey) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('react-native-purchases') as typeof import('react-native-purchases');
      const Purchases = mod.default;
      // Configured anonymously; the signed-in account is attached with
      // logIn() (see identify below) as soon as auth state is known.
      Purchases.configure({ apiKey });
      cachedSdk = Purchases;
      return Purchases;
    } catch (e) {
      reportError(e, { module: 'RevenueCatPurchaseService', action: 'configure' });
      return null;
    }
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * Maps the store's active `premium` entitlement to a PlanId. Product ids must
 * contain "month", "year"/"annual" or "lifetime" (documented in
 * RELEASE_CHECKLIST.md). `fallbackPlan` covers the moment right after a
 * purchase of a known plan.
 */
export function statusFromCustomerInfo(info: CustomerInfo, fallbackPlan: PlanId | null = null): EntitlementStatus {
  const entitlement = info.entitlements.active[PREMIUM_ENTITLEMENT_ID];
  if (!entitlement) return { isPremium: false, activePlan: null };

  const id = entitlement.productIdentifier.toLowerCase();
  let activePlan: PlanId | null = null;
  if (id.includes('lifetime')) activePlan = 'lifetime';
  else if (id.includes('year') || id.includes('annual')) activePlan = 'yearly';
  else if (id.includes('month')) activePlan = 'monthly';

  return { isPremium: true, activePlan: activePlan ?? fallbackPlan };
}

/** RevenueCat PURCHASES_ERROR_CODE values (react-native-purchases v10 generated/error-codes) → this app's error codes. */
export function purchaseErrorFrom(e: unknown): PurchaseErrorCode {
  const err = e as { code?: string; userCancelled?: boolean } | undefined;
  if (err?.userCancelled || err?.code === '1') return 'cancelled';
  switch (err?.code) {
    case '20':
      return 'pending';
    case '7': // RECEIPT_ALREADY_IN_USE_ERROR
    case '13': // RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR
      return 'other-account';
    case '2': // STORE_PROBLEM_ERROR
      return 'store-problem';
    case '10':
    case '35':
    case '32':
      return 'network';
    case '3':
    case '19':
      return 'not-allowed';
    case '6':
      return 'already-owned';
    case '5':
    case '23':
    case '24':
      return 'unavailable';
    default:
      return 'failed';
  }
}

const INTRO_UNITS: Record<string, IntroPeriodUnit> = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' };

/** RevenueCat's intro price → this app's structured intro offer (undefined if unusable). */
export function introOfferFrom(intro: PurchasesIntroPrice | null | undefined): IntroOffer | undefined {
  if (!intro) return undefined;
  const periodUnit = INTRO_UNITS[(intro.periodUnit ?? '').toUpperCase()];
  if (!periodUnit || !(intro.periodNumberOfUnits > 0)) return undefined;
  return {
    kind: intro.price === 0 ? 'free-trial' : 'intro-price',
    priceString: intro.priceString,
    periodUnit,
    periodCount: intro.periodNumberOfUnits,
    cycles: intro.cycles > 0 ? intro.cycles : 1,
  };
}

/** INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE (react-native-purchases). */
const INTRO_ELIGIBLE = 2;

/**
 * Product ids whose intro offer THIS user may actually get. iOS: StoreKit
 * eligibility via RevenueCat — only ELIGIBLE counts (UNKNOWN shows the
 * regular price, as RevenueCat recommends, rather than promising a trial the
 * person then doesn't get). Android: Google Play only returns offers the
 * user is eligible for, so a present introPrice is eligible.
 */
async function introEligibleProductIds(sdk: PurchasesDefault, packages: PurchasesPackage[]): Promise<Set<string>> {
  const withIntro = packages.filter((p) => !!p.product.introPrice).map((p) => p.product.identifier);
  if (withIntro.length === 0) return new Set();
  if (Platform.OS !== 'ios') return new Set(withIntro);
  try {
    const eligibility = await sdk.checkTrialOrIntroductoryPriceEligibility(withIntro);
    return new Set(withIntro.filter((id) => (eligibility[id]?.status as number | undefined) === INTRO_ELIGIBLE));
  } catch (e) {
    reportError(e, { module: 'RevenueCatPurchaseService', action: 'introEligibility' });
    return new Set();
  }
}

async function currentPackages(sdk: PurchasesDefault): Promise<Partial<Record<PlanId, PurchasesPackage>>> {
  const offerings = await sdk.getOfferings();
  const offering = offerings.current;
  if (!offering) return {};
  return {
    monthly: offering.monthly ?? undefined,
    yearly: offering.annual ?? undefined,
    lifetime: offering.lifetime ?? undefined,
  };
}

const listeners = new Set<(status: EntitlementStatus) => void>();
let sdkListenerInstalled = false;

async function ensureSdkListener(): Promise<void> {
  if (sdkListenerInstalled) return;
  const sdk = await getSdk();
  if (!sdk) return;
  sdkListenerInstalled = true;
  sdk.addCustomerInfoUpdateListener((info) => {
    const status = statusFromCustomerInfo(info);
    // An update for an identity the app has already switched away from
    // (e.g. a logIn that failed) must not be presented to the current one.
    void identityMatches(sdk).then((matches) => {
      if (!matches) return;
      for (const listener of listeners) listener(status);
    });
  });
}

/**
 * The identity the APP wants billing to be for: the signed-in Supabase user
 * id, null for a guest (RevenueCat anonymous id), undefined until auth has
 * said. RevenueCat's own current identity can lag behind it — sdk.logIn(B)
 * can fail (offline) while the SDK is still logged in as A — and its
 * customer info then belongs to A. Nothing here ever reports one identity's
 * entitlements to another: see ensureIdentity.
 */
let desiredUserId: string | null | undefined;

const FREE: EntitlementStatus = { isPremium: false, activePlan: null };

async function identityMatches(sdk: PurchasesDefault): Promise<boolean> {
  if (desiredUserId === undefined) return true;
  try {
    if (desiredUserId === null) return await sdk.isAnonymous();
    return (await sdk.getAppUserID()) === desiredUserId;
  } catch {
    return false;
  }
}

/**
 * Makes RevenueCat's identity match desiredUserId, retrying the logIn/logOut
 * that failed earlier. Resolves false if it still doesn't match — callers
 * must then not use (or act on) the SDK's customer info.
 */
async function ensureIdentity(sdk: PurchasesDefault): Promise<boolean> {
  if (await identityMatches(sdk)) return true;
  const target = desiredUserId;
  try {
    if (target) await sdk.logIn(target);
    else await sdk.logOut();
  } catch (e) {
    reportError(e, { module: 'RevenueCatPurchaseService', action: 'ensureIdentity' });
  }
  return identityMatches(sdk);
}

/**
 * Establishes (or clears) RevenueCat's notion of "who is this". Call with the
 * signed-in Supabase user id after sign-in / on boot with a restored session,
 * and with null on sign-out. The id is what the revenuecat-webhook Edge
 * Function receives as `app_user_id` and mirrors into `public.subscribers`.
 * `logIn` also transfers a purchase made while anonymous to the account.
 *
 * Returns that identity's status; null = unknown right now (e.g. offline,
 * SDK already on this identity) — never another identity's status: if the
 * switch didn't happen, the answer is "free" until it does.
 */
async function identify(userId: string | null): Promise<EntitlementStatus | null> {
  desiredUserId = userId;
  const sdk = await getSdk();
  if (!sdk) return null;
  try {
    if (userId) {
      // Already this identity (RevenueCat persists it across launches):
      // no logIn round-trip — which also keeps an offline cold start on the
      // SDK's cached customer info instead of a failed network call.
      const current = await sdk.getAppUserID().catch(() => null);
      if (current === userId) return statusFromCustomerInfo(await sdk.getCustomerInfo());
      const { customerInfo } = await sdk.logIn(userId);
      return statusFromCustomerInfo(customerInfo);
    }
    const isAnonymous = await sdk.isAnonymous().catch(() => false);
    if (isAnonymous) return statusFromCustomerInfo(await sdk.getCustomerInfo());
    return statusFromCustomerInfo(await sdk.logOut());
  } catch (e) {
    // Never let identity sync block auth.
    reportError(e, { module: 'RevenueCatPurchaseService', action: 'identify' });
    if (desiredUserId !== userId) return null; // superseded by a newer identify
    return (await identityMatches(sdk)) ? null : FREE;
  }
}

/** Back-compat export used by authStore. */
export async function identifyRevenueCatUser(userId: string | null): Promise<void> {
  await identify(userId);
}

export const revenueCatPurchaseService: PurchaseService = {
  kind: 'store',

  async getEntitlementStatus() {
    const sdk = await getSdk();
    if (!sdk) return null;
    void ensureSdkListener();
    // Still on another identity (a logIn/logOut that failed and can't be
    // retried right now): that identity's cached Premium is not ours.
    if (!(await ensureIdentity(sdk))) return FREE;
    try {
      // The SDK serves its on-device cache when offline, so a paying user
      // keeps Premium without a connection.
      return statusFromCustomerInfo(await sdk.getCustomerInfo());
    } catch (e) {
      reportError(e, { module: 'RevenueCatPurchaseService', action: 'getCustomerInfo' });
      return null; // unknown — the caller keeps the last known status
    }
  },

  async getOffers() {
    const sdk = await getSdk();
    if (!sdk) return [];
    try {
      const packages = await currentPackages(sdk);
      const eligible = await introEligibleProductIds(sdk, Object.values(packages).filter((p): p is PurchasesPackage => !!p));
      const offers: PlanOffer[] = [];
      for (const planId of ['monthly', 'yearly', 'lifetime'] as PlanId[]) {
        const pkg = packages[planId];
        if (!pkg) continue;
        const intro = planId !== 'lifetime' && eligible.has(pkg.product.identifier) ? introOfferFrom(pkg.product.introPrice) : undefined;
        offers.push({
          planId,
          priceString: pkg.product.priceString,
          pricePerMonthString: planId === 'yearly' ? pkg.product.pricePerMonthString ?? undefined : undefined,
          introOffer: intro,
        });
      }
      return offers;
    } catch (e) {
      reportError(e, { module: 'RevenueCatPurchaseService', action: 'getOfferings' });
      return [];
    }
  },

  async purchase(planId) {
    const sdk = await getSdk();
    if (!sdk) return { ok: false, error: 'unavailable' };
    // Never buy on behalf of the wrong account: the purchase would be
    // attributed to whichever identity the SDK is still on.
    if (!(await ensureIdentity(sdk))) return { ok: false, error: 'network' };
    try {
      const pkg = (await currentPackages(sdk))[planId];
      if (!pkg) {
        reportError(new Error('No RevenueCat package configured for plan'), { module: 'RevenueCatPurchaseService', action: 'purchase', planId });
        return { ok: false, error: 'unavailable' };
      }
      const result = await sdk.purchasePackage(pkg);
      const status = statusFromCustomerInfo(result.customerInfo, planId);
      // A completed transaction that didn't unlock the entitlement means the
      // dashboard's entitlement ↔ product mapping is wrong — report it rather
      // than telling the user they're Premium.
      if (!status.isPremium) {
        reportError(new Error('Purchase completed but premium entitlement not active'), { module: 'RevenueCatPurchaseService', action: 'purchase', planId });
        // The store took the transaction — don't tell the person it "failed".
        return { ok: false, error: 'not-activated' };
      }
      return { ok: true, status };
    } catch (e) {
      const error = purchaseErrorFrom(e);
      if (error !== 'cancelled') reportError(e, { module: 'RevenueCatPurchaseService', action: 'purchasePackage', planId });
      return { ok: false, error };
    }
  },

  async restorePurchases() {
    const sdk = await getSdk();
    if (!sdk) return { ok: false, error: 'unavailable' };
    // Restoring links the store account's purchases to the CURRENT identity.
    if (!(await ensureIdentity(sdk))) return { ok: false, error: 'network' };
    try {
      return { ok: true, status: statusFromCustomerInfo(await sdk.restorePurchases()) };
    } catch (e) {
      reportError(e, { module: 'RevenueCatPurchaseService', action: 'restorePurchases' });
      return { ok: false, error: purchaseErrorFrom(e) };
    }
  },

  identify,

  subscribe(listener) {
    listeners.add(listener);
    void ensureSdkListener();
    return () => {
      listeners.delete(listener);
    };
  },

  async getManagementUrl() {
    const sdk = await getSdk();
    if (!sdk) return null;
    try {
      if (!(await identityMatches(sdk))) return null;
      return (await sdk.getCustomerInfo()).managementURL ?? null;
    } catch (e) {
      reportError(e, { module: 'RevenueCatPurchaseService', action: 'getManagementUrl' });
      return null;
    }
  },

  async showManageSubscriptions() {
    if (Platform.OS !== 'ios') return false;
    const sdk = await getSdk();
    if (!sdk) return false;
    try {
      await sdk.showManageSubscriptions();
      return true;
    } catch (e) {
      reportError(e, { module: 'RevenueCatPurchaseService', action: 'showManageSubscriptions' });
      return false;
    }
  },
};

/** For tests: forget the app-requested identity. */
export function __resetRevenueCatIdentityForTests(): void {
  desiredUserId = undefined;
}
