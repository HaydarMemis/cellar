import AsyncStorage from '@react-native-async-storage/async-storage';
import { authBackend, communityBackend } from '../../data/community';
import { asyncStorageRecipeRepository } from '../../data/repositories/RecipeRepository';
import { LOCAL_GUEST_OWNER_ID } from '../../domain/types';
import { isUuid, remoteRecipeId } from '../../domain/uuid';
import { useAuthStore } from '../authStore';
import { useCommunityStore } from '../communityStore';
import { useFavoritesStore } from '../favoritesStore';
import { useRecipesStore } from '../recipesStore';

const baseRecipe = {
  name: 'R',
  description: '',
  baseSpirit: 'gin',
  category: [],
  tags: [],
  ingredients: [],
  method: 'shake' as const,
  steps: ['Shake.'],
  glass: ['coupe' as const],
  abv: null,
  difficulty: 'easy' as const,
  prepTimeMinutes: 3,
};

beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.clear();
  useAuthStore.setState({ profile: null, isLoaded: false });
  useRecipesStore.setState({ recipes: [], isLoaded: false });
  useFavoritesStore.setState({ favorites: [], isLoaded: false });
  useCommunityStore.setState({ likeCounts: {}, likedByMe: new Set(), followingByMe: new Set(), followCountsByUser: {} });
});

describe('recipe ids (publishability)', () => {
  it('new recipes get a uuid id — the Supabase recipes.id column type', async () => {
    const r = await asyncStorageRecipeRepository.create(baseRecipe, 'owner');
    expect(isUuid(r.id)).toBe(true);
  });

  it('UPGRADE: a legacy recipe-… recipe stays intact on device and keeps a stable remote id', async () => {
    const legacy = { ...baseRecipe, id: 'recipe-lz3k9w1-ab12cd34', ownerId: 'owner', visibility: 'private' as const, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' };
    await AsyncStorage.setItem('@bar/recipes', JSON.stringify([legacy]));
    await useRecipesStore.getState().load();
    const loaded = useRecipesStore.getState().recipes;
    expect(loaded).toEqual([legacy]); // untouched — no destructive id migration
    expect(isUuid(remoteRecipeId(loaded[0].id))).toBe(true);
  });
});

describe('offline cold start', () => {
  it('keeps the signed-in identity (and its data) when the profile lookup fails offline', async () => {
    const signUp = await useAuthStore.getState().signUp({ username: 'offline', displayName: 'Off', email: 'off@example.com', password: 'secret1' });
    expect(signUp.ok).toBe(true);
    const id = useAuthStore.getState().profile!.id;
    await useFavoritesStore.getState().toggle('cocktail', 'negroni');

    // Cold start with no network: session restores, profile fetch fails.
    jest.spyOn(authBackend, 'getProfile').mockResolvedValue(undefined);
    useAuthStore.setState({ profile: null, isLoaded: false });
    useFavoritesStore.setState({ favorites: [], isLoaded: false });
    await useAuthStore.getState().load();

    expect(useAuthStore.getState().profile?.id).toBe(id);
    expect(useFavoritesStore.getState().favorites.map((f) => f.targetId)).toContain('negroni');
  });

  it('never applies a cached profile to a different session user', async () => {
    await useAuthStore.getState().signUp({ username: 'usera', displayName: 'A', email: 'a@example.com', password: 'secret1' });
    await useAuthStore.getState().logOut();
    expect(await AsyncStorage.getItem('@auth/lastProfile')).toBeNull();
  });
});

describe('account deletion ordering', () => {
  it('if the backend deletion fails, nothing local is re-homed and the account stays signed in', async () => {
    await useAuthStore.getState().signUp({ username: 'keepme', displayName: 'K', email: 'k@example.com', password: 'secret1' });
    const id = useAuthStore.getState().profile!.id;
    const recipe = await useRecipesStore.getState().create({ ...baseRecipe, visibility: 'private' });
    jest.spyOn(authBackend, 'deleteAccount').mockRejectedValue(new Error('network down'));

    const reassign = jest.fn(async (ownerId: string) => useRecipesStore.getState().reassignOwnerToGuestAndPrivatize(ownerId));
    await expect(useAuthStore.getState().deleteAccount(reassign)).rejects.toThrow('network down');

    expect(reassign).not.toHaveBeenCalled();
    expect(useAuthStore.getState().profile?.id).toBe(id);
    expect(useRecipesStore.getState().recipes.find((r) => r.id === recipe.id)?.ownerId).toBe(id);
  });

  it('on success, re-homes local data to the guest identity after the backend deletion', async () => {
    await useAuthStore.getState().signUp({ username: 'goodbye', displayName: 'G', email: 'g@example.com', password: 'secret1' });
    const recipe = await useRecipesStore.getState().create({ ...baseRecipe, visibility: 'private' });
    await useAuthStore.getState().deleteAccount((ownerId) => useRecipesStore.getState().reassignOwnerToGuestAndPrivatize(ownerId));
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useRecipesStore.getState().recipes.find((r) => r.id === recipe.id)?.ownerId).toBe(LOCAL_GUEST_OWNER_ID);
  });
});

