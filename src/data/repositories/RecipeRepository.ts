import { newUuid } from '../newUuid';
import { LOCAL_GUEST_OWNER_ID, PersonalRecipe, Visibility } from '../../domain/types';
import { JsonStore } from '../storage/jsonStore';

/** Visibility defaults to 'private' if omitted — every existing call site that predates publishing keeps working unchanged. */
export type NewRecipeInput = Omit<PersonalRecipe, 'id' | 'ownerId' | 'visibility' | 'createdAt' | 'updatedAt'> & {
  visibility?: Visibility;
};

export type SyncStatePatch = Partial<Pick<PersonalRecipe, 'pendingSync' | 'publishedPhoto' | 'publishedAt' | 'syncError'>>;

/**
 * A recipe deleted locally while it MIGHT still exist remotely (its publish
 * was attempted but never confirmed, and the device was offline at delete
 * time). The unpublish is retried by recipesStore.retryPendingSync until it
 * succeeds — the local copy is already gone.
 */
export interface RecipeTombstone {
  recipeId: string;
  ownerId: string;
  deletedAt: string;
}

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
  /**
   * Records the outcome of a backend sync in one write: each key present in
   * `patch` is set, and a key present with value `undefined` is removed.
   * Never bumps updatedAt (this is bookkeeping, not an edit).
   */
  setSyncState(id: string, patch: SyncStatePatch): Promise<PersonalRecipe | undefined>;
  /** Remote deletions still owed for recipes already deleted locally (see RecipeTombstone). */
  getTombstones(ownerId: string): Promise<RecipeTombstone[]>;
  addTombstone(tombstone: RecipeTombstone): Promise<void>;
  removeTombstone(recipeId: string): Promise<void>;
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

function isTombstoneArray(value: unknown): value is RecipeTombstone[] {
  return (
    Array.isArray(value) &&
    value.every((v) => v && typeof v.recipeId === 'string' && typeof v.ownerId === 'string' && typeof v.deletedAt === 'string')
  );
}

const tombstoneStore = new JsonStore<RecipeTombstone[]>('@bar/recipeTombstones', isTombstoneArray, []);

/** Applies a SyncStatePatch: present-with-value sets, present-with-undefined removes. */
function applySyncState(recipe: PersonalRecipe, patch: SyncStatePatch): PersonalRecipe {
  const next: PersonalRecipe = { ...recipe };
  for (const key of Object.keys(patch) as (keyof SyncStatePatch)[]) {
    if (patch[key] === undefined) delete next[key];
    else (next as unknown as Record<string, unknown>)[key] = patch[key];
  }
  return next;
}

/**
 * A recipe moving to a different owner (account deletion, local-data
 * adoption) becomes private and forgets everything tied to the previous
 * owner's remote identity: pending syncs, sync errors, and the uploaded
 * photo URL — that object lives under the OLD owner's storage folder (and
 * is deleted with that account), so reusing it would publish a dead link
 * or be rejected by the photo-ownership constraint.
 */
function rehome(recipe: PersonalRecipe, ownerId: string, now: string): PersonalRecipe {
  const { pendingSync: _p, publishedPhoto: _pp, syncError: _se, ...rest } = recipe;
  return { ...rest, ownerId, visibility: 'private', publishedAt: null, updatedAt: now };
}

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
      // Known not to exist remotely until a publish is confirmed.
      publishedAt: null,
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
      // The remembered upload only describes the photo it was made from: a
      // replaced or removed photo must never reuse (or re-publish) it.
      if (updated.publishedPhoto && updated.publishedPhoto.localUri !== updated.photoUri) {
        const { publishedPhoto: _stale, ...rest } = updated;
        updated = rest;
      }
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
    const now = new Date().toISOString();
    await store.update((all) => all.map((r) => (r.ownerId === ownerId ? rehome(r, LOCAL_GUEST_OWNER_ID, now) : r)));
    await tombstoneStore.update((all) => all.filter((t) => t.ownerId !== ownerId));
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
      all.map((r) => (from.has(r.ownerId) ? rehome(r, toOwnerId, now) : r)),
    );
  },

  async setPendingSync(id, pendingSync) {
    return asyncStorageRecipeRepository.setSyncState(id, { pendingSync: pendingSync || undefined });
  },

  async setPublishedPhoto(id, publishedPhoto) {
    return asyncStorageRecipeRepository.setSyncState(id, { publishedPhoto: publishedPhoto || undefined });
  },

  async setSyncState(id, patch) {
    let updated: PersonalRecipe | undefined;
    await store.update((all) =>
      all.map((r) => {
        if (r.id !== id) return r;
        updated = applySyncState(r, patch);
        return updated;
      }),
    );
    return updated;
  },

  async getTombstones(ownerId) {
    return (await tombstoneStore.read()).filter((t) => t.ownerId === ownerId);
  },

  async addTombstone(tombstone) {
    await tombstoneStore.update((all) => [...all.filter((t) => t.recipeId !== tombstone.recipeId), tombstone]);
  },

  async removeTombstone(recipeId) {
    await tombstoneStore.update((all) => all.filter((t) => t.recipeId !== recipeId));
  },
};
