import AsyncStorage from '@react-native-async-storage/async-storage';
import { asyncStorageFavoritesRepository } from '../data/repositories/FavoritesRepository';
import { asyncStorageInventoryRepository } from '../data/repositories/InventoryRepository';
import { asyncStorageJournalRepository } from '../data/repositories/JournalRepository';
import { asyncStorageRecipeRepository } from '../data/repositories/RecipeRepository';
import { asyncStorageShoppingListRepository } from '../data/repositories/ShoppingListRepository';
import { LOCAL_GUEST_OWNER_ID } from '../domain/types';
import { isUuid } from '../domain/uuid';
import { reportError } from '../lib/crashReporting';
import { reloadAccountScopedLocalData } from './accountScope';
import { useRecipesStore } from './recipesStore';

/**
 * Local-data adoption: making sure data created on this device WITHOUT the
 * account that's now signed in never silently "disappears".
 *
 * Every personal store is scoped by ownerId (see accountScope.ts), so two
 * kinds of on-device data are invisible to a signed-in account:
 *
 * 1. Guest data — created while signed out (ownerId = LOCAL_GUEST_OWNER_ID).
 *    Before this, signing in hid all of it until you signed out again.
 * 2. Legacy device-only account data — created under the pre-Supabase local
 *    account system, whose account ids look like `user-…`. No Supabase
 *    session can ever match those ids, so that data was stranded forever.
 *
 * Neither is deleted or moved automatically: after sign-in the user is asked
 * once (see LocalDataAdoptionPrompt) whether to add it to their account.
 * Data owned by ANOTHER real (uuid) account on this device is never offered —
 * that's someone else's data.
 */
export interface AdoptableData {
  ownerIds: string[];
  recipes: number;
  favorites: number;
  inventory: number;
  journal: number;
  shoppingList: number;
}

export function totalAdoptable(data: AdoptableData): number {
  return data.recipes + data.favorites + data.inventory + data.journal + data.shoppingList;
}

/**
 * @param includeLegacyLocalAccounts true when accounts are Supabase-backed
 *   (uuid ids). With the local dev backend every account id is `user-…`, so
 *   legacy detection would wrongly offer other local accounts' data.
 */
export function isAdoptableOwner(ownerId: string, currentUserId: string, includeLegacyLocalAccounts: boolean): boolean {
  if (ownerId === currentUserId) return false;
  if (ownerId === LOCAL_GUEST_OWNER_ID) return true;
  return includeLegacyLocalAccounts && !isUuid(ownerId);
}

export async function findAdoptableData(currentUserId: string, includeLegacyLocalAccounts: boolean): Promise<AdoptableData> {
  const [recipes, favorites, inventory, journal, shoppingList] = await Promise.all([
    asyncStorageRecipeRepository.countByOwner(),
    asyncStorageFavoritesRepository.countByOwner(),
    asyncStorageInventoryRepository.countByOwner(),
    asyncStorageJournalRepository.countByOwner(),
    asyncStorageShoppingListRepository.countByOwner(),
  ]);
  const owners = new Set<string>();
  const sum = (counts: Record<string, number>) => {
    let total = 0;
    for (const [owner, count] of Object.entries(counts)) {
      if (!isAdoptableOwner(owner, currentUserId, includeLegacyLocalAccounts) || count === 0) continue;
      owners.add(owner);
      total += count;
    }
    return total;
  };
  return {
    recipes: sum(recipes),
    favorites: sum(favorites),
    inventory: sum(inventory),
    journal: sum(journal),
    shoppingList: sum(shoppingList),
    ownerIds: Array.from(owners).sort(),
  };
}

/** Moves the given owners' on-device data to `toOwnerId` across every personal store, then reloads the in-memory stores. */
export async function adoptLocalData(toOwnerId: string, fromOwnerIds: string[]): Promise<void> {
  const from = fromOwnerIds.filter((id) => id !== toOwnerId);
  if (from.length === 0) return;
  await Promise.all([
    asyncStorageRecipeRepository.reassignOwners(from, toOwnerId),
    asyncStorageFavoritesRepository.reassignOwners(from, toOwnerId),
    asyncStorageInventoryRepository.reassignOwners(from, toOwnerId),
    asyncStorageJournalRepository.reassignOwners(from, toOwnerId),
    asyncStorageShoppingListRepository.reassignOwners(from, toOwnerId),
  ]);
  await useRecipesStore.getState().load();
  await reloadAccountScopedLocalData();
}

const DECLINED_KEY_PREFIX = '@adoption/declined:';

/** A stable fingerprint of what was offered, so "Not now" isn't asked again for the same data — but new guest data later IS offered. */
export function adoptionSignature(data: AdoptableData): string {
  return [data.ownerIds.join(','), data.recipes, data.favorites, data.inventory, data.journal, data.shoppingList].join('|');
}

export async function wasAdoptionDeclined(userId: string, data: AdoptableData): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DECLINED_KEY_PREFIX + userId)) === adoptionSignature(data);
  } catch {
    return false;
  }
}

export async function rememberAdoptionDeclined(userId: string, data: AdoptableData): Promise<void> {
  try {
    await AsyncStorage.setItem(DECLINED_KEY_PREFIX + userId, adoptionSignature(data));
  } catch (e) {
    reportError(e, { module: 'localDataAdoption', action: 'rememberDeclined' });
  }
}
