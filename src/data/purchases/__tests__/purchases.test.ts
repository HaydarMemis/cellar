/**
 * Premium must only ever come from a real store transaction (or, in __DEV__
 * builds only, the local test stand-in) — never from billing being
 * unconfigured, and never optimistically.
 */
import { selectPurchaseService } from '..';
import { devPurchaseService } from '../DevPurchaseService';
import { purchaseErrorFrom, revenueCatPurchaseService, statusFromCustomerInfo } from '../RevenueCatPurchaseService';
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
  addCustomerInfoUpdateListener: jest.fn(),
};
jest.mock('react-native-purchases', () => ({ __esModule: true, default: mockSdk }));


function customerInfo(productIdentifier?: string) {
  return { entitlements: { active: productIdentifier ? { premium: { productIdentifier } } : {} } } as never;
}

const offering = {
  current: {
    monthly: { product: { priceString: '₺149,99', pricePerMonthString: null, introPrice: null } },
    annual: { product: { priceString: '₺899,99', pricePerMonthString: '₺75,00', introPrice: { priceString: '1 hafta ücretsiz' } } },
    lifetime: null,
  },
};

beforeAll(() => {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'appl_test_public_key';
});

beforeEach(() => {
  Object.values(mockSdk).forEach((fn) => fn.mockReset());
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
  it('offers the store’s localized prices, only for packages that exist', async () => {
    mockSdk.getOfferings.mockResolvedValue(offering);
    const offers = await revenueCatPurchaseService.getOffers();
    expect(offers).toEqual([
      { planId: 'monthly', priceString: '₺149,99', pricePerMonthString: undefined, introOffer: undefined },
      { planId: 'yearly', priceString: '₺899,99', pricePerMonthString: '₺75,00', introOffer: '1 hafta ücretsiz' },
    ]);
  });

  it('a successful purchase that unlocks the entitlement grants Premium', async () => {
    mockSdk.getOfferings.mockResolvedValue(offering);
    mockSdk.purchasePackage.mockResolvedValue({ customerInfo: customerInfo('cellar_premium_yearly') });
    expect(await revenueCatPurchaseService.purchase('yearly')).toEqual({ ok: true, status: { isPremium: true, activePlan: 'yearly' } });
  });

  it('a completed transaction that does NOT unlock the entitlement is not reported as Premium', async () => {
    mockSdk.getOfferings.mockResolvedValue(offering);
    mockSdk.purchasePackage.mockResolvedValue({ customerInfo: customerInfo() });
    expect(await revenueCatPurchaseService.purchase('yearly')).toEqual({ ok: false, error: 'failed' });
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

  it('identify logs the account in and returns that account’s status; sign-out logs out', async () => {
    mockSdk.logIn.mockResolvedValue({ customerInfo: customerInfo('cellar_premium_yearly'), created: false });
    expect(await revenueCatPurchaseService.identify('11111111-1111-4111-8111-111111111111')).toEqual({ isPremium: true, activePlan: 'yearly' });
    expect(mockSdk.logIn).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    mockSdk.isAnonymous.mockResolvedValue(false);
    mockSdk.logOut.mockResolvedValue(customerInfo());
    expect(await revenueCatPurchaseService.identify(null)).toEqual({ isPremium: false, activePlan: null });
  });
});
