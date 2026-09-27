import { reportError } from '../lib/crashReporting';
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
/**
 * Hard caps for the two boot steps that can touch the network. Auth already
 * bounds its own network waits (SupabaseAuthBackend.getSession ~3 s,
 * authTimeouts for the profile lookup) — this is the safety net that
 * guarantees the splash screen can never hang on a network call. A step
 * that hits its cap keeps running and applies its result when it finishes.
 * Mutable for tests only.
 */
export const bootTimeouts = {
  authMs: 12_000,
  entitlementMs: 5_000,
};

async function capped(step: string, work: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<'timed-out'>((resolve) => {
    timer = setTimeout(() => resolve('timed-out'), ms);
  });
  try {
    const result = await Promise.race([work.then(() => 'done' as const), timedOut]);
    if (result === 'timed-out') reportError(new Error(`Boot step "${step}" exceeded ${ms} ms — continuing without waiting`), { module: 'hydrate', action: step });
  } catch (e) {
    reportError(e, { module: 'hydrate', action: step });
  } finally {
    clearTimeout(timer);
  }
}

export async function hydrateStores(): Promise<void> {
  await capped('auth', useAuthStore.getState().load(), bootTimeouts.authMs);
  await Promise.all([
    useRecipesStore.getState().load(),
    useSettingsStore.getState().load(),
    useLocaleStore.getState().load(),
    capped('entitlement', useEntitlementStore.getState().load(), bootTimeouts.entitlementMs),
    useOnboardingStore.getState().load(),
  ]);
}
