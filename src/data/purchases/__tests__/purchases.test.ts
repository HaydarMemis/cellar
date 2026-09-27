/**
 * Premium must only ever come from a real store transaction (or, in __DEV__
 * builds only, the local test stand-in) — never from billing being
 * unconfigured, and never optimistically.
 */
import { selectPurchaseService } from '..';
import { devPurchaseService } from '../DevPurchaseService';
import { introOfferText } from '../introOfferText';
import {
  __resetRevenueCatIdentityForTests,
  introOfferFrom,
  purchaseErrorFrom,
  revenueCatPurchaseService,
  statusFromCustomerInfo,
  usableRevenueCatKey,
} from '../RevenueCatPurchaseService';
import { unavailablePurchaseService } from '../UnavailablePurchaseService';

const mockSdk = {
  configure: jest.fn(),
  getCustomerInfo: jest.fn(),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  logIn: jest.fn(),
  logOut: jest.fn(),
  isAnonymous: jest.fn(),
  getAppUserID: jest.fn(),
  checkTrialOrIntroductoryPriceEligibility: jest.fn(),
  showManageSubscriptions: jest.fn(),
  addCustomerInfoUpdateListener: jest.fn(),
};
jest.mock('react-native-purchases', () => ({ __esModule: true, default: mockSdk }));


function customerInfo(productIdentifier?: string, managementURL: string | null = null) {
  return { entitlements: { active: productIdentifier ? { premium: { productIdentifier } } : {} }, managementURL } as never;
}

// The real react-native-purchases PurchasesIntroPrice shape (a 1-week free trial).
const weekTrial = { price: 0, priceString: '₺0,00', cycles: 1, period: 'P1W', periodUnit: 'WEEK', periodNumberOfUnits: 1 };
const offering = {
  current: {
    monthly: { product: { identifier: 'cellar_premium_monthly', priceString: '₺149,99', pricePerMonthString: null, introPrice: null } },
    annual: { product: { identifier: 'cellar_premium_yearly', priceString: '₺899,99', pricePerMonthString: '₺75,00', introPrice: weekTrial } },
    lifetime: null,
  },
};
const ELIGIBLE = 2;
const INELIGIBLE = 1;
const UNKNOWN = 0;

beforeAll(() => {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'appl_test_public_key';
});

beforeEach(() => {
  Object.values(mockSdk).forEach((fn) => fn.mockReset());
  __resetRevenueCatIdentityForTests();
});

describe('selectPurchaseService', () => {
  it('uses RevenueCat whenever it is configured', () => {
    expect(selectPurchaseService(true, false).kind).toBe('store');
    expect(selectPurchaseService(true, true).kind).toBe('store');
  });

  it('a RELEASE build without billing gets the unavailable service — never the free dev entitlement', () => {
    expect(selectPurchaseService(false, false)).toBe(unavailablePurchaseService);
  });

  it('only __DEV__ builds fall back to the local test entitlement', () => {
    expect(selectPurchaseService(false, true)).toBe(devPurchaseService);
  });
});

describe('unavailablePurchaseService', () => {
  it('can never grant Premium', async () => {
    expect(await unavailablePurchaseService.getEntitlementStatus()).toEqual({ isPremium: false, activePlan: null });
    expect(await unavailablePurchaseService.purchase('yearly')).toEqual({ ok: false, error: 'unavailable' });
    expect(await unavailablePurchaseService.restorePurchases()).toEqual({ ok: false, error: 'unavailable' });
    expect(await unavailablePurchaseService.identify('u1')).toEqual({ isPremium: false, activePlan: null });
    expect(await unavailablePurchaseService.getOffers()).toEqual([]);
  });
});

describe('RevenueCat mapping', () => {
  it('maps the active premium entitlement to a plan', () => {
    expect(statusFromCustomerInfo(customerInfo('cellar_premium_yearly'))).toEqual({ isPremium: true, activePlan: 'yearly' });
    expect(statusFromCustomerInfo(customerInfo('cellar_premium_lifetime'))).toEqual({ isPremium: true, activePlan: 'lifetime' });
    expect(statusFromCustomerInfo(customerInfo())).toEqual({ isPremium: false, activePlan: null });
  });

  it('maps store error codes', () => {
    expect(purchaseErrorFrom({ userCancelled: true })).toBe('cancelled');
    expect(purchaseErrorFrom({ code: '1' })).toBe('cancelled');
    expect(purchaseErrorFrom({ code: '20' })).toBe('pending');
    expect(purchaseErrorFrom({ code: '10' })).toBe('network');
    expect(purchaseErrorFrom({ code: '35' })).toBe('network');
    expect(purchaseErrorFrom({ code: '3' })).toBe('not-allowed');
    expect(purchaseErrorFrom({ code: '6' })).toBe('already-owned');
    expect(purchaseErrorFrom({ code: '99' })).toBe('failed');
  });
});

