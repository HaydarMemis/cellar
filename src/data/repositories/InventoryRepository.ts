import { IngredientInventoryEntry, LOCAL_GUEST_OWNER_ID } from '../../domain/types';
import { JsonStore } from '../storage/jsonStore';

/** See FavoritesRepository's doc comment — same ownerId account-isolation convention. */
export interface InventoryRepository {
  getAll(ownerId: string): Promise<IngredientInventoryEntry[]>;
  has(ownerId: string, ingredientId: string): Promise<boolean>;
  toggle(ownerId: string, ingredientId: string): Promise<boolean>;
  clear(ownerId: string): Promise<void>;
  /** Account deletion support — see FavoritesRepository.reassignOwnerToGuest's doc comment for the reasoning; same de-duplication concern applies (an ingredient might already be marked "have it" under the guest scope from before signing up). */
  reassignOwnerToGuest(ownerId: string): Promise<void>;
  /** Local-data adoption (see src/state/localDataAdoption.ts): how many entries each owner id holds on this device. */
  countByOwner(): Promise<Record<string, number>>;
  /** Local-data adoption: moves every entry owned by any of `fromOwnerIds` to `toOwnerId`, merging without creating duplicates. */
  reassignOwners(fromOwnerIds: string[], toOwnerId: string): Promise<void>;
}

function isInventoryArray(value: unknown): value is IngredientInventoryEntry[] {
  return Array.isArray(value) && value.every((v) => v && typeof v.ingredientId === 'string');
}

function ownerOf(entry: IngredientInventoryEntry): string {
  return entry.ownerId ?? LOCAL_GUEST_OWNER_ID;
}

const store = new JsonStore<IngredientInventoryEntry[]>('@bar/inventory', isInventoryArray, []);

export const asyncStorageInventoryRepository: InventoryRepository = {
  async getAll(ownerId) {
    const all = await store.read();
    return all.filter((e) => ownerOf(e) === ownerId);
  },

  async has(ownerId, ingredientId) {
    const all = await store.read();
    return all.some((e) => ownerOf(e) === ownerId && e.ingredientId === ingredientId);
  },

  async toggle(ownerId, ingredientId) {
    let didAdd = false;
    await store.update((all) => {
      const exists = all.some((e) => ownerOf(e) === ownerId && e.ingredientId === ingredientId);
      if (exists) {
        didAdd = false;
        return all.filter((e) => !(ownerOf(e) === ownerId && e.ingredientId === ingredientId));
      }
      didAdd = true;
      return [...all, { ingredientId, ownerId, addedAt: new Date().toISOString() }];
    });
    return didAdd;
  },

  async clear(ownerId) {
    await store.update((all) => all.filter((e) => ownerOf(e) !== ownerId));
  },

  async reassignOwnerToGuest(ownerId) {
    await store.update((all) => {
      const mine = all.filter((e) => ownerOf(e) === ownerId);
      const rest = all.filter((e) => ownerOf(e) !== ownerId);
      const guestIds = new Set(rest.filter((e) => ownerOf(e) === LOCAL_GUEST_OWNER_ID).map((e) => e.ingredientId));
      const reassigned = mine.filter((e) => !guestIds.has(e.ingredientId)).map((e) => ({ ...e, ownerId: LOCAL_GUEST_OWNER_ID }));
      return [...rest, ...reassigned];
    });
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
      const moving = all.filter((e) => from.has(ownerOf(e)));
      const staying = all.filter((e) => !from.has(ownerOf(e)));
      const destination = new Set(staying.filter((e) => ownerOf(e) === toOwnerId).map((e) => e.ingredientId));
      const moved: IngredientInventoryEntry[] = [];
      for (const e of moving) {
        if (destination.has(e.ingredientId)) continue;
        destination.add(e.ingredientId);
        moved.push({ ...e, ownerId: toOwnerId });
      }
      return [...staying, ...moved];
    });
  },
};
