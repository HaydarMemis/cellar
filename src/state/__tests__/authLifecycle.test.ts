/**
 * Identity lifecycle of useAuthStore: sign-out restores the guest's own
 * data, offline cold starts never hang and never drop a signed-in identity,
 * a session the backend rejects signs the device out, the backend's own
 * auth events are reconciled without double-running explicit flows, and
 * billing is identified exactly once per identity change.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authBackend, SessionInvalidError } from '../../data/community';
import { UserProfile } from '../../domain/types';
import { authTimeouts, useAuthStore } from '../authStore';
import { useEntitlementStore } from '../entitlementStore';
import { useFavoritesStore } from '../favoritesStore';
import { bootTimeouts, hydrateStores } from '../hydrate';
import { useInventoryStore } from '../inventoryStore';
import { useShoppingListStore } from '../shoppingListStore';

type Backend = typeof authBackend & {
  onSessionEnded?: (l: () => void) => () => void;
  onSessionActive?: (l: (userId: string) => void) => () => void;
  signOutLocally?: () => Promise<void>;
  ensureProfileForCurrentSession?: () => Promise<UserProfile | undefined>;
};
const backend = authBackend as Backend;

// The local backend has no auth events of its own; stand in for Supabase's.
let emitSignedOut: () => void = () => undefined;
let emitSessionActive: (userId: string) => void = () => undefined;
backend.onSessionEnded = (listener) => {
  emitSignedOut = () => setTimeout(listener, 0); // deferred, exactly like SupabaseAuthBackend
  return () => undefined;
};
backend.onSessionActive = (listener) => {
  emitSessionActive = (userId) => setTimeout(() => listener(userId), 0);
  return () => undefined;
};

const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => {
  for (let i = 0; i < 5; i++) await tick();
};
const never = <T,>() => new Promise<T>(() => undefined);

const originalTimeouts = { ...authTimeouts };
// zustand copies state functions into every new state object, so a spy
// installed with jest.spyOn(getState(), …) outlives restoreAllMocks —
// put the real implementations back explicitly.
const realIdentify = useEntitlementStore.getState().identify;
const { load: realLoad, handleSessionEnded: realHandleSessionEnded } = useAuthStore.getState();

beforeEach(async () => {
  jest.restoreAllMocks();
  useEntitlementStore.setState({ identify: realIdentify });
  useAuthStore.setState({ load: realLoad, handleSessionEnded: realHandleSessionEnded });
  delete backend.signOutLocally;
  delete backend.ensureProfileForCurrentSession;
  Object.assign(authTimeouts, originalTimeouts);
  await flush();
  await AsyncStorage.clear();
  useAuthStore.setState({ profile: null, isLoaded: false });
  useFavoritesStore.setState({ favorites: [], isLoaded: false });
  useInventoryStore.setState({ entries: [], isLoaded: false });
  useShoppingListStore.setState({ entries: [], isLoaded: false });
  await useAuthStore.getState().load(); // guest, and subscribes to the events above
});

async function signUp(username: string): Promise<string> {
  const r = await useAuthStore.getState().signUp({ username, displayName: username, email: `${username}@example.com`, password: 'secret1' });
  expect(r.ok).toBe(true);
  return useAuthStore.getState().profile!.id;
}

describe('logOut', () => {
  it('shows the guest’s own data again (favorites, bar, shopping list) — nothing appears lost', async () => {
    await useFavoritesStore.getState().toggle('cocktail', 'negroni');
    await useInventoryStore.getState().toggle('gin');
    await useShoppingListStore.getState().addIngredients(['campari']);
    const guestShopping = useShoppingListStore.getState().entries.length;
    expect(guestShopping).toBeGreaterThan(0);

    await signUp('switcher');
    expect(useFavoritesStore.getState().isFavorite('cocktail', 'negroni')).toBe(false); // account scope

    await useAuthStore.getState().logOut();
    expect(useFavoritesStore.getState().isFavorite('cocktail', 'negroni')).toBe(true);
    expect(useInventoryStore.getState().entries.map((e) => e.ingredientId)).toContain('gin');
    expect(useShoppingListStore.getState().entries.length).toBe(guestShopping);
  });

  it('“add to favorites” right after sign-out never deletes a favorite the guest already had', async () => {
    await useFavoritesStore.getState().toggle('cocktail', 'negroni');
    await signUp('toggler');
    await useAuthStore.getState().logOut();

    // The favorite button's intent: add it if the UI says it isn't a favorite.
    // Before the fix the in-memory list was empty after sign-out, so this
    // toggled — and the repository DELETED the guest's existing favorite.
    if (!useFavoritesStore.getState().isFavorite('cocktail', 'negroni')) await useFavoritesStore.getState().toggle('cocktail', 'negroni');
    await useFavoritesStore.getState().load();
    expect(useFavoritesStore.getState().isFavorite('cocktail', 'negroni')).toBe(true);
  });

  it('identifies billing as the guest exactly once, even when the backend also emits SIGNED_OUT', async () => {
    await signUp('billing');
    const identify = jest.spyOn(useEntitlementStore.getState(), 'identify');
    const originalLogOut = authBackend.logOut;
    jest.spyOn(authBackend, 'logOut').mockImplementation(async () => {
      await originalLogOut();
      emitSignedOut(); // what supabase-js does inside signOut()
    });
    const ended = jest.spyOn(useAuthStore.getState(), 'handleSessionEnded');

    await useAuthStore.getState().logOut();
    await flush();

    expect(ended).not.toHaveBeenCalled();
    expect(identify.mock.calls).toEqual([[null]]);
  });
});

describe('deleteAccount', () => {
  it('its own SIGNED_OUT event does not trigger a second cleanup', async () => {
    await signUp('deleter');
    const identify = jest.spyOn(useEntitlementStore.getState(), 'identify');
    const original = authBackend.deleteAccount;
    jest.spyOn(authBackend, 'deleteAccount').mockImplementation(async (id, opts) => {
      await original(id, opts);
      emitSignedOut();
    });
    const ended = jest.spyOn(useAuthStore.getState(), 'handleSessionEnded');
    await useAuthStore.getState().deleteAccount();
    await flush();
    expect(ended).not.toHaveBeenCalled();
    expect(identify.mock.calls).toEqual([[null]]);
    expect(useAuthStore.getState().profile).toBeNull();
  });
});

describe('session ended by the backend (not by us)', () => {
  it('still signs the device out once', async () => {
    await signUp('revoked');
    await flush();
    const identify = jest.spyOn(useEntitlementStore.getState(), 'identify');
    emitSignedOut();
    await flush();
    expect(useAuthStore.getState().profile).toBeNull();
    expect(identify.mock.calls).toEqual([[null]]);
  });
});

describe('cold start never hangs on the network', () => {
  it('with a cached profile: starts as that account at once, then applies the late lookup', async () => {
    const id = await signUp('offline1');
    await useFavoritesStore.getState().toggle('cocktail', 'negroni');
    authTimeouts.profileWithCacheMs = 20;
    let resolveLate: (p: UserProfile | undefined) => void = () => undefined;
    jest.spyOn(authBackend, 'getProfile').mockImplementation(() => new Promise((r) => (resolveLate = r)));

    useAuthStore.setState({ profile: null, isLoaded: false });
    await useAuthStore.getState().load();
    expect(useAuthStore.getState().profile?.id).toBe(id);
    expect(useFavoritesStore.getState().isFavorite('cocktail', 'negroni')).toBe(true);

    const cached = useAuthStore.getState().profile!;
    resolveLate({ ...cached, displayName: 'Renamed elsewhere' });
    await flush();
    expect(useAuthStore.getState().profile?.displayName).toBe('Renamed elsewhere');
  });

  it('without a cached profile: starts as a guest after the cap and switches to the account when the lookup succeeds', async () => {
    const id = await signUp('offline2');
    const profile = useAuthStore.getState().profile!;
    await useFavoritesStore.getState().toggle('cocktail', 'negroni');
    await AsyncStorage.removeItem('@auth/lastProfile');
    authTimeouts.profileWithoutCacheMs = 20;
    let resolveLate: (p: UserProfile | undefined) => void = () => undefined;
    jest.spyOn(authBackend, 'getProfile').mockImplementation(() => new Promise((r) => (resolveLate = r)));
    const identify = jest.spyOn(useEntitlementStore.getState(), 'identify');

    useAuthStore.setState({ profile: null, isLoaded: false });
    await useAuthStore.getState().load();
    expect(useAuthStore.getState()).toMatchObject({ profile: null, isLoaded: true });

    resolveLate(profile);
    await flush();
    expect(useAuthStore.getState().profile?.id).toBe(id);
    expect(useFavoritesStore.getState().isFavorite('cocktail', 'negroni')).toBe(true);
    expect(identify.mock.calls).toEqual([[null], [id]]);
  });

  it('hydrateStores finishes even if auth never answers', async () => {
    const saved = { ...bootTimeouts };
    bootTimeouts.authMs = 30;
    jest.spyOn(useAuthStore.getState(), 'load').mockImplementation(() => never());
    await expect(hydrateStores()).resolves.toBeUndefined();
    Object.assign(bootTimeouts, saved);
  });
});

describe('restored session rejected by the backend (account deleted on another device)', () => {
  it('signs the device out instead of showing the cached profile', async () => {
    await signUp('gone');
    jest.spyOn(authBackend, 'getProfile').mockResolvedValue(undefined);
    backend.ensureProfileForCurrentSession = jest.fn().mockRejectedValue(new SessionInvalidError());
    const signOutLocally = jest.fn().mockResolvedValue(undefined);
    backend.signOutLocally = signOutLocally;

    useAuthStore.setState({ profile: null, isLoaded: false });
    await useAuthStore.getState().load();

    expect(useAuthStore.getState().profile).toBeNull();
    expect(signOutLocally).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem('@auth/lastProfile')).toBeNull();
  });

  it('a NETWORK failure of the same lookup still keeps the cached identity', async () => {
    const id = await signUp('flaky');
    jest.spyOn(authBackend, 'getProfile').mockResolvedValue(undefined);
    backend.ensureProfileForCurrentSession = jest.fn().mockResolvedValue(undefined);
    backend.signOutLocally = jest.fn();

    useAuthStore.setState({ profile: null, isLoaded: false });
    await useAuthStore.getState().load();
    expect(useAuthStore.getState().profile?.id).toBe(id);
    expect(backend.signOutLocally).not.toHaveBeenCalled();
  });

  it('rejected after a cached start: cleaned up once the late lookup answers', async () => {
    await signUp('lategone');
    authTimeouts.profileWithCacheMs = 20;
    let rejectLate: (e: unknown) => void = () => undefined;
    jest.spyOn(authBackend, 'getProfile').mockResolvedValue(undefined);
    backend.ensureProfileForCurrentSession = jest.fn(() => new Promise<UserProfile | undefined>((_r, reject) => (rejectLate = reject)));
    backend.signOutLocally = jest.fn().mockResolvedValue(undefined);

    useAuthStore.setState({ profile: null, isLoaded: false });
    await useAuthStore.getState().load();
    expect(useAuthStore.getState().profile).not.toBeNull();

    rejectLate(new SessionInvalidError());
    await flush();
    expect(useAuthStore.getState().profile).toBeNull();
    expect(backend.signOutLocally).toHaveBeenCalledTimes(1);
  });
});

describe('session ended by the backend while the app was still loading', () => {
  it('a SIGNED_OUT during the boot profile lookup is not overridden by the (publicly readable) profile row', async () => {
    await signUp('revoked');
    await AsyncStorage.removeItem('@auth/lastProfile');
    let resolveProfile: (p: UserProfile | undefined) => void = () => undefined;
    const real = await authBackend.getProfile(useAuthStore.getState().profile!.id);
    jest.spyOn(authBackend, 'getProfile').mockImplementation(() => new Promise((r) => (resolveProfile = r)));
    const identify = jest.spyOn(useEntitlementStore.getState(), 'identify');

    useAuthStore.setState({ profile: null, isLoaded: false });
    const loading = useAuthStore.getState().load();
    await tick();
    emitSignedOut(); // refresh token revoked: supabase-js drops the session
    await flush();
    resolveProfile(real);
    await loading;
    await flush();

    expect(useAuthStore.getState().profile).toBeNull();
    expect(identify.mock.calls.every(([id]) => id === null)).toBe(true);
  });

  it('a SIGNED_OUT while a late lookup is pending (guest start) keeps the app signed out', async () => {
    await signUp('revokedlate');
    const profile = useAuthStore.getState().profile!;
    await AsyncStorage.removeItem('@auth/lastProfile');
    authTimeouts.profileWithoutCacheMs = 20;
    let resolveLate: (p: UserProfile | undefined) => void = () => undefined;
    jest.spyOn(authBackend, 'getProfile').mockImplementation(() => new Promise((r) => (resolveLate = r)));

    useAuthStore.setState({ profile: null, isLoaded: false });
    await useAuthStore.getState().load();
    expect(useAuthStore.getState().profile).toBeNull();

    emitSignedOut();
    await flush();
    resolveLate(profile);
    await flush();
    expect(useAuthStore.getState().profile).toBeNull();
  });

  it('a late "invalid" answer arriving while load() is still finishing is applied, not dropped', async () => {
    await signUp('lateinvalid');
    authTimeouts.profileWithCacheMs = 20;
    let rejectLate: (e: unknown) => void = () => undefined;
    jest.spyOn(authBackend, 'getProfile').mockResolvedValue(undefined);
    backend.ensureProfileForCurrentSession = jest.fn(() => new Promise<UserProfile | undefined>((_r, reject) => (rejectLate = reject)));
    backend.signOutLocally = jest.fn().mockResolvedValue(undefined);
    // Keep load() busy after the timeout so the late answer lands mid-load.
    let releaseCacheWrite: () => void = () => undefined;
    // AsyncStorage's jest mock is itself a jest.fn, so jest.spyOn would
    // re-implement the very function we need to call through to — swap the
    // property by hand and put it back below.
    const realSetItem = AsyncStorage.setItem;
    let held = false;
    AsyncStorage.setItem = async (key: string, value: string) => {
      if (key === '@auth/lastProfile' && !held) {
        held = true;
        rejectLate(new SessionInvalidError());
        await new Promise<void>((r) => (releaseCacheWrite = r));
      }
      return realSetItem(key, value);
    };

    useAuthStore.setState({ profile: null, isLoaded: false });
    const loading = useAuthStore.getState().load();
    while (!held) await new Promise((r) => setTimeout(r, 5));
    await flush(); // the late answer is now queued behind the still-running load()
    releaseCacheWrite();
    try {
      await loading;
      await flush();
    } finally {
      AsyncStorage.setItem = realSetItem;
    }
    expect(useAuthStore.getState().profile).toBeNull();
    expect(backend.signOutLocally).toHaveBeenCalledTimes(1);
  });
});

describe('backend reports a live session the app is not showing', () => {
  it('reloads once (deduplicated) and adopts the session’s account', async () => {
    const id = await signUp('deeplink');
    // Simulate: the app shows a guest while the backend holds this session
    // (e.g. established by a confirmation link, or refreshed once back online).
    useAuthStore.setState({ profile: null });
    await flush();
    const load = jest.spyOn(useAuthStore.getState(), 'load');

    emitSessionActive(id);
    emitSessionActive(id);
    emitSessionActive(id);
    await flush();

    expect(load).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().profile?.id).toBe(id);
  });

  it('ignores events for the account already shown, and events caused by an explicit sign-in', async () => {
    const load = jest.spyOn(useAuthStore.getState(), 'load');
    const original = authBackend.logIn;
    await signUp('explicit');
    await useAuthStore.getState().logOut();
    jest.spyOn(authBackend, 'logIn').mockImplementation(async (input) => {
      const r = await original(input);
      if (r.ok) emitSessionActive(r.profile.id); // SIGNED_IN from signInWithPassword
      return r;
    });
    await useAuthStore.getState().logIn({ email: 'explicit@example.com', password: 'secret1' });
    await flush();
    emitSessionActive(useAuthStore.getState().profile!.id); // e.g. a later TOKEN_REFRESHED
    await flush();
    expect(load).not.toHaveBeenCalled();
  });
});