describe('revenueCatPurchaseService', () => {
  // Updated: the old mock put display text ("1 hafta ücretsiz") into
  // introPrice.priceString, which the real SDK never does — priceString is
  // the intro PRICE ("₺0,00" for a trial), so the app showed "₺0,00" with no
  // duration. The mock now uses the real PurchasesIntroPrice shape and the
  // service returns structured fields (formatted by introOfferText), shown
  // only when StoreKit says this user is eligible.
  it('offers the store’s localized prices, only for packages that exist, with an eligible intro offer', async () => {
    mockSdk.getOfferings.mockResolvedValue(offering);
    mockSdk.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ cellar_premium_yearly: { status: ELIGIBLE, description: '' } });
    const offers = await revenueCatPurchaseService.getOffers();
    expect(offers).toEqual([
      { planId: 'monthly', priceString: '₺149,99', pricePerMonthString: undefined, introOffer: undefined },
      {
        planId: 'yearly',
        priceString: '₺899,99',
        pricePerMonthString: '₺75,00',
        introOffer: { kind: 'free-trial', priceString: '₺0,00', periodUnit: 'week', periodCount: 1, cycles: 1 },
      },
    ]);
    expect(mockSdk.checkTrialOrIntroductoryPriceEligibility).toHaveBeenCalledWith(['cellar_premium_yearly']);
  });

  it('iOS: no intro offer unless StoreKit says ELIGIBLE (ineligible, unknown, or the check failing)', async () => {
    mockSdk.getOfferings.mockResolvedValue(offering);
    for (const status of [INELIGIBLE, UNKNOWN]) {
      mockSdk.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ cellar_premium_yearly: { status, description: '' } });
      expect((await revenueCatPurchaseService.getOffers())[1].introOffer).toBeUndefined();
    }
    mockSdk.checkTrialOrIntroductoryPriceEligibility.mockRejectedValue(new Error('offline'));
    const offers = await revenueCatPurchaseService.getOffers();
    expect(offers).toHaveLength(2); // plans still shown
    expect(offers[1].introOffer).toBeUndefined();
  });

  it('a successful purchase that unlocks the entitlement grants Premium', async () => {
    mockSdk.getOfferings.mockResolvedValue(offering);
    mockSdk.purchasePackage.mockResolvedValue({ customerInfo: customerInfo('cellar_premium_yearly') });
    expect(await revenueCatPurchaseService.purchase('yearly')).toEqual({ ok: true, status: { isPremium: true, activePlan: 'yearly' } });
  });

  // Updated: still never reported as Premium, but the code is now
  // 'not-activated' instead of 'failed' — the store DID take the payment, so
  // the screen must not say "Purchase didn't go through / you weren't
  // charged"; it says "purchase received, tap Restore or contact support".
  it('a completed transaction that does NOT unlock the entitlement is not reported as Premium', async () => {
    mockSdk.getOfferings.mockResolvedValue(offering);
    mockSdk.purchasePackage.mockResolvedValue({ customerInfo: customerInfo() });
    expect(await revenueCatPurchaseService.purchase('yearly')).toEqual({ ok: false, error: 'not-activated' });
  });

  it('purchase failures surface their reason', async () => {
    mockSdk.getOfferings.mockResolvedValue(offering);
    mockSdk.purchasePackage.mockRejectedValue({ code: '1', userCancelled: true });
    expect(await revenueCatPurchaseService.purchase('monthly')).toEqual({ ok: false, error: 'cancelled' });
    mockSdk.purchasePackage.mockRejectedValue({ code: '10' });
    expect(await revenueCatPurchaseService.purchase('monthly')).toEqual({ ok: false, error: 'network' });
  });

  it('a plan with no configured package is unavailable (lifetime here)', async () => {
    mockSdk.getOfferings.mockResolvedValue(offering);
    expect(await revenueCatPurchaseService.purchase('lifetime')).toEqual({ ok: false, error: 'unavailable' });
  });

  it('restore returns the store status; failures are reported, not treated as "nothing to restore"', async () => {
    mockSdk.restorePurchases.mockResolvedValue(customerInfo('cellar_premium_monthly'));
    expect(await revenueCatPurchaseService.restorePurchases()).toEqual({ ok: true, status: { isPremium: true, activePlan: 'monthly' } });
    mockSdk.restorePurchases.mockRejectedValue({ code: '10' });
    expect(await revenueCatPurchaseService.restorePurchases()).toEqual({ ok: false, error: 'network' });
  });

  it('status is "unknown" (null) when the store can’t be reached — never a downgrade', async () => {
    mockSdk.getCustomerInfo.mockRejectedValue(new Error('offline'));
    expect(await revenueCatPurchaseService.getEntitlementStatus()).toBeNull();
  });

  // Updated only by stubbing getAppUserID (the service now checks the SDK's
  // current identity first, to skip a redundant logIn); same assertions.
  it('identify logs the account in and returns that account’s status; sign-out logs out', async () => {
    mockSdk.getAppUserID.mockResolvedValue('$RCAnonymousID:abc');
    mockSdk.logIn.mockResolvedValue({ customerInfo: customerInfo('cellar_premium_yearly'), created: false });
    expect(await revenueCatPurchaseService.identify('11111111-1111-4111-8111-111111111111')).toEqual({ isPremium: true, activePlan: 'yearly' });
    expect(mockSdk.logIn).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    mockSdk.isAnonymous.mockResolvedValue(false);
    mockSdk.logOut.mockResolvedValue(customerInfo());
    expect(await revenueCatPurchaseService.identify(null)).toEqual({ isPremium: false, activePlan: null });
  });
});

