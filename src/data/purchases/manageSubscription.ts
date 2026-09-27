import { Linking, Platform } from 'react-native';
import { reportError } from '../../lib/crashReporting';
import { purchaseService } from './index';

const STORE_SUBSCRIPTIONS_URL = Platform.select({
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
  default: undefined,
});

/**
 * Opens where the person manages their subscription, in order of accuracy:
 * 1. the account's own managementURL from the store (RevenueCat
 *    customerInfo.managementURL — the right store, and on Android the
 *    right product);
 * 2. iOS: the App Store's in-app manage-subscriptions sheet;
 * 3. the store's generic subscriptions page.
 */
export async function openManageSubscription(managementUrl: string | null): Promise<void> {
  if (managementUrl) {
    try {
      await Linking.openURL(managementUrl);
      return;
    } catch (e) {
      reportError(e, { module: 'manageSubscription', action: 'openManagementUrl' });
    }
  }
  if (purchaseService.showManageSubscriptions && (await purchaseService.showManageSubscriptions())) return;
  if (STORE_SUBSCRIPTIONS_URL) await Linking.openURL(STORE_SUBSCRIPTIONS_URL).catch(() => undefined);
}
