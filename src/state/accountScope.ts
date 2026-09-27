import { useFavoritesStore } from './favoritesStore';
import { useInventoryStore } from './inventoryStore';
import { useJournalStore } from './journalStore';
import { useShoppingListStore } from './shoppingListStore';

/**
 * Account-scoping for this device's local-only personal data.
 *
 * Cellar is local-first by design — favorites, ingredient inventory, the
 * tasting journal, and the shopping list all work fully offline, with no
 * account required (see the production audit's "offline-first must
 * remain" requirement from earlier phases). That's still true. What this
 * file fixes is a real gap the auth-lifecycle audit found: none of those
 * four stores were scoped to *which* account is signed in on this device
 * at all. Concretely, before this: User A signs in, favorites some
 * cocktails, logs out; User B signs in on the same phone — and sees User
 * A's favorites, inventory, tasting notes, and shopping list, because
 * they were all one global blob per device, not per account. Personal
 * recipes already avoided this (PersonalRecipe.ownerId existed from the
 * start); these four didn't.
 *
 * The fix (see FavoritesRepository/InventoryRepository/JournalRepository/
 * ShoppingListRepository, and domain/types.ts's ownerId additions) reuses
 * that exact existing convention: every entry is stamped with an ownerId
 * (LOCAL_GUEST_OWNER_ID while signed out), and every store's `load()`
 * filters to the CURRENT identity (src/state/authStore.ts's
 * currentOwnerId()). This file is what makes that filtering actually
 * happen at the right moments — cold start (a session may already be
 * restored), sign-up, sign-in, and log-out — by re-invoking each store's
 * `load()`/clearing in-memory state exactly when the identity changes.
 * See useAuthStore's load/signUp/logIn/logOut actions for the call sites.
 *
 * Deliberately NOT scoped this way: settings and locale (genuinely
 * device-wide preferences, not personal data — a shared device's theme
 * or language isn't "whose" data), and entitlement/premium status (backed
 * by RevenueCat, which has its own per-device/per-purchase identity model
 * — see identifyRevenueCatUser). Recipes were already correctly modeled
 * with ownerId from the start; only their *display* (My Bar's "My
 * recipes" list previously showed every locally-stored recipe regardless
 * of owner) needed a fix — see app/(tabs)/my-bar.tsx.
 */
export async function reloadAccountScopedLocalData(): Promise<void> {
  await Promise.all([
    useFavoritesStore.getState().load(),
    useInventoryStore.getState().load(),
    useJournalStore.getState().load(),
    useShoppingListStore.getState().load(),
  ]);
}

/**
 * Synchronously clears in-memory state the instant a session ends —
 * before the (async) reload for whatever identity comes next even has a
 * chance to run. Without this, there's a window (log out -> before the
 * next sign-in) where a screen re-render could still show the outgoing
 * account's data, since `load()` for the new state (empty, guest) is
 * async. This is purely an in-memory clear — nothing is deleted from
 * AsyncStorage; the outgoing account's data is still there, still scoped
 * to their ownerId, ready to reload the next time they sign back in.
 */
export function clearAccountScopedLocalData(): void {
  useFavoritesStore.setState({ favorites: [] });
  useInventoryStore.setState({ entries: [] });
  useJournalStore.setState({ entries: [] });
  useShoppingListStore.setState({ entries: [] });
}
