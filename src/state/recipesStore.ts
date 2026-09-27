import { create } from 'zustand';
import { remoteRecipeBackend } from '../data/community';
import { deleteManagedLocalPhoto } from '../data/localMedia';
import { asyncStorageRecipeRepository, NewRecipeInput } from '../data/repositories/RecipeRepository';
import { LOCAL_GUEST_OWNER_ID, PersonalRecipe } from '../domain/types';
import { reportError } from '../lib/crashReporting';
import { currentOwnerId } from './authStore';

/**
 * Thrown when the LOCAL write succeeded but mirroring it to the backend did
 * not — so callers can tell the user "saved, will publish when you're back
 * online" instead of either lying about it or pretending the save failed.
 * The local write is never rolled back (local-first), and the recipe is
 * marked `pendingSync` so retryPendingSync() finishes the job later.
 */
export class RecipePublishError extends Error {
  constructor(readonly cause: unknown) {
    super('Recipe saved locally but could not be synced to the backend');
    this.name = 'RecipePublishError';
  }
}

function participatesInSync(recipe: PersonalRecipe): boolean {
  // Local-only build: "public" stays a local flag. Guest content is
  // device-only by design.
  return !!remoteRecipeBackend && recipe.ownerId !== LOCAL_GUEST_OWNER_ID;
}

/**
 * Mirrors a recipe's PUBLISHED state to the backend. Only an explicit
 * `visibility: 'public'` on a real account ever publishes.
 */
async function pushPublication(recipe: PersonalRecipe, wasPublic: boolean): Promise<string | null | undefined> {
  if (!participatesInSync(recipe) || !remoteRecipeBackend) return undefined;
  if (recipe.visibility === 'public') return (await remoteRecipeBackend.publishRecipe(recipe))?.photoUrl ?? null;
  if (wasPublic) await remoteRecipeBackend.unpublishRecipe(recipe.id);
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
  /** Retries every pending publish/unpublish for the signed-in account. Safe to call often (foreground, reconnect, sign-in); runs one pass at a time. */
  retryPendingSync: () => Promise<void>;
  /** Account deletion support — see useAuthStore.deleteAccount. */
  reassignOwnerToGuestAndPrivatize: (ownerId: string) => Promise<void>;
}

let retryInFlight: Promise<void> | null = null;

export const useRecipesStore = create<RecipesState>((set, get) => {
  const replace = (updated: PersonalRecipe) => set({ recipes: get().recipes.map((r) => (r.id === updated.id ? updated : r)) });

  /** Runs a backend sync; on failure records it as pending (durably) and rethrows as RecipePublishError. */
  const syncOrMarkPending = async (recipe: PersonalRecipe, wasPublic: boolean) => {
    const wantsPublic = recipe.visibility === 'public';
    if (!participatesInSync(recipe) || (!wantsPublic && !wasPublic && !recipe.pendingSync)) return;
    try {
      const photoUrl = await pushPublication(recipe, wasPublic || !!recipe.pendingSync);
      if (photoUrl && recipe.photoUri && !recipe.photoUri.startsWith('http') && recipe.publishedPhoto?.url !== photoUrl) {
        const remembered = await asyncStorageRecipeRepository.setPublishedPhoto(recipe.id, { localUri: recipe.photoUri, url: photoUrl });
        if (remembered) replace(remembered);
      }
      if (recipe.pendingSync) {
        const cleared = await asyncStorageRecipeRepository.setPendingSync(recipe.id, undefined);
        if (cleared) replace(cleared);
      }
    } catch (e) {
      reportError(e, { module: 'recipesStore', action: 'syncPublication', recipeId: recipe.id });
      const marked = await asyncStorageRecipeRepository.setPendingSync(recipe.id, wantsPublic ? 'publish' : 'unpublish');
      if (marked) replace(marked);
      throw new RecipePublishError(e);
    }
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
      // A published (or possibly-published) recipe is unpublished FIRST; the
      // local delete only happens once that succeeded — otherwise it could
      // stay public in Discover with no local copy left to manage it from.
      if (removed && participatesInSync(removed) && (removed.visibility === 'public' || removed.pendingSync) && remoteRecipeBackend) {
        try {
          await remoteRecipeBackend.unpublishRecipe(removed.id);
        } catch (e) {
          reportError(e, { module: 'recipesStore', action: 'removeUnpublish', recipeId: id });
          throw new RecipePublishError(e);
        }
      }
      await asyncStorageRecipeRepository.remove(id, currentOwnerId());
      set({ recipes: get().recipes.filter((r) => r.id !== id) });
      if (removed?.photoUri && !isPhotoInUse(get().recipes, removed.photoUri)) deleteManagedLocalPhoto(removed.photoUri);
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
            // still offline / failing — stays pending for the next attempt
          }
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
      set({
        recipes: get().recipes.map((r) =>
          r.ownerId === ownerId ? { ...r, ownerId: LOCAL_GUEST_OWNER_ID, visibility: 'private', pendingSync: undefined } : r,
        ),
      });
    },
  };
});