describe('RevenueCat identity is never crossed (sdk.logIn / logOut failing)', () => {
  const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  it('logIn(B) fails while the SDK is still A: B is free, never A’s Premium', async () => {
    mockSdk.getAppUserID.mockResolvedValue(A);
    mockSdk.getCustomerInfo.mockResolvedValue(customerInfo('cellar_premium_yearly')); // A's cached info
    mockSdk.logIn.mockRejectedValue({ code: '10' });
    expect(await revenueCatPurchaseService.identify(B)).toEqual({ isPremium: false, activePlan: null });
    // …and later reads retry the switch, still refusing A's entitlements:
    expect(await revenueCatPurchaseService.getEntitlementStatus()).toEqual({ isPremium: false, activePlan: null });
    expect(mockSdk.logIn).toHaveBeenCalledTimes(2);
    expect(mockSdk.getCustomerInfo).not.toHaveBeenCalled();
  });

  it('once the retried logIn works, B’s own status is read', async () => {
    mockSdk.getAppUserID.mockResolvedValue(A);
    mockSdk.logIn.mockRejectedValueOnce({ code: '10' });
    await revenueCatPurchaseService.identify(B);
    mockSdk.logIn.mockImplementation(async () => {
      mockSdk.getAppUserID.mockResolvedValue(B);
      return { customerInfo: customerInfo(), created: false };
    });
    mockSdk.getCustomerInfo.mockResolvedValue(customerInfo('cellar_premium_monthly'));
    expect(await revenueCatPurchaseService.getEntitlementStatus()).toEqual({ isPremium: true, activePlan: 'monthly' });
  });

  it('logOut failing on sign-out: the guest does not keep the account’s Premium', async () => {
    mockSdk.isAnonymous.mockResolvedValue(false);
    mockSdk.logOut.mockRejectedValue({ code: '10' });
    mockSdk.getCustomerInfo.mockResolvedValue(customerInfo('cellar_premium_lifetime'));
    expect(await revenueCatPurchaseService.identify(null)).toEqual({ isPremium: false, activePlan: null });
    expect(await revenueCatPurchaseService.getEntitlementStatus()).toEqual({ isPremium: false, activePlan: null });
  });

  it('purchase and restore refuse (retryable network error) while the identity is wrong', async () => {
    mockSdk.getAppUserID.mockResolvedValue(A);
    mockSdk.logIn.mockRejectedValue({ code: '10' });
    await revenueCatPurchaseService.identify(B);
    expect(await revenueCatPurchaseService.purchase('yearly')).toEqual({ ok: false, error: 'network' });
    expect(await revenueCatPurchaseService.restorePurchases()).toEqual({ ok: false, error: 'network' });
    expect(mockSdk.purchasePackage).not.toHaveBeenCalled();
    expect(mockSdk.restorePurchases).not.toHaveBeenCalled();
  });

  it('offline cold start on the SAME identity: no logIn round-trip, cached status returned', async () => {
    mockSdk.getAppUserID.mockResolvedValue(A);
    mockSdk.getCustomerInfo.mockResolvedValue(customerInfo('cellar_premium_yearly'));
    expect(await revenueCatPurchaseService.identify(A)).toEqual({ isPremium: true, activePlan: 'yearly' });
    expect(mockSdk.logIn).not.toHaveBeenCalled();
  });

  it('same identity but the store unreachable: unknown (null), not a downgrade', async () => {
    mockSdk.getAppUserID.mockResolvedValue(A);
    mockSdk.getCustomerInfo.mockRejectedValue({ code: '10' });
    expect(await revenueCatPurchaseService.identify(A)).toBeNull();
  });

  it('management URL comes from the account’s customer info', async () => {
    mockSdk.getAppUserID.mockResolvedValue(A);
    mockSdk.getCustomerInfo.mockResolvedValue(customerInfo('cellar_premium_monthly', 'https://apps.apple.com/account/subscriptions'));
    await revenueCatPurchaseService.identify(A);
    expect(await revenueCatPurchaseService.getManagementUrl!()).toBe('https://apps.apple.com/account/subscriptions');
  });
});

