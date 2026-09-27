import { addNetworkStateListener } from 'expo-network';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { reportError } from '../../lib/crashReporting';
import { useAuthStore } from '../../state/authStore';
import { useEntitlementStore } from '../../state/entitlementStore';
import { useRecipesStore } from '../../state/recipesStore';

/**
 * Renders nothing. Finishes work that couldn't complete earlier, at the
 * moments it's most likely to succeed:
 * - signing in / a restored session → retry pending recipe publishes;
 * - returning to the foreground → retry, and refresh Premium (a renewal,
 *   expiry or refund may have happened while the app was closed);
 * - regaining connectivity → retry.
 */
export function BackgroundSync() {
  const userId = useAuthStore((s) => s.profile?.id ?? null);
  const wasConnected = useRef<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    useRecipesStore.getState().retryPendingSync().catch((e) => reportError(e, { module: 'BackgroundSync', action: 'signedIn' }));
  }, [userId]);

  useEffect(() => {
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      useRecipesStore.getState().retryPendingSync().catch((e) => reportError(e, { module: 'BackgroundSync', action: 'foreground' }));
      useEntitlementStore.getState().load().catch((e) => reportError(e, { module: 'BackgroundSync', action: 'entitlement' }));
    });

    let network: { remove: () => void } | null = null;
    try {
      network = addNetworkStateListener(({ isConnected, isInternetReachable }) => {
        const online = !!isConnected && isInternetReachable !== false;
        if (online && wasConnected.current === false) {
          useRecipesStore.getState().retryPendingSync().catch((e) => reportError(e, { module: 'BackgroundSync', action: 'reconnect' }));
        }
        wasConnected.current = online;
      });
    } catch (e) {
      reportError(e, { module: 'BackgroundSync', action: 'networkListener' });
    }

    return () => {
      appState.remove();
      network?.remove();
    };
  }, []);

  return null;
}
