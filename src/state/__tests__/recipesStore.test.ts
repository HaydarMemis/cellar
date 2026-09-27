import AsyncStorage from '@react-native-async-storage/async-storage';
import { NewRecipeInput } from '../../data/repositories/RecipeRepository';
import { LOCAL_GUEST_OWNER_ID } from '../../domain/types';
import { useAuthStore } from '../authStore';
import { RecipePublishError, useRecipesStore } from '../recipesStore';

// remoteRecipeBackend is normally null in tests (no Supabase env vars are
// set for jest) — mocked here so syncPublication's branches (publish on
// create/update-to-public, unpublish on update-to-private/remove, surface
// a failure without losing the local write) are actually exercised, the
// same way this module is exercised for real once Supabase is configured.
const mockPublishRecipe = jest.fn();
const mockUnpublishRecipe = jest.fn();
jest.mock('../../data/community', () => ({
  get remoteRecipeBackend() {
    return { publishRecipe: (...a: unknown[]) => mockPublishRecipe(...a), unpublishRecipe: (...a: unknown[]) => mockUnpublishRecipe(...a) };
  },
}));

const baseInput: NewRecipeInput = {
  name: 'Test Recipe',
  description: 'A recipe for tests.',
  baseSpirit: 'gin',
  category: ['classic'],
  tags: [],
  ingredients: [{ ingredientId: 'gin', amount: { value: 50, unit: 'ml' }, isOptional: false, isGarnish: false }],
  method: 'shake',
  steps: ['Shake.', 'Strain.'],
  glass: ['coupe'],
  abv: { approx: 20 },
  difficulty: 'easy',
  prepTimeMinutes: 3,
};

describe('useRecipesStore — publish sync (syncPublication)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useRecipesStore.setState({ recipes: [], isLoaded: false });
    useAuthStore.setState({
      profile: { id: 'user-a', username: 'user_a', displayName: 'User A', avatarColorSeed: 'a', createdAt: new Date().toISOString() },
      isLoaded: true,
    });
    mockPublishRecipe.mockReset().mockResolvedValue(undefined);
    mockUnpublishRecipe.mockReset().mockResolvedValue(undefined);
  });

  it('creating a private recipe never calls the remote backend', async () => {
    await useRecipesStore.getState().create({ ...baseInput, visibility: 'private' });
    expect(mockPublishRecipe).not.toHaveBeenCalled();
    expect(mockUnpublishRecipe).not.toHaveBeenCalled();
  });

  it('creating a public recipe publishes it', async () => {
    const recipe = await useRecipesStore.getState().create({ ...baseInput, visibility: 'public' });
    expect(mockPublishRecipe).toHaveBeenCalledTimes(1);
    expect(mockPublishRecipe.mock.calls[0][0].id).toBe(recipe.id);
  });

  it('editing a private recipe to public publishes it', async () => {
    const recipe = await useRecipesStore.getState().create({ ...baseInput, visibility: 'private' });
    mockPublishRecipe.mockClear();
    await useRecipesStore.getState().update(recipe.id, { visibility: 'public' });
    expect(mockPublishRecipe).toHaveBeenCalledTimes(1);
  });

  it('editing a public recipe to private unpublishes it', async () => {
    const recipe = await useRecipesStore.getState().create({ ...baseInput, visibility: 'public' });
    mockPublishRecipe.mockClear();
    await useRecipesStore.getState().update(recipe.id, { visibility: 'private' });
    expect(mockUnpublishRecipe).toHaveBeenCalledWith(recipe.id);
  });

  it('editing a public recipe that stays public re-publishes (picks up the edit)', async () => {
    const recipe = await useRecipesStore.getState().create({ ...baseInput, visibility: 'public' });
    mockPublishRecipe.mockClear();
    await useRecipesStore.getState().update(recipe.id, { name: 'Edited Name' });
    expect(mockPublishRecipe).toHaveBeenCalledTimes(1);
    expect(mockUnpublishRecipe).not.toHaveBeenCalled();
  });

  it('deleting a public recipe unpublishes it', async () => {
    const recipe = await useRecipesStore.getState().create({ ...baseInput, visibility: 'public' });
    mockPublishRecipe.mockClear();
    await useRecipesStore.getState().remove(recipe.id);
    expect(mockUnpublishRecipe).toHaveBeenCalledWith(recipe.id);
  });

  it('deleting a private recipe never calls the remote backend', async () => {
    const recipe = await useRecipesStore.getState().create({ ...baseInput, visibility: 'private' });
    await useRecipesStore.getState().remove(recipe.id);
    expect(mockPublishRecipe).not.toHaveBeenCalled();
    expect(mockUnpublishRecipe).not.toHaveBeenCalled();
  });

  it('guest-owned recipes are never synced even when marked public', async () => {
    useAuthStore.setState({ profile: null, isLoaded: true });
    await useRecipesStore.getState().create({ ...baseInput, visibility: 'public' });
    expect(mockPublishRecipe).not.toHaveBeenCalled();
  });

  it('a remote publish failure throws RecipePublishError but the local recipe is still saved', async () => {
    mockPublishRecipe.mockRejectedValueOnce(new Error('network down'));
    await expect(useRecipesStore.getState().create({ ...baseInput, visibility: 'public' })).rejects.toBeInstanceOf(RecipePublishError);
    // The local write already happened (create() calls the repository
    // before syncPublication) — the store still reflects it.
    expect(useRecipesStore.getState().recipes).toHaveLength(1);
  });
});

