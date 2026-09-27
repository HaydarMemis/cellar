import { useAuthStore } from './authStore';
import { useEntitlementStore } from './entitlementStore';
import { useLocaleStore } from './localeStore';
import { useOnboardingStore } from './onboardingStore';
import { useRecipesStore } from './recipesStore';
import { useSettingsStore } from './settingsStore';

/**
 * Loads every persisted store from AsyncStorage once, at app boot. Auth
 * loads first, strictly before everything else — not just for recipes'
 * ownerId (as before), but because useAuthStore.load() now also loads the
 * four account-scoped local stores itself (favorites, inventory, journal,
 * shopping list — see accountScope.ts), since they need to know who's
 * signed in *before* they can load the right data at all. Do not add
 * those four here — loading them a second time in the Promise.all below
 * would just be redundant, not wrong, but it's not needed.
 */
export async function hydrateStores(): Promise<void> {
  await useAuthStore.getState().load();
  await Promise.all([
    useRecipesStore.getState().load(),
    useSettingsStore.getState().load(),
    useLocaleStore.getState().load(),
    useEntitlementStore.getState().load(),
    useOnboardingStore.getState().load(),
  ]);
}