describe('store error codes (react-native-purchases v10 PURCHASES_ERROR_CODE)', () => {
  it('maps receipt-owned-by-another-account and store problems', () => {
    expect(purchaseErrorFrom({ code: '7' })).toBe('other-account'); // RECEIPT_ALREADY_IN_USE_ERROR
    expect(purchaseErrorFrom({ code: '13' })).toBe('other-account'); // RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR
    expect(purchaseErrorFrom({ code: '2' })).toBe('store-problem'); // STORE_PROBLEM_ERROR
  });
});

describe('RevenueCat API key', () => {
  it('a Test Store key (test_…) is ignored in release builds, allowed in development', () => {
    expect(usableRevenueCatKey('test_abc', false)).toBeUndefined();
    expect(usableRevenueCatKey('test_abc', true)).toBe('test_abc');
    expect(usableRevenueCatKey('appl_abc', false)).toBe('appl_abc');
    expect(usableRevenueCatKey(undefined, false)).toBeUndefined();
  });
});

describe('intro offer text', () => {
  const en = jest.requireActual('../../../i18n/locales/en/ui').ui;
  const { translateFrom } = jest.requireActual('../../../i18n/translate');
  const t = (key: string, options?: Record<string, string | number>) => translateFrom(en, key, options);

  it('free trial: duration and what it costs afterwards', () => {
    expect(introOfferText(introOfferFrom(weekTrial as never)!, 'yearly', '$29.99', t as never)).toBe('1-week free trial, then $29.99/year');
    const days = { ...weekTrial, periodUnit: 'DAY', periodNumberOfUnits: 7 };
    expect(introOfferText(introOfferFrom(days as never)!, 'monthly', '$4.99', t as never)).toBe('7-day free trial, then $4.99/month');
  });

  it('paid intro: pay-up-front and pay-as-you-go', () => {
    const upFront = { price: 2.99, priceString: '$2.99', cycles: 1, period: 'P3M', periodUnit: 'MONTH', periodNumberOfUnits: 3 };
    expect(introOfferText(introOfferFrom(upFront as never)!, 'monthly', '$4.99', t as never)).toBe('$2.99 for 3 months, then $4.99/month');
    const perMonth = { price: 0.99, priceString: '$0.99', cycles: 3, period: 'P1M', periodUnit: 'MONTH', periodNumberOfUnits: 1 };
    expect(introOfferText(introOfferFrom(perMonth as never)!, 'monthly', '$4.99', t as never)).toBe('$0.99/month for 3 months, then $4.99/month');
  });

  it('nothing for lifetime or an unusable intro period', () => {
    expect(introOfferText(introOfferFrom(weekTrial as never)!, 'lifetime', '$59.99', t as never)).toBeNull();
    expect(introOfferFrom({ ...weekTrial, periodUnit: 'FORTNIGHT' } as never)).toBeUndefined();
  });
});
