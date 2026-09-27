import { generateId } from '../../domain/id';
import { FavoriteEntry, FavoriteTargetType, LOCAL_GUEST_OWNER_ID } from '../../domain/types';
import { JsonStore } from '../storage/jsonStore';

/**
 * `ownerId` scopes every read/write to a single signed-in account (or
 * LOCAL_GUEST_OWNER_ID while signed out) — added so favoriting on this
 * device is isolated per account, the same way PersonalRecipe.ownerId
 * already isolates recipes. Callers (favoritesStore) always pass the
 * *current* identity; see src/state/accountScope.ts for why this exists
 * and when stores get reloaded against a new one.
 */
export interface FavoritesRepository {
  getAll(ownerId: string): Promise<FavoriteEntry[]>;
  isFavorite(ownerId: string, targetType: FavoriteTargetType, targetId: string): Promise<boolean>;
  toggle(ownerId: string, targetType: FavoriteTargetType, targetId: string): Promise<boolean>;
  /** Account deletion support, mirroring PersonalRecipe's reassignOwnerToGuestAndPrivatize — the account is gone, but a favorite you made on this device is still yours to keep using, now under the guest identity. See app/delete-account.tsx. */
  reassignOwnerToGuest(ownerId: string): Promise<void>;
  /** Local-data adoption (see src/state/localDataAdoption.ts): how many entries each owner id holds on this device. */
  countByOwner(): Promise<Record<string, number>>;
  /** Local-data adoption: moves every entry owned by any of `fromOwnerIds` to `toOwnerId`, merging without creating duplicates. */
  reassignOwners(fromOwnerIds: string[], toOwnerId: string): Promise<void>;
}

function isFavoriteArray(value: unknown): value is FavoriteEntry[] {
  return (
    Array.isArray(value) &&
    value.every((v) => v && typeof v.id === 'string' && typeof v.targetId === 'string')
  );
}

/** Missing ownerId (data persisted before this field existed) reads as the guest scope — never silently dropped, never leaked into a real account's view. */
function ownerOf(entry: FavoriteEntry): string {
  return entry.ownerId ?? LOCAL_GUEST_OWNER_ID;
}

const store = new JsonStore<FavoriteEntry[]>('@bar/favorites', isFavoriteArray, []);

export const asyncStorageFavoritesRepository: FavoritesRepository = {
  async getAll(ownerId) {
    const all = await store.read();
    return all.filter((f) => ownerOf(f) === ownerId);
  },

  async isFavorite(ownerId, targetType, targetId) {
    const all = await store.read();
    return all.some((f) => ownerOf(f) === ownerId && f.targetType === targetType && f.targetId === targetId);
  },

  async reassignOwnerToGuest(ownerId) {
    await store.update((all) => {
      const mine = all.filter((f) => ownerOf(f) === ownerId);
      const rest = all.filter((f) => ownerOf(f) !== ownerId);
      // The guest scope may already hold some of these targets (favorited
      // before ever signing up) — de-duplicate rather than create two rows
      // for the same target once both are guest-scoped.
      const guestTargets = new Set(
        rest.filter((f) => ownerOf(f) === LOCAL_GUEST_OWNER_ID).map((f) => `${f.targetType}:${f.targetId}`),
      );
      const reassigned = mine
        .filter((f) => !guestTargets.has(`${f.targetType}:${f.targetId}`))
        .map((f) => ({ ...f, ownerId: LOCAL_GUEST_OWNER_ID }));
      return [...rest, ...reassigned];
    });
  },

  async toggle(ownerId, targetType, targetId) {
    let didAdd = false;
    await store.update((all) => {
      const exists = all.some((f) => ownerOf(f) === ownerId && f.targetType === targetType && f.targetId === targetId);
      if (exists) {
        didAdd = false;
        return all.filter((f) => !(ownerOf(f) === ownerId && f.targetType === targetType && f.targetId === targetId));
      }
      didAdd = true;
      const entry: FavoriteEntry = {
        id: generateId('fav'),
        targetType,
        targetId,
        ownerId,
        createdAt: new Date().toISOString(),
      };
      return [...all, entry];
    });
    return didAdd;
  },

  async countByOwner() {
    const counts: Record<string, number> = {};
    for (const e of await store.read()) {
      const owner = ownerOf(e);
      counts[owner] = (counts[owner] ?? 0) + 1;
    }
    return counts;
  },

  async reassignOwners(fromOwnerIds, toOwnerId) {
    const from = new Set(fromOwnerIds.filter((id) => id !== toOwnerId));
    if (from.size === 0) return;
    await store.update((all) => {
      const keyOf = (f: FavoriteEntry) => `${f.targetType}:${f.targetId}`;
      const moving = all.filter((f) => from.has(ownerOf(f)));
      const staying = all.filter((f) => !from.has(ownerOf(f)));
      const destination = new Set(staying.filter((f) => ownerOf(f) === toOwnerId).map(keyOf));
      const moved: FavoriteEntry[] = [];
      for (const f of moving) {
        if (destination.has(keyOf(f))) continue;
        destination.add(keyOf(f));
        moved.push({ ...f, ownerId: toOwnerId });
      }
      return [...staying, ...moved];
    });
  },
};
