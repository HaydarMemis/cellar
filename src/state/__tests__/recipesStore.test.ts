import AsyncStorage from '@react-native-async-storage/async-storage';
import { NewRecipeInput } from '../../data/repositories/RecipeRepository';
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
