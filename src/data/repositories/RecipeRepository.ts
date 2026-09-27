import { newUuid } from '../newUuid';
import { LOCAL_GUEST_OWNER_ID, PersonalRecipe, Visibility } from '../../domain/types';
import { JsonStore } from '../storage/jsonStore';

/** Visibility defaults to 'private' if omitted — every existing call site that predates publishing keeps working unchanged. */
export type NewRecipeInput = Omit<PersonalRecipe, 'id' | 'ownerId' | 'visibility' | 'createdAt' | 'updatedAt'> & {
  visibility?: Visibility;
};

export interface RecipeRepository {
  getAll(): Promise<PersonalRecipe[]>;
  getById(id: string): Promise<PersonalRecipe | undefined>;
  create(input: NewRecipeInput, ownerId?: string): Promise<PersonalRecipe>;
  /**
   * `ownerId` is verified against the recipe's actual owner before any
   * write happens — defense in depth, not just a UI-level gate (the app's
   * screens already only ever show Edit/Delete for your own recipes, but
   * per the auth-lifecycle audit's own guidance, "the backend remains
   * authoritative" — this repository IS the backend for local-only data,
   * so it's the right place to enforce this, not just app/cocktail/[id].tsx).
   */
  update(id: string, patch: Partial<NewRecipeInput>, ownerId: string): Promise<PersonalRecipe | undefined>;
  remove(id: string, ownerId: string): Promise<void>;
  /**
   * Account deletion support: a recipe's public identity can't outlive its
   * account, but the user's own creative work shouldn't vanish just because
   * they deleted their account — every recipe owned by `ownerId` reverts to
   * private and is reassigned to the local-guest owner, exactly as if it
   * had been created without ever signing in.
   */
  reassignOwnerToGuestAndPrivatize(ownerId: string): Promise<void>;
  /** Records/clears a failed backend sync for later retry (see PersonalRecipe.pendingSync). Returns the updated recipe. */
  setPendingSync(id: string, pendingSync: PersonalRecipe['pendingSync'] | undefined): Promise<PersonalRecipe | undefined>;
  /** Remembers which uploaded URL the current local photo corresponds to (see PersonalRecipe.publishedPhoto). */
  setPublishedPhoto(id: string, publishedPhoto: PersonalRecipe['publishedPhoto'] | undefined): Promise<PersonalRecipe | undefined>;
  /** Local-data adoption: recipes per owner id on this device. */
  countByOwner(): Promise<Record<string, number>>;
  /**
   * Local-data adoption: moves recipes owned by any of `fromOwnerIds` to
   * `toOwnerId`. Adopted recipes become PRIVATE — a recipe marked public
   * under a guest/device-only identity was never actually published, and
   * adopting it must not silently publish it to the community.
   */
  reassignOwners(fromOwnerIds: string[], toOwnerId: string): Promise<void>;
}

function isRecipeArray(value: unknown): value is PersonalRecipe[] {
  return (
    Array.isArray(value) &&
    value.every((v) => v && typeof v.id === 'string' && typeof v.name === 'string')
  );
}

const store = new JsonStore<PersonalRecipe[]>('@bar/recipes', isRecipeArray, []);

export const asyncStorageRecipeRepository: RecipeRepository = {
  async getAll() {
    return store.read();
  },

  async getById(id) {
    const all = await store.read();
    return all.find((r) => r.id === id);
  },

  async create(input, ownerId = LOCAL_GUEST_OWNER_ID) {
    const now = new Date().toISOString();
    const { visibility, ...rest } = input;
    const recipe: PersonalRecipe = {
      ...rest,
      // A real UUID, not generateId('recipe'): this id becomes the primary
      // key of the Supabase `recipes` row if the recipe is ever published,
      // and that column is `uuid` (see src/domain/uuid.ts). Recipes created
      // before this change keep their legacy ids — see remoteRecipeId().
      id: newUuid(),
      ownerId,
      visibility: visibility ?? 'private',
      createdAt: now,
      updatedAt: now,
    };
    await store.update((all) => [...all, recipe]);
    return recipe;
  },

  async update(id, patch, ownerId) {
    let updated: PersonalRecipe | undefined;
    await store.update((all) => {
      const index = all.findIndex((r) => r.id === id);
      if (index === -1 || all[index].ownerId !== ownerId) return all;

      updated = { ...all[index], ...patch, updatedAt: new Date().toISOString() };
      const next = [...all];
      next[index] = updated;
      return next;
    });
    return updated;
  },

  async remove(id, ownerId) {
    await store.update((all) => all.filter((r) => !(r.id === id && r.ownerId === ownerId)));
  },

  async reassignOwnerToGuestAndPrivatize(ownerId) {
    await store.update((all) =>
      all.map((r) =>
        r.ownerId === ownerId
          ? { ...r, ownerId: LOCAL_GUEST_OWNER_ID, visibility: 'private' as const, pendingSync: undefined, updatedAt: new Date().toISOString() }
          : r,
      ),
    );
  },

  async countByOwner() {
    const counts: Record<string, number> = {};
    for (const r of await store.read()) counts[r.ownerId] = (counts[r.ownerId] ?? 0) + 1;
    return counts;
  },

  async reassignOwners(fromOwnerIds, toOwnerId) {
    const from = new Set(fromOwnerIds.filter((id) => id !== toOwnerId));
    if (from.size === 0) return;
    const now = new Date().toISOString();
    await store.update((all) =>
      all.map((r) => (from.has(r.ownerId) ? { ...r, ownerId: toOwnerId, visibility: 'private' as const, pendingSync: undefined, updatedAt: now } : r)),
    );
  },

  async setPendingSync(id, pendingSync) {
    let updated: PersonalRecipe | undefined;
    await store.update((all) =>
      all.map((r) => {
        if (r.id !== id) return r;
        const { pendingSync: _previous, ...rest } = r;
        updated = pendingSync ? { ...rest, pendingSync } : rest;
        return updated;
      }),
    );
    return updated;
  },

  async setPublishedPhoto(id, publishedPhoto) {
    let updated: PersonalRecipe | undefined;
    await store.update((all) =>
      all.map((r) => {
        if (r.id !== id) return r;
        const { publishedPhoto: _previous, ...rest } = r;
        updated = publishedPhoto ? { ...rest, publishedPhoto } : rest;
        return updated;
      }),
    );
    return updated;
  },
};