describe('useRecipesStore — deleting a published recipe', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useRecipesStore.setState({ recipes: [], isLoaded: false });
    useAuthStore.setState({
      profile: { id: 'user-a', username: 'user_a', displayName: 'User A', avatarColorSeed: 'a', createdAt: new Date().toISOString() },
      isLoaded: true,
    });
    mockPublishRecipe.mockReset().mockResolvedValue(undefined);
    mockUnpublishRecipe.mockReset().mockResolvedValue(undefined);
  });

  it('if unpublishing fails, the recipe is NOT deleted locally (the author keeps control of public content)', async () => {
    const recipe = await useRecipesStore.getState().create({ ...baseInput, visibility: 'public' });
    mockUnpublishRecipe.mockRejectedValueOnce(new Error('network down'));
    await expect(useRecipesStore.getState().remove(recipe.id)).rejects.toBeInstanceOf(RecipePublishError);
    expect(useRecipesStore.getState().recipes.map((r) => r.id)).toContain(recipe.id);
    useRecipesStore.setState({ recipes: [] });
    await useRecipesStore.getState().load();
    expect(useRecipesStore.getState().recipes.map((r) => r.id)).toContain(recipe.id);
  });
});

describe('useRecipesStore — offline publishing (pendingSync)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useRecipesStore.setState({ recipes: [], isLoaded: false });
    useAuthStore.setState({
      profile: { id: 'user-a', username: 'user_a', displayName: 'User A', avatarColorSeed: 'a', createdAt: new Date().toISOString() },
      isLoaded: true,
    });
    mockPublishRecipe.mockReset().mockResolvedValue(undefined);
    mockUnpublishRecipe.mockReset().mockResolvedValue(undefined);
  });

  it('a failed publish is saved locally, marked pending (durably), and published by the next retry', async () => {
    mockPublishRecipe.mockRejectedValueOnce(new Error('offline'));
    await expect(useRecipesStore.getState().create({ ...baseInput, visibility: 'public' })).rejects.toBeInstanceOf(RecipePublishError);
    const [saved] = useRecipesStore.getState().recipes;
    expect(saved.pendingSync).toBe('publish');

    // survives an app restart
    useRecipesStore.setState({ recipes: [] });
    await useRecipesStore.getState().load();
    expect(useRecipesStore.getState().recipes[0].pendingSync).toBe('publish');

    await useRecipesStore.getState().retryPendingSync();
    expect(mockPublishRecipe).toHaveBeenCalledTimes(2);
    expect(useRecipesStore.getState().recipes[0].pendingSync).toBeUndefined();
  });

  it('a failed unpublish stays pending and is retried as an unpublish', async () => {
    const recipe = await useRecipesStore.getState().create({ ...baseInput, visibility: 'public' });
    mockUnpublishRecipe.mockRejectedValueOnce(new Error('offline'));
    await expect(useRecipesStore.getState().update(recipe.id, { visibility: 'private' })).rejects.toBeInstanceOf(RecipePublishError);
    expect(useRecipesStore.getState().recipes[0]).toMatchObject({ visibility: 'private', pendingSync: 'unpublish' });
    await useRecipesStore.getState().retryPendingSync();
    expect(mockUnpublishRecipe).toHaveBeenCalledTimes(2);
    expect(useRecipesStore.getState().recipes[0].pendingSync).toBeUndefined();
  });

  it('retry only touches the signed-in account’s recipes', async () => {
    mockPublishRecipe.mockRejectedValueOnce(new Error('offline'));
    await expect(useRecipesStore.getState().create({ ...baseInput, visibility: 'public' })).rejects.toBeInstanceOf(RecipePublishError);
    useAuthStore.setState({ profile: { id: 'user-b', username: 'user_b', displayName: 'B', avatarColorSeed: 'b', createdAt: 'x' } });
    mockPublishRecipe.mockClear();
    await useRecipesStore.getState().retryPendingSync();
    expect(mockPublishRecipe).not.toHaveBeenCalled();
  });

  it('deleting a recipe whose publish is still pending also unpublishes it first', async () => {
    mockPublishRecipe.mockRejectedValueOnce(new Error('offline'));
    await expect(useRecipesStore.getState().create({ ...baseInput, visibility: 'public' })).rejects.toBeInstanceOf(RecipePublishError);
    const id = useRecipesStore.getState().recipes[0].id;
    await useRecipesStore.getState().remove(id);
    expect(mockUnpublishRecipe).toHaveBeenCalledWith(id);
    expect(useRecipesStore.getState().recipes).toHaveLength(0);
  });
});

