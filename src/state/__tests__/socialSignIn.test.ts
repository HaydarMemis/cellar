import AsyncStorage from '@react-native-async-storage/async-storage';
import { socialAuthProvider } from '../../data/community';
import { useAuthStore } from '../authStore';
import { useCommunityStore } from '../communityStore';
import { useFavoritesStore } from '../favoritesStore';

const profile = { id: '33333333-3333-4333-8333-333333333333', username: 'apple_user', displayName: 'Apple User', avatarColorSeed: 'a', createdAt: 'x' };

beforeEach(async () => {
  jest.restoreAllMocks();
  await AsyncStorage.clear();
  useAuthStore.setState({ profile: null, isLoaded: true });
  useFavoritesStore.setState({ favorites: [], isLoaded: false });
});

describe('authStore.socialSignIn', () => {
  it('without Supabase there is no social provider — no button, no fake success', async () => {
    expect(await socialAuthProvider.isAvailable('apple')).toBe(false);
    expect(await socialAuthProvider.isAvailable('google')).toBe(false);
    expect(await useAuthStore.getState().socialSignIn('apple')).toEqual({ ok: false, error: 'not-configured' });
    expect(useAuthStore.getState().profile).toBeNull();
  });

  it('a successful Apple/Google sign-in switches the app identity like an email sign-in', async () => {
    jest.spyOn(socialAuthProvider, 'signIn').mockResolvedValue({ ok: true, profile });
    useCommunityStore.setState({ likedByMe: new Set(['stale']) });
    const result = await useAuthStore.getState().socialSignIn('apple');
    expect(result.ok).toBe(true);
    expect(useAuthStore.getState().profile?.id).toBe(profile.id);
    expect(useCommunityStore.getState().likedByMe.size).toBe(0);
    expect(useFavoritesStore.getState().isLoaded).toBe(true); // account-scoped stores reloaded for this identity
    expect(JSON.parse((await AsyncStorage.getItem('@auth/lastProfile')) ?? 'null')?.id).toBe(profile.id);
  });

  it('a cancelled or failed provider sign-in leaves the app signed out', async () => {
    jest.spyOn(socialAuthProvider, 'signIn').mockResolvedValue({ ok: false, error: 'cancelled' });
    expect(await useAuthStore.getState().socialSignIn('google')).toEqual({ ok: false, error: 'cancelled' });
    expect(useAuthStore.getState().profile).toBeNull();
  });
});
