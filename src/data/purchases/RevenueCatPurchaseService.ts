import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { PlanId } from '../../domain/entitlements';
import { reportError } from '../../lib/crashReporting';
import { EntitlementStatus, PlanOffer, PurchaseErrorCode, PurchaseService } from './PurchaseService';

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

function revenueCatApiKey(): string | undefined {
  return Platform.select<string | undefined>({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    default: undefined,
  });
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

/** RevenueCat PURCHASES_ERROR_CODE values (react-native-purchases) → this app's error codes. */
export function purchaseErrorFrom(e: unknown): PurchaseErrorCode {
  const err = e as { code?: string; userCancelled?: boolean } | undefined;
  if (err?.userCancelled || err?.code === '1') return 'cancelled';
  switch (err?.code) {
    case '20':
      return 'pending';
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
    for (const listener of listeners) listener(status);
  });
}

/**
 * Establishes (or clears) RevenueCat's notion of "who is this". Call with the
 * signed-in Supabase user id after sign-in / on boot with a restored session,
 * and with null on sign-out. The id is what the revenuecat-webhook Edge
 * Function receives as `app_user_id` and mirrors into `public.subscribers`.
 * `logIn` also transfers a purchase made while anonymous to the account.
 */
async function identify(userId: string | null): Promise<EntitlementStatus | null> {
  const sdk = await getSdk();
  if (!sdk) return null;
  try {
    if (userId) {
      const { customerInfo } = await sdk.logIn(userId);
      return statusFromCustomerInfo(customerInfo);
    }
    const isAnonymous = await sdk.isAnonymous().catch(() => false);
    if (isAnonymous) return statusFromCustomerInfo(await sdk.getCustomerInfo());
    return statusFromCustomerInfo(await sdk.logOut());
  } catch (e) {
    // Never let identity sync block auth.
    reportError(e, { module: 'RevenueCatPurchaseService', action: 'identify' });
    return null;
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
      const offers: PlanOffer[] = [];
      for (const planId of ['monthly', 'yearly', 'lifetime'] as PlanId[]) {
        const pkg = packages[planId];
        if (!pkg) continue;
        offers.push({
          planId,
          priceString: pkg.product.priceString,
          pricePerMonthString: planId === 'yearly' ? pkg.product.pricePerMonthString ?? undefined : undefined,
          introOffer: pkg.product.introPrice?.priceString ?? undefined,
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
        return { ok: false, error: 'failed' };
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
};