describe('useRecipesStore — media, permanent failures and offline deletes (audit fixes)', () => {
  const pgError = (code: string, message: string) => Object.assign(new Error(message), { code, details: '', hint: '', status: 400 });
  const photoUrl = (owner: string, id: string, v: number) => `https://x.supabase.co/storage/v1/object/public/recipe-media/${owner}/${id}/photo?v=${v}`;

  beforeEach(async () => {
    await AsyncStorage.clear();
    useRecipesStore.setState({ recipes: [], isLoaded: false });
    useAuthStore.setState({
      profile: { id: 'user-a', username: 'user_a', displayName: 'User A', avatarColorSeed: 'a', createdAt: new Date().toISOString() },
      isLoaded: true,
    });
    mockPublishRecipe.mockReset().mockResolvedValue(undefined);
    mockUnpublishRecipe.mockReset().mockResolvedValue(undefined);
  });

  async function reload() {
    useRecipesStore.setState({ recipes: [] });
    await useRecipesStore.getState().load();
    return useRecipesStore.getState().recipes;
  }

  describe('permanent publish failures are not retried forever', () => {
    it('a constraint violation is surfaced as a permanent error with a reason, and the recipe is NOT pending', async () => {
      mockPublishRecipe.mockRejectedValueOnce(pgError('23514', 'new row for relation "recipes" violates check constraint "recipes_method_valid"'));
      const error = await useRecipesStore.getState().create({ ...baseInput, visibility: 'public' }).catch((e) => e);

      expect(error).toBeInstanceOf(RecipePublishError);
      expect(error).toMatchObject({ permanent: true, reason: 'invalidRecipe', field: 'method' });
      const [saved] = await reload(); // kept locally, durably
      expect(saved.pendingSync).toBeUndefined();
      expect(saved.syncError).toMatchObject({ op: 'publish', reason: 'invalidRecipe', field: 'method' });
      expect(error.recipeId).toBe(saved.id);

      mockPublishRecipe.mockClear();
      await useRecipesStore.getState().retryPendingSync();
      expect(mockPublishRecipe).not.toHaveBeenCalled();
    });

    it('a missing local photo file is permanent (photoMissing)', async () => {
      const { MediaUploadError } = jest.requireActual('../../data/supabase/mediaUpload');
      mockPublishRecipe.mockRejectedValueOnce(new MediaUploadError('Local media file no longer exists.', 'read-failed'));
      await expect(useRecipesStore.getState().create({ ...baseInput, visibility: 'public', photoUri: 'recipe-photos/gone.jpg' })).rejects.toMatchObject({
        permanent: true,
        reason: 'photoMissing',
      });
      expect(useRecipesStore.getState().recipes[0].syncError?.reason).toBe('photoMissing');
    });

    it('a transient failure is still pending (not permanent) and says so', async () => {
      mockPublishRecipe.mockRejectedValueOnce(new TypeError('Network request failed'));
      await expect(useRecipesStore.getState().create({ ...baseInput, visibility: 'public' })).rejects.toMatchObject({ permanent: false });
      expect(useRecipesStore.getState().recipes[0]).toMatchObject({ pendingSync: 'publish' });
      expect(useRecipesStore.getState().recipes[0].syncError).toBeUndefined();
    });

    it('a pending retry that turns out to be permanently rejected stops being pending', async () => {
      mockPublishRecipe.mockRejectedValueOnce(new TypeError('Network request failed'));
      await expect(useRecipesStore.getState().create({ ...baseInput, visibility: 'public' })).rejects.toBeInstanceOf(RecipePublishError);
      mockPublishRecipe.mockRejectedValueOnce(pgError('42501', 'new row violates row-level security policy'));
      await useRecipesStore.getState().retryPendingSync();
      expect(useRecipesStore.getState().recipes[0].pendingSync).toBeUndefined();
      expect(useRecipesStore.getState().recipes[0].syncError?.reason).toBe('notAllowed');
    });

    it('saving the fixed recipe again publishes it and clears the error', async () => {
      mockPublishRecipe.mockRejectedValueOnce(pgError('23514', 'violates check constraint "recipes_steps_bounded"'));
      await expect(useRecipesStore.getState().create({ ...baseInput, visibility: 'public' })).rejects.toBeInstanceOf(RecipePublishError);
      const id = useRecipesStore.getState().recipes[0].id;
      await useRecipesStore.getState().update(id, { steps: ['Shake.'] });
      const [saved] = await reload();
      expect(saved.syncError).toBeUndefined();
      expect(typeof saved.publishedAt).toBe('string');
    });

    it('making a rejected recipe private clears its error', async () => {
      mockPublishRecipe.mockRejectedValueOnce(pgError('23514', 'violates check constraint "recipes_steps_bounded"'));
      await expect(useRecipesStore.getState().create({ ...baseInput, visibility: 'public' })).rejects.toBeInstanceOf(RecipePublishError);
      const id = useRecipesStore.getState().recipes[0].id;
      await useRecipesStore.getState().update(id, { visibility: 'private' });
      expect(useRecipesStore.getState().recipes[0].syncError).toBeUndefined();
    });
  });

  describe('re-publishing after an unpublish never reuses the deleted photo URL', () => {
    it('unpublish forgets the uploaded photo, so the next publish uploads it again', async () => {
      mockPublishRecipe.mockImplementation(async (r: { ownerId: string; id: string }) => ({ photoUrl: photoUrl(r.ownerId, r.id, 1) }));
      const recipe = await useRecipesStore.getState().create({ ...baseInput, visibility: 'public', photoUri: 'recipe-photos/a.jpg' });
      expect(recipe.publishedPhoto).toEqual({ localUri: 'recipe-photos/a.jpg', url: photoUrl('user-a', recipe.id, 1) });
      expect(typeof recipe.publishedAt).toBe('string');

      await useRecipesStore.getState().update(recipe.id, { visibility: 'private' });
      const [unpublished] = await reload();
      expect(unpublished.publishedPhoto).toBeUndefined();
      expect(unpublished.publishedAt).toBeNull();

      mockPublishRecipe.mockClear();
      await useRecipesStore.getState().update(recipe.id, { visibility: 'public' });
      expect(mockPublishRecipe.mock.calls[0][0].publishedPhoto).toBeUndefined();
    });

    it('removing or replacing the photo drops the remembered upload', async () => {
      mockPublishRecipe.mockImplementation(async (r: { ownerId: string; id: string }) => ({ photoUrl: photoUrl(r.ownerId, r.id, 1) }));
      const recipe = await useRecipesStore.getState().create({ ...baseInput, visibility: 'private', photoUri: 'recipe-photos/a.jpg' });
      await useRecipesStore.getState().update(recipe.id, { visibility: 'public' });
      expect(useRecipesStore.getState().recipes[0].publishedPhoto).toBeDefined();

      mockPublishRecipe.mockResolvedValue({ photoUrl: null });
      await useRecipesStore.getState().update(recipe.id, { photoUri: undefined });
      expect(mockPublishRecipe.mock.calls.at(-1)[0].publishedPhoto).toBeUndefined();
      expect((await reload())[0].publishedPhoto).toBeUndefined();
    });

    it('account deletion re-homing strips the old owner’s uploaded photo URL and sync state', async () => {
      mockPublishRecipe.mockImplementation(async (r: { ownerId: string; id: string }) => ({ photoUrl: photoUrl(r.ownerId, r.id, 1) }));
      await useRecipesStore.getState().create({ ...baseInput, visibility: 'public', photoUri: 'recipe-photos/a.jpg' });
      await useRecipesStore.getState().reassignOwnerToGuestAndPrivatize('user-a');
      for (const r of [useRecipesStore.getState().recipes[0], (await reload())[0]]) {
        expect(r).toMatchObject({ ownerId: LOCAL_GUEST_OWNER_ID, visibility: 'private', publishedAt: null, photoUri: 'recipe-photos/a.jpg' });
        expect(r.publishedPhoto).toBeUndefined();
        expect(r.pendingSync).toBeUndefined();
      }
    });

    it('local-data adoption re-homing strips the uploaded photo URL too', async () => {
      const { asyncStorageRecipeRepository } = jest.requireActual('../../data/repositories/RecipeRepository');
      await AsyncStorage.setItem(
        '@bar/recipes',
        JSON.stringify([
          {
            ...baseInput,
            id: 'r-legacy',
            ownerId: 'user-legacy',
            visibility: 'public',
            photoUri: 'recipe-photos/a.jpg',
            publishedPhoto: { localUri: 'recipe-photos/a.jpg', url: photoUrl('user-legacy', 'r-legacy', 1) },
            syncError: { op: 'publish', reason: 'rejected', at: 'x' },
            createdAt: 'x',
            updatedAt: 'x',
          },
        ]),
      );
      await asyncStorageRecipeRepository.reassignOwners(['user-legacy'], 'user-a');
      const [adopted] = await reload();
      expect(adopted).toMatchObject({ ownerId: 'user-a', visibility: 'private', publishedAt: null });
      expect(adopted.publishedPhoto).toBeUndefined();
      expect(adopted.syncError).toBeUndefined();
    });
  });

  describe('deleting a recipe offline', () => {
    it('a recipe whose publish never reached the server can be deleted offline; the owed unpublish is retried later', async () => {
      mockPublishRecipe.mockRejectedValueOnce(new TypeError('Network request failed'));
      await expect(useRecipesStore.getState().create({ ...baseInput, visibility: 'public' })).rejects.toBeInstanceOf(RecipePublishError);
      const id = useRecipesStore.getState().recipes[0].id;

      mockUnpublishRecipe.mockRejectedValueOnce(new TypeError('Network request failed'));
      await expect(useRecipesStore.getState().remove(id)).resolves.toBeUndefined();
      expect(await reload()).toHaveLength(0);
      expect(JSON.parse((await AsyncStorage.getItem('@bar/recipeTombstones'))!)).toEqual([
        expect.objectContaining({ recipeId: id, ownerId: 'user-a' }),
      ]);

      mockUnpublishRecipe.mockClear();
      await useRecipesStore.getState().retryPendingSync();
      expect(mockUnpublishRecipe).toHaveBeenCalledWith(id);
      expect(JSON.parse((await AsyncStorage.getItem('@bar/recipeTombstones'))!)).toEqual([]);
    });

    it('a CONFIRMED published recipe is still kept when the unpublish fails offline', async () => {
      const recipe = await useRecipesStore.getState().create({ ...baseInput, visibility: 'public' });
      mockUnpublishRecipe.mockRejectedValueOnce(new TypeError('Network request failed'));
      await expect(useRecipesStore.getState().remove(recipe.id)).rejects.toMatchObject({ permanent: false });
      expect((await reload()).map((r) => r.id)).toEqual([recipe.id]);
    });

    it('a recipe that was published and later unpublished is deleted without any network call', async () => {
      const recipe = await useRecipesStore.getState().create({ ...baseInput, visibility: 'public' });
      await useRecipesStore.getState().update(recipe.id, { visibility: 'private' });
      mockUnpublishRecipe.mockClear();
      await useRecipesStore.getState().remove(recipe.id);
      expect(mockUnpublishRecipe).not.toHaveBeenCalled();
      expect(useRecipesStore.getState().recipes).toHaveLength(0);
    });

    it('backward compat: a public recipe stored before publishedAt existed is treated as published', async () => {
      await AsyncStorage.setItem(
        '@bar/recipes',
        JSON.stringify([{ ...baseInput, id: 'legacy-1', ownerId: 'user-a', visibility: 'public', createdAt: 'x', updatedAt: 'x' }]),
      );
      await reload();
      mockUnpublishRecipe.mockRejectedValueOnce(new TypeError('Network request failed'));
      await expect(useRecipesStore.getState().remove('legacy-1')).rejects.toBeInstanceOf(RecipePublishError);
      expect((await reload()).map((r) => r.id)).toEqual(['legacy-1']);
    });
  });

  describe('local storage failures', () => {
    it('a failed local save rejects with a non-publish error and changes nothing', async () => {
      jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
      const error = await useRecipesStore.getState().create({ ...baseInput, visibility: 'public' }).catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(RecipePublishError);
      expect(useRecipesStore.getState().recipes).toHaveLength(0);
      expect(mockPublishRecipe).not.toHaveBeenCalled();
    });
  });
});
