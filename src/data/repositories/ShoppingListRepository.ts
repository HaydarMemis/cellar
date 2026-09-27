import { generateId } from '../../domain/id';
import { LOCAL_GUEST_OWNER_ID, ShoppingListEntry } from '../../domain/types';
import { JsonStore } from '../storage/jsonStore';

/** See FavoritesRepository's doc comment — same ownerId account-isolation convention. */
export interface ShoppingListRepository {
  getAll(ownerId: string): Promise<ShoppingListEntry[]>;
  /**
   * Adds each ingredient not already on the list as a new, unchecked entry.
   * An ingredient already present and unchecked is left alone (no
   * duplicate row). An ingredient already present and checked off is
   * un-checked and bumped to the top — re-adding something you already
   * bought means you need it again.
   */
  addIngredients(ownerId: string, ingredientIds: string[]): Promise<ShoppingListEntry[]>;
  toggleCompleted(ownerId: string, id: string): Promise<void>;
  remove(ownerId: string, id: string): Promise<void>;
  clearCompleted(ownerId: string): Promise<void>;
  clearAll(ownerId: string): Promise<void>;
  /** Account deletion support — see FavoritesRepository.reassignOwnerToGuest; same de-duplication concern (the guest scope might already have this ingredient on its list). */
  reassignOwnerToGuest(ownerId: string): Promise<void>;
  /** Local-data adoption (see src/state/localDataAdoption.ts): how many entries each owner id holds on this device. */
  countByOwner(): Promise<Record<string, number>>;
  /** Local-data adoption: moves every entry owned by any of `fromOwnerIds` to `toOwnerId`, merging without creating duplicates. */
  reassignOwners(fromOwnerIds: string[], toOwnerId: string): Promise<void>;
}

function isShoppingListArray(value: unknown): value is ShoppingListEntry[] {
  return (
    Array.isArray(value) &&
    value.every((v) => v && typeof v.id === 'string' && typeof v.ingredientId === 'string' && typeof v.completed === 'boolean')
  );
}

function ownerOf(entry: ShoppingListEntry): string {
  return entry.ownerId ?? LOCAL_GUEST_OWNER_ID;
}

const store = new JsonStore<ShoppingListEntry[]>('@bar/shoppingList', isShoppingListArray, []);

export const asyncStorageShoppingListRepository: ShoppingListRepository = {
  async getAll(ownerId) {
    const all = await store.read();
    return all.filter((e) => ownerOf(e) === ownerId);
  },

  async addIngredients(ownerId, ingredientIds) {
    let result: ShoppingListEntry[] = [];
    await store.update((all) => {
      const mine = all.filter((e) => ownerOf(e) === ownerId);
      const others = all.filter((e) => ownerOf(e) !== ownerId);
      const byIngredient = new Map(mine.map((e) => [e.ingredientId, e] as const));
      const now = new Date().toISOString();
      for (const ingredientId of ingredientIds) {
        const existing = byIngredient.get(ingredientId);
        if (existing) {
          if (existing.completed) byIngredient.set(ingredientId, { ...existing, completed: false, addedAt: now });
          // already present and still needed — leave it exactly as is
        } else {
          byIngredient.set(ingredientId, { id: generateId('shop'), ingredientId, ownerId, completed: false, addedAt: now });
        }
      }
      // Newest-first, but a comparator MUST return 0 for equal keys — every
      // ingredient in one addIngredients() batch shares the exact same
      // `now` timestamp, so without the equal-case branch this was an
      // inconsistent comparator (sort(a,b) and sort(b,a) both claiming
      // priority), which made same-batch ordering undefined rather than
      // "insertion order" as intended. Caught by a regression test.
      result = Array.from(byIngredient.values()).sort((a, b) =>
        a.addedAt === b.addedAt ? 0 : a.addedAt < b.addedAt ? 1 : -1,
      );
      return [...others, ...result];
    });
    return result;
  },

  async toggleCompleted(ownerId, id) {
    await store.update((all) => all.map((e) => (e.id === id && ownerOf(e) === ownerId ? { ...e, completed: !e.completed } : e)));
  },

  async remove(ownerId, id) {
    await store.update((all) => all.filter((e) => !(e.id === id && ownerOf(e) === ownerId)));
  },

  async clearCompleted(ownerId) {
    await store.update((all) => all.filter((e) => !(ownerOf(e) === ownerId && e.completed)));
  },

  async clearAll(ownerId) {
    await store.update((all) => all.filter((e) => ownerOf(e) !== ownerId));
  },

  async reassignOwnerToGuest(ownerId) {
    await store.update((all) => {
      const mine = all.filter((e) => ownerOf(e) === ownerId);
      const rest = all.filter((e) => ownerOf(e) !== ownerId);
      const guestIngredientIds = new Set(rest.filter((e) => ownerOf(e) === LOCAL_GUEST_OWNER_ID).map((e) => e.ingredientId));
      const reassigned = mine.filter((e) => !guestIngredientIds.has(e.ingredientId)).map((e) => ({ ...e, ownerId: LOCAL_GUEST_OWNER_ID }));
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
      const destination = new Map(staying.filter((e) => ownerOf(e) === toOwnerId).map((e) => [e.ingredientId, e] as const));
      const moved: ShoppingListEntry[] = [];
      for (const e of moving) {
        const existing = destination.get(e.ingredientId);
        if (existing) {
          // Still needed on either list => still needed after merging.
          if (existing.completed && !e.completed) existing.completed = false;
          continue;
        }
        const next = { ...e, ownerId: toOwnerId };
        destination.set(e.ingredientId, next);
        moved.push(next);
      }
      return [...staying.map((e) => ({ ...e })), ...moved];
    });
  },
};