describe('session ended by the backend', () => {
  it('handleSessionEnded signs the device out locally and clears cached social state', async () => {
    await useAuthStore.getState().signUp({ username: 'expired', displayName: 'E', email: 'e@example.com', password: 'secret1' });
    useCommunityStore.setState({ likedByMe: new Set(['r1']), followingByMe: new Set(['u2']) });
    await useAuthStore.getState().handleSessionEnded();
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useCommunityStore.getState().likedByMe.size).toBe(0);
    expect(useCommunityStore.getState().followingByMe.size).toBe(0);
  });
});

describe('social cache is per-account', () => {
  it('switching accounts does not carry the previous account\'s likes/follows', async () => {
    await useAuthStore.getState().signUp({ username: 'liker', displayName: 'L', email: 'l@example.com', password: 'secret1' });
    useCommunityStore.setState({ likedByMe: new Set(['r1']), followingByMe: new Set(['u9']) });
    await useAuthStore.getState().logOut();
    await useAuthStore.getState().signUp({ username: 'other', displayName: 'O', email: 'o@example.com', password: 'secret1' });
    expect(useCommunityStore.getState().likedByMe.has('r1')).toBe(false);
    expect(useCommunityStore.getState().followingByMe.has('u9')).toBe(false);
  });

  it('refreshLikes is authoritative for the requested ids (clears stale liked flags)', async () => {
    useCommunityStore.setState({ likedByMe: new Set(['r1', 'r2']) });
    jest.spyOn(communityBackend, 'getLikeCounts').mockResolvedValue({ r1: 0 });
    jest.spyOn(communityBackend, 'getLikedSet').mockResolvedValue(new Set());
    await useCommunityStore.getState().refreshLikes(['r1'], 'me');
    expect(useCommunityStore.getState().likedByMe.has('r1')).toBe(false);
    expect(useCommunityStore.getState().likedByMe.has('r2')).toBe(true); // not requested — untouched
  });

  it('a second like tap while the first write is in flight is ignored (no double write)', async () => {
    let release: () => void = () => undefined;
    const toggle = jest.spyOn(communityBackend, 'toggleLike').mockImplementation(() => new Promise((resolve) => (release = () => resolve(true))));
    const first = useCommunityStore.getState().toggleLike('r1', 'me');
    await useCommunityStore.getState().toggleLike('r1', 'me');
    release();
    await first;
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(useCommunityStore.getState().likedByMe.has('r1')).toBe(true);
  });
});

describe('account deletion with Sign in with Apple', () => {
  it('passes the Apple authorization code through to the backend deletion', async () => {
    await useAuthStore.getState().signUp({ username: 'appleish', displayName: 'A', email: 'ap@example.com', password: 'secret1' });
    const spy = jest.spyOn(authBackend, 'deleteAccount');
    await useAuthStore.getState().deleteAccount(undefined, { appleAuthorizationCode: 'code-123' });
    expect(spy).toHaveBeenCalledWith(expect.any(String), { appleAuthorizationCode: 'code-123' });
    expect(useAuthStore.getState().profile).toBeNull();
  });
});
