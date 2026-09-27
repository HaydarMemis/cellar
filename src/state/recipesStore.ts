import { create } from 'zustand';
import { remoteRecipeBackend } from '../data/community';
import { deleteManagedLocalPhoto } from '../data/localMedia';
import { asyncStorageRecipeRepository, NewRecipeInput, SyncStatePatch } from '../data/repositories/RecipeRepository';
import { classifySyncError, SyncErrorField, SyncErrorReason } from '../data/syncErrors';
import { LOCAL_GUEST_OWNER_ID, PersonalRecipe } from '../domain/types';
import { reportError } from '../lib/crashReporting';
import { currentOwnerId } from './authStore';

/**
 * Thrown when the LOCAL write succeeded but mirroring it to the backend did
 * not. The local write is never rolled back (local-first).
 *
 * - `permanent: false` — offline / transient: the recipe is marked
 *   `pendingSync` and retryPendingSync() finishes the job later, so callers
 *   can say "saved, will publish when you're back online".
 * - `permanent: true` — the backend rejected it (invalid data, missing or
 *   unsupported photo, not allowed): retrying can't help, so it is NOT
 *   pending; the recipe carries `syncError` and callers must say "couldn't
 *   publish: <reason>" instead of promising an automatic retry.
 */
export class RecipePublishError extends Error {
  readonly permanent: boolean;
  readonly reason?: SyncErrorReason;
  readonly field?: SyncErrorField;
  /** The (locally saved) recipe the failed sync was for. */
  readonly recipeId?: string;

  constructor(
    readonly cause: unknown,
    classification: { permanent: boolean; reason?: SyncErrorReason; field?: SyncErrorField } = { permanent: false },
    recipeId?: string,
  ) {
    super(
      classification.permanent
        ? 'Recipe saved locally but the backend rejected it'
        : 'Recipe saved locally but could not be synced to the backend',
    );
    this.name = 'RecipePublishError';
    this.permanent = classification.permanent;
    if (classification.reason) this.reason = classification.reason;
    if (classification.field) this.field = classification.field;
    if (recipeId) this.recipeId = recipeId;
  }
}

function participatesInSync(recipe: PersonalRecipe): boolean {
  // Local-only build: "public" stays a local flag. Guest content is
  // device-only by design.
  return !!remoteRecipeBackend && recipe.ownerId !== LOCAL_GUEST_OWNER_ID;
}

/**
 * Could this recipe exist on the server right now (so deleting it must
 * unpublish it first)?
 * - publishedAt is a timestamp → confirmed published;
 * - publishedAt is null → it may still be there only if a publish was
 *   attempted and its outcome is unknown (pendingSync: the request may have
 *   committed server-side even though the response never arrived);
 * - publishedAt is undefined → stored before confirmation was tracked:
 *   anything public, pending, or with an uploaded photo is treated as
 *   published (the conservative reading — never leave a public orphan).
 */
export function isConfirmedOnServer(recipe: PersonalRecipe): boolean {
  if (typeof recipe.publishedAt === 'string') return true;
  if (recipe.publishedAt === null) return false;
  return recipe.visibility === 'public' || !!recipe.pendingSync || !!recipe.publishedPhoto;
}

function mayBeOnServer(recipe: PersonalRecipe): boolean {
  return isConfirmedOnServer(recipe) || !!recipe.pendingSync;
}

/**
 * Mirrors a recipe's PUBLISHED state to the backend. Only an explicit
 * `visibility: 'public'` on a real account ever publishes.
 */
async function pushPublication(recipe: PersonalRecipe, wasPublic: boolean): Promise<{ op: 'publish'; photoUrl: string | null } | { op: 'unpublish' } | undefined> {
  if (!participatesInSync(recipe) || !remoteRecipeBackend) return undefined;
  if (recipe.visibility === 'public') return { op: 'publish', photoUrl: (await remoteRecipeBackend.publishRecipe(recipe))?.photoUrl ?? null };
  if (wasPublic) {
    await remoteRecipeBackend.unpublishRecipe(recipe.id);
    return { op: 'unpublish' };
  }
  return undefined;
}

function isPhotoInUse(recipes: PersonalRecipe[], uri: string | undefined): boolean {
  return !!uri && recipes.some((r) => r.photoUri === uri);
}

