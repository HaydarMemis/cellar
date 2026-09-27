import { EntitlementStatus, PurchaseResult } from '../../data/purchases';

const mockService = {
  kind: 'store' as const,
  getEntitlementStatus: jest.fn<Promise<EntitlementStatus | null>, []>(),
  getOffers: jest.fn(),
  purchase: jest.fn<Promise<PurchaseResult>, [string]>(),
  restorePurchases: jest.fn<Promise<PurchaseResult>, []>(),
  identify: jest.fn<Promise<EntitlementStatus | null>, [string | null]>(),
  subscribe: jest.fn(() => () => undefined),
};
jest.mock('../../data/purchases', () => ({
  get purchaseService() {
    return mockService;
  },
  devResetToFree: jest.fn(),
}));

// Required (not imported) so the mock above is initialized first.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useEntitlementStore } = require('../entitlementStore') as typeof import('../entitlementStore');

const premium: EntitlementStatus = { isPremium: true, activePlan: 'yearly' };
const free: EntitlementStatus = { isPremium: false, activePlan: null };

beforeEach(() => {
  Object.values(mockService).forEach((v) => typeof v === 'function' && 'mockReset' in v && (v as jest.Mock).mockReset());
  mockService.subscribe.mockImplementation(() => () => undefined);
  useEntitlementStore.setState({ isPremium: false, activePlan: null, isLoaded: false, offers: [], offersState: 'idle' });
});

describe('useEntitlementStore', () => {
  it('a failed purchase never grants Premium and returns the reason', async () => {
    mockService.purchase.mockResolvedValue({ ok: false, error: 'network' });
    const result = await useEntitlementStore.getState().purchase('yearly');
    expect(result).toEqual({ ok: false, error: 'network' });
    expect(useEntitlementStore.getState().isPremium).toBe(false);
  });

  it('a successful purchase applies the store-reported status', async () => {
    mockService.purchase.mockResolvedValue({ ok: true, status: premium });
    await useEntitlementStore.getState().purchase('yearly');
    expect(useEntitlementStore.getState()).toMatchObject(premium);
  });

  it('restore applies the restored status (and "nothing found" stays free)', async () => {
    mockService.restorePurchases.mockResolvedValue({ ok: true, status: free });
    await useEntitlementStore.getState().restore();
    expect(useEntitlementStore.getState().isPremium).toBe(false);
    mockService.restorePurchases.mockResolvedValue({ ok: true, status: premium });
    await useEntitlementStore.getState().restore();
    expect(useEntitlementStore.getState().isPremium).toBe(true);
  });

  it('offline (unknown status) keeps the last known Premium instead of downgrading', async () => {
    useEntitlementStore.setState(premium);
    mockService.getEntitlementStatus.mockResolvedValue(null);
    await useEntitlementStore.getState().load();
    expect(useEntitlementStore.getState().isPremium).toBe(true);
  });

  it('subscription expiry reported by the store downgrades', async () => {
    useEntitlementStore.setState(premium);
    mockService.getEntitlementStatus.mockResolvedValue(free);
    await useEntitlementStore.getState().load();
    expect(useEntitlementStore.getState().isPremium).toBe(false);
  });

  it('account switch: the new account’s status replaces the old one', async () => {
    useEntitlementStore.setState(premium);
    mockService.identify.mockResolvedValue(free);
    await useEntitlementStore.getState().identify('user-b');
    expect(useEntitlementStore.getState().isPremium).toBe(false);
  });

  it('sign-out with the store unreachable does not carry Premium over', async () => {
    useEntitlementStore.setState(premium);
    mockService.identify.mockResolvedValue(null);
    mockService.getEntitlementStatus.mockResolvedValue(null);
    await useEntitlementStore.getState().identify(null);
    expect(useEntitlementStore.getState().isPremium).toBe(false);
  });

  it('store-pushed updates (renewal/refund) are applied', async () => {
    let push: (s: EntitlementStatus) => void = () => undefined;
    mockService.subscribe.mockImplementation(((listener: (s: EntitlementStatus) => void) => {
      push = listener;
      return () => undefined;
    }) as never);
    mockService.getEntitlementStatus.mockResolvedValue(free);
    // A fresh module instance: the store subscribes once per app lifetime.
    let fresh!: typeof useEntitlementStore;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      fresh = (require('../entitlementStore') as typeof import('../entitlementStore')).useEntitlementStore;
    });
    await fresh.getState().load();
    push(premium);
    expect(fresh.getState().isPremium).toBe(true);
  });

  it('loads the store’s offers', async () => {
    mockService.getOffers.mockResolvedValue([{ planId: 'monthly', priceString: '€4,99' }]);
    await useEntitlementStore.getState().loadOffers();
    expect(useEntitlementStore.getState()).toMatchObject({ offersState: 'loaded', offers: [{ planId: 'monthly', priceString: '€4,99' }] });
  });
});
