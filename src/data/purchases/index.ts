import { devPurchaseService } from './DevPurchaseService';
import { PurchaseService } from './PurchaseService';
import { isRevenueCatConfigured, revenueCatPurchaseService } from './RevenueCatPurchaseService';
import { unavailablePurchaseService } from './UnavailablePurchaseService';

/**
 * Which billing implementation this build uses:
 * - RevenueCat whenever its public API key for this platform is set.
 * - Otherwise, the local dev stand-in ONLY in `__DEV__` builds.
 * - Otherwise (a release build without billing configured) the unavailable
 *   service, which can never grant Premium. Premium is never granted just
 *   because billing isn't configured.
 */
export function selectPurchaseService(revenueCatConfigured: boolean, isDev: boolean): PurchaseService {
  if (revenueCatConfigured) return revenueCatPurchaseService;
  return isDev ? devPurchaseService : unavailablePurchaseService;
}

export const purchaseService: PurchaseService = selectPurchaseService(
  isRevenueCatConfigured(),
  typeof __DEV__ !== 'undefined' && __DEV__,
);

export * from './PurchaseService';
export { devResetToFree } from './DevPurchaseService';
export { PREMIUM_ENTITLEMENT_ID } from './RevenueCatPurchaseService';