interface RecipesState {
  recipes: PersonalRecipe[];
  isLoaded: boolean;
  load: () => Promise<void>;
  create: (input: NewRecipeInput) => Promise<PersonalRecipe>;
  update: (id: string, patch: Partial<NewRecipeInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Retries every pending publish/unpublish (and owed remote deletions) for the signed-in account. Safe to call often (foreground, reconnect, sign-in); runs one pass at a time. Permanently rejected recipes are not retried. */
  retryPendingSync: () => Promise<void>;
  /** Account deletion support — see useAuthStore.deleteAccount. */
  reassignOwnerToGuestAndPrivatize: (ownerId: string) => Promise<void>;
}

let retryInFlight: Promise<void> | null = null;

export const useRecipesStore = create<RecipesState>((set, get) => {
  const replace = (updated: PersonalRecipe) => set({ recipes: get().recipes.map((r) => (r.id === updated.id ? updated : r)) });

  const recordSyncState = async (id: string, patch: SyncStatePatch) => {
    const updated = await asyncStorageRecipeRepository.setSyncState(id, patch);
    if (updated) replace(updated);
  };

  /**
   * Runs a backend sync. On success records the confirmed state; on a
   * transient failure marks it pending (durably) and on a permanent one
   * records syncError — either way rethrows as RecipePublishError.
   */
  const syncOrMarkPending = async (recipe: PersonalRecipe, wasPublic: boolean) => {
    const wantsPublic = recipe.visibility === 'public';
    if (!participatesInSync(recipe) || (!wantsPublic && !wasPublic && !recipe.pendingSync && !recipe.syncError)) return;
    let outcome: Awaited<ReturnType<typeof pushPublication>>;
    try {
      outcome = await pushPublication(recipe, wasPublic || !!recipe.pendingSync);
    } catch (e) {
      reportError(e, { module: 'recipesStore', action: 'syncPublication', recipeId: recipe.id });
      const classification = classifySyncError(e);
      const op = wantsPublic ? 'publish' : 'unpublish';
      if (classification.kind === 'permanent') {
        await recordSyncState(recipe.id, {
          pendingSync: undefined,
          syncError: { op, reason: classification.reason, ...(classification.field ? { field: classification.field } : {}), at: new Date().toISOString() },
        });
        throw new RecipePublishError(e, { permanent: true, reason: classification.reason, field: classification.field }, recipe.id);
      }
      await recordSyncState(recipe.id, { pendingSync: op, syncError: undefined });
      throw new RecipePublishError(e, { permanent: false }, recipe.id);
    }

    const patch: SyncStatePatch = {};
    if (recipe.pendingSync) patch.pendingSync = undefined;
    if (recipe.syncError) patch.syncError = undefined;
    if (outcome?.op === 'publish') {
      patch.publishedAt = new Date().toISOString();
      const { photoUrl } = outcome;
      if (photoUrl && recipe.photoUri && !recipe.photoUri.startsWith('http') && recipe.publishedPhoto?.url !== photoUrl) {
        patch.publishedPhoto = { localUri: recipe.photoUri, url: photoUrl };
      } else if (!photoUrl && recipe.publishedPhoto) {
        patch.publishedPhoto = undefined;
      }
    } else if (outcome?.op === 'unpublish') {
      // The row AND its storage objects are gone: forget the uploaded photo
      // URL, or a later re-publish would reuse a deleted object.
      patch.publishedAt = null;
      if (recipe.publishedPhoto) patch.publishedPhoto = undefined;
    }
    if (Object.keys(patch).length > 0) await recordSyncState(recipe.id, patch);
  };

  /** Owed remote deletions for recipes already deleted locally (see RecipeTombstone). */
  const retryTombstones = async (owner: string) => {
    if (!remoteRecipeBackend || owner === LOCAL_GUEST_OWNER_ID) return;
    for (const tombstone of await asyncStorageRecipeRepository.getTombstones(owner)) {
      try {
        await remoteRecipeBackend.unpublishRecipe(tombstone.recipeId);
        await asyncStorageRecipeRepository.removeTombstone(tombstone.recipeId);
      } catch (e) {
        if (classifySyncError(e).kind === 'permanent') {
          reportError(e, { module: 'recipesStore', action: 'tombstoneRejected', recipeId: tombstone.recipeId });
          await asyncStorageRecipeRepository.removeTombstone(tombstone.recipeId);
        }
        // otherwise still offline — kept for the next attempt
      }
    }
  };

  const removeLocally = async (id: string, removed: PersonalRecipe | undefined) => {
    await asyncStorageRecipeRepository.remove(id, currentOwnerId());
    set({ recipes: get().recipes.filter((r) => r.id !== id) });
    if (removed?.photoUri && !isPhotoInUse(get().recipes, removed.photoUri)) deleteManagedLocalPhoto(removed.photoUri);
  };

  return {
    recipes: [],
    isLoaded: false,

    load: async () => {
      const recipes = await asyncStorageRecipeRepository.getAll();
      set({ recipes, isLoaded: true });
    },

    create: async (input) => {
      const recipe = await asyncStorageRecipeRepository.create(input, currentOwnerId());
      set({ recipes: [...get().recipes, recipe] });
      await syncOrMarkPending(recipe, false);
      return get().recipes.find((r) => r.id === recipe.id) ?? recipe;
    },

    update: async (id, patch) => {
      const before = get().recipes.find((r) => r.id === id);
      const wasPublic = before?.visibility === 'public';
      const updated = await asyncStorageRecipeRepository.update(id, patch, currentOwnerId());
      if (!updated) return;
      replace(updated);
      // A replaced/removed photo this app stored locally is no longer needed.
      if (before?.photoUri && before.photoUri !== updated.photoUri && !isPhotoInUse(get().recipes, before.photoUri)) {
        deleteManagedLocalPhoto(before.photoUri);
      }
      await syncOrMarkPending(updated, wasPublic);
    },

    remove: async (id) => {
      const removed = get().recipes.find((r) => r.id === id);
      if (!removed || !participatesInSync(removed) || !remoteRecipeBackend || !mayBeOnServer(removed)) {
        await removeLocally(id, removed);
        return;
      }
      try {
        await remoteRecipeBackend.unpublishRecipe(removed.id);
      } catch (e) {
        reportError(e, { module: 'recipesStore', action: 'removeUnpublish', recipeId: id });
        if (isConfirmedOnServer(removed)) {
          // Confirmed public: the local delete only happens once the
          // unpublish succeeded — otherwise it could stay public in
          // Discover with no local copy left to manage it from.
          const classification = classifySyncError(e);
          throw new RecipePublishError(
            e,
            classification.kind === 'permanent' ? { permanent: true, reason: classification.reason, field: classification.field } : { permanent: false },
            removed.id,
          );
        }
        // Never confirmed (its publish only ever failed, e.g. created
        // offline): almost certainly not on the server, so the author can
        // delete it offline. In case an unconfirmed publish did commit, an
        // unpublish is owed and retried in the background.
        await asyncStorageRecipeRepository.addTombstone({ recipeId: removed.id, ownerId: removed.ownerId, deletedAt: new Date().toISOString() });
      }
      await removeLocally(id, removed);
    },

    retryPendingSync: async () => {
      if (retryInFlight) return retryInFlight;
      retryInFlight = (async () => {
        const owner = currentOwnerId();
        const pending = get().recipes.filter((r) => r.pendingSync && r.ownerId === owner && participatesInSync(r));
        for (const recipe of pending) {
          try {
            await syncOrMarkPending(recipe, recipe.pendingSync === 'unpublish');
          } catch {
            // transient: stays pending for the next attempt; permanent: now carries syncError
          }
        }
        try {
          await retryTombstones(owner);
        } catch (e) {
          reportError(e, { module: 'recipesStore', action: 'retryTombstones' });
        }
      })();
      try {
        await retryInFlight;
      } finally {
        retryInFlight = null;
      }
    },

    reassignOwnerToGuestAndPrivatize: async (ownerId) => {
      await asyncStorageRecipeRepository.reassignOwnerToGuestAndPrivatize(ownerId);
      // Mirror exactly what the repository persisted (private, no pending
      // sync / sync error / uploaded-photo URL of the deleted account).
      const persisted = new Map((await asyncStorageRecipeRepository.getAll()).map((r) => [r.id, r]));
      set({
        recipes: get().recipes.map((r) => (r.ownerId === ownerId ? (persisted.get(r.id) ?? r) : r)),
      });
    },
  };
});
