import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  authBackend,
  communityBackend,
  moderationBackend,
  AuthErrorCode,
  LogInInput,
  PasswordResetOutcome,
  ProfilePatch,
  SessionInvalidError,
  SignUpInput,
  SocialAuthMethod,
  SocialAuthResult,
  socialAuthProvider,
} from '../data/community';
import { AuthSession, LOCAL_GUEST_OWNER_ID, UserProfile } from '../domain/types';
import { reportError, setCrashReportingUser } from '../lib/crashReporting';
import { clearAccountScopedLocalData, reloadAccountScopedLocalData } from './accountScope';
import { useCommunityStore } from './communityStore';
import { useEntitlementStore } from './entitlementStore';
import { useLocaleStore } from './localeStore';
import { useModerationStore } from './moderationStore';

/**
 * Last profile that was successfully resolved for the signed-in session.
 * Purpose: an OFFLINE cold start. The Supabase session is restored from
 * device storage without the network, but the profile lookup is a network
 * call — before this cache, a failed lookup made load() treat a signed-in
 * user as a guest: their favorites/journal/recipes "vanished" (scoped to
 * the account, not deleted) and anything created in that state was stamped
 * as guest-owned. Only ever used for the SAME user id as the restored
 * session, and cleared on log-out/account deletion.
 */
const LAST_PROFILE_KEY = '@auth/lastProfile';

async function readCachedProfile(userId: string): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile | null;
    return parsed && parsed.id === userId && typeof parsed.username === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCachedProfile(profile: UserProfile | null): Promise<void> {
  try {
    if (profile) await AsyncStorage.setItem(LAST_PROFILE_KEY, JSON.stringify(profile));
    else await AsyncStorage.removeItem(LAST_PROFILE_KEY);
  } catch (e) {
    reportError(e, { module: 'authStore', action: 'writeCachedProfile' });
  }
}

let sessionEndSubscribed = false;

/**
 * How long load() waits for the NETWORK part of resolving the profile
 * (profile row / auth user lookup) before continuing without it. Offline,
 * supabase-js can hold those calls for ~30 s behind a token refresh; boot
 * must not. With a cached profile for the restored session the app starts
 * immediately as that account and the lookup finishes in the background;
 * without one it waits longer, then starts as a guest and switches to the
 * account if the lookup succeeds later. Mutable for tests only.
 */
export const authTimeouts = {
  profileWithCacheMs: 2000,
  profileWithoutCacheMs: 8000,
};

/**
 * > 0 while an explicit identity change (sign-in/up, log-out, account
 * deletion, invalid-session cleanup) is running. The backend's own auth
 * events (SIGNED_OUT / SIGNED_IN …) that these operations CAUSE are ignored
 * while it's set — otherwise the SIGNED_OUT listener ran handleSessionEnded
 * concurrently with logOut/deleteAccount's own cleanup (a second wipe,
 * reload and RevenueCat logOut). Released on a later macrotask because the
 * backend delivers those events via setTimeout(0).
 */
let identityTransitions = 0;
/** Bumped on every explicit identity change: a background profile lookup started by an older load() must not apply its result afterwards. */
let loadGeneration = 0;
let loadInFlight: Promise<void> | null = null;
/**
 * Bumped when the backend reports SIGNED_OUT while the UI shows no account
 * yet (i.e. during a boot load(), or while a late profile lookup is still
 * pending). A load()/late lookup that started before the bump must not then
 * present the account: its session is gone, and a profile row alone (public
 * read) proves nothing about the session.
 */
let sessionEndSignals = 0;

async function inIdentityTransition<T>(work: () => Promise<T>): Promise<T> {
  identityTransitions++;
  loadGeneration++;
  try {
    return await work();
  } finally {
    setTimeout(() => {
      identityTransitions--;
    }, 0);
  }
}

/** For tests: whether an explicit identity change is still being guarded. */
export function isIdentityTransitionInProgress(): boolean {
  return identityTransitions > 0;
}

const TIMED_OUT = Symbol('timed-out');
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

type ProfileLookup = { kind: 'profile'; profile: UserProfile } | { kind: 'invalid' } | { kind: 'unavailable' };

/**
 * The network half of load(): the session's profile row, creating it on a
 * first sign-in. Never throws. 'invalid' = the backend rejected the session
 * itself (account deleted elsewhere, bad JWT) — the ONLY case that signs
 * the device out; 'unavailable' = network/unknown, where the cached profile
 * may be used.
 */
async function lookUpProfile(userId: string): Promise<ProfileLookup> {
  try {
    const profile = await authBackend.getProfile(userId);
    if (profile) return { kind: 'profile', profile };
    if (authBackend.ensureProfileForCurrentSession) {
      const ensured = await authBackend.ensureProfileForCurrentSession();
      if (ensured && ensured.id === userId) return { kind: 'profile', profile: ensured };
    }
    return { kind: 'unavailable' };
  } catch (e) {
    if (e instanceof SessionInvalidError) return { kind: 'invalid' };
    reportError(e, { module: 'authStore', action: 'lookUpProfile' });
    return { kind: 'unavailable' };
  }
}

async function signOutThisDeviceOnly(): Promise<void> {
  try {
    if (authBackend.signOutLocally) await authBackend.signOutLocally();
    else await authBackend.logOut();
  } catch (e) {
    reportError(e, { module: 'authStore', action: 'signOutThisDeviceOnly' });
  }
}

/** Everything that has to happen locally once a session is over (whoever ended it). */
async function runSessionEndedCleanup(): Promise<void> {
  useAuthStore.setState({ profile: null });
  clearAccountScopedLocalData();
  resetSocialCaches();
  await writeCachedProfile(null);
  await reloadAccountScopedLocalData();
  await useEntitlementStore.getState().identify(null);
}

/** Switches the app to `profile` (sign-in/up, or a late-resolved restored session). */
async function adoptProfile(profile: UserProfile): Promise<void> {
  useAuthStore.setState({ profile });
  await writeCachedProfile(profile);
  resetSocialCaches();
  await reloadAccountScopedLocalData();
  await useEntitlementStore.getState().identify(profile.id);
}

/**
 * A profile lookup that load() stopped waiting for finished later. Applied
 * only if nothing changed the identity in the meantime.
 */
async function applyLateProfileLookup(generation: number, endSignals: number, userId: string, lookup: ProfileLookup): Promise<void> {
  // The load() that started this lookup may still be finishing (writing the
  // cache, reloading stores) — wait for it instead of dropping the result.
  if (loadInFlight) await loadInFlight.catch(() => undefined);
  if (generation !== loadGeneration || identityTransitions > 0) return;
  if (endSignals !== sessionEndSignals && lookup.kind === 'profile') return;
  const current = useAuthStore.getState().profile;
  if (current && current.id !== userId) return;
  if (lookup.kind === 'invalid') {
    await inIdentityTransition(async () => {
      await signOutThisDeviceOnly();
      if (useAuthStore.getState().profile) await runSessionEndedCleanup();
      else await writeCachedProfile(null);
    });
    return;
  }
  if (lookup.kind !== 'profile') return;
  if (current) {
    // Same account, fresher data (display name edited on another device…).
    useAuthStore.setState({ profile: lookup.profile });
    await writeCachedProfile(lookup.profile);
    return;
  }
  // Started as a guest because nothing was cached for this session.
  await inIdentityTransition(() => adoptProfile(lookup.profile));
}

let reconcileTimer: ReturnType<typeof setTimeout> | null = null;
let reconcileTarget: string | null = null;

/**
 * The backend reports a live session for `sessionUserId` (SIGNED_IN from a
 * deep link, TOKEN_REFRESHED once the network is back after an offline
 * start, USER_UPDATED). If the app isn't showing that account, reload —
 * previously only SIGNED_OUT was listened to, so e.g. an offline cold start
 * treated as a guest stayed a guest for the whole run. Deferred and
 * deduplicated: a burst of events causes at most one load().
 */
function scheduleIdentityReconcile(sessionUserId: string): void {
  reconcileTarget = sessionUserId;
  if (reconcileTimer) return;
  reconcileTimer = setTimeout(() => {
    reconcileTimer = null;
    const target = reconcileTarget;
    reconcileTarget = null;
    if (!target) return;
    void (async () => {
      if (loadInFlight) await loadInFlight.catch(() => undefined);
      if (identityTransitions > 0) return;
      if (useAuthStore.getState().profile?.id === target) return;
      await useAuthStore.getState().load();
    })().catch((e) => reportError(e, { module: 'authStore', action: 'reconcileIdentity' }));
  }, 0);
}

function subscribeToBackendSessionEvents(): void {
  if (sessionEndSubscribed) return;
  sessionEndSubscribed = true;
  // If the backend ends the session by itself (refresh token revoked/
  // expired, account deleted on another device), stop presenting this
  // device as signed in — otherwise the UI keeps showing the account while
  // every request silently runs as anonymous.
  authBackend.onSessionEnded?.(() => {
    if (identityTransitions > 0) return; // caused by our own logOut/deleteAccount/sign-in — already handled there
    if (!useAuthStore.getState().profile) {
      // Nothing on screen to clean up, but a boot load() / late profile
      // lookup for that session may still be running: make it stand down.
      sessionEndSignals++;
      return;
    }
    void useAuthStore.getState().handleSessionEnded();
  });
  authBackend.onSessionActive?.((userId) => {
    if (identityTransitions > 0) return;
    scheduleIdentityReconcile(userId);
  });
}

async function runLoad(): Promise<void> {
  const generation = loadGeneration;
  const endSignals = sessionEndSignals;
  subscribeToBackendSessionEvents();

  let session: AuthSession | null = null;
  try {
    session = await authBackend.getSession();
  } catch (e) {
    reportError(e, { module: 'authStore', action: 'load:getSession' });
  }

  let profile: UserProfile | null = null;
  if (session) {
    const userId = session.userId;
    const cached = await readCachedProfile(userId);
    const lookup = lookUpProfile(userId);
    const outcome = await withTimeout(lookup, cached ? authTimeouts.profileWithCacheMs : authTimeouts.profileWithoutCacheMs);
    if (outcome === TIMED_OUT) {
      // Offline / stalled network: continue now with the cached identity
      // (or as a guest if there is none); the lookup finishes in the background.
      profile = cached;
      void lookup
        .then((late) => applyLateProfileLookup(generation, endSignals, userId, late))
        .catch((e) => reportError(e, { module: 'authStore', action: 'load:lateProfile' }));
    } else if (outcome.kind === 'invalid') {
      // The account no longer exists / the session was revoked: sign this
      // device out instead of showing the cached profile of a dead account.
      await inIdentityTransition(signOutThisDeviceOnly);
      await writeCachedProfile(null);
      profile = null;
    } else {
      // Only a network failure may fall back to the cached profile — and
      // only for the SAME user id as the restored session.
      profile = outcome.kind === 'profile' ? outcome.profile : cached;
    }
  }

  if (profile && endSignals !== sessionEndSignals) {
    // The backend ended this session while we were loading (e.g. the
    // refresh token was revoked): don't present the account.
    profile = null;
    await writeCachedProfile(null);
  }

  useAuthStore.setState({ profile, isLoaded: true });
  if (profile) await writeCachedProfile(profile);
  resetSocialCaches();
  // Reload every account-scoped local store (favorites, inventory,
  // journal, shopping list) to whichever identity is actually signed in
  // right now, on every cold start — see accountScope.ts.
  await reloadAccountScopedLocalData();

  // Fire-and-forget: identifies the restored session to billing
  // (RevenueCat) and refreshes Premium for it. Never awaited here — it must
  // not add network latency to app boot, and it cannot throw.
  void useEntitlementStore.getState().identify(profile?.id ?? null);
}

/** Per-account caches of cloud social state (likes/follows/blocks) — cleared on every identity change so nothing carries over between accounts. */
function resetSocialCaches(): void {
  setCrashReportingUser(useAuthStore.getState().profile?.id ?? null);
  useCommunityStore.getState().reset();
  useModerationStore.getState().reset();
}

/**
 * The identity every account-scoped local store (favorites, inventory,
 * journal, shopping list — see accountScope.ts) stamps its data with and
 * filters its reads by: the signed-in profile's id, or LOCAL_GUEST_OWNER_ID
 * while signed out — the same convention PersonalRecipe.ownerId already
 * used. A plain function, not a hook, so it can be called from inside a
 * store action (recipesStore.create already does exactly this).
 */
export function currentOwnerId(): string {
  return useAuthStore.getState().profile?.id ?? LOCAL_GUEST_OWNER_ID;
}

export type SignUpUiResult = { ok: true } | { ok: 'pending-confirmation'; email: string } | { ok: false; error: AuthErrorCode };
export type LogInUiResult = { ok: true } | { ok: false; error: AuthErrorCode };

interface AuthState {
  profile: UserProfile | null;
  isLoaded: boolean;
  load: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<SignUpUiResult>;
  logIn: (input: LogInInput) => Promise<LogInUiResult>;
  /** Apple / Google. On success the app's identity switches exactly like an email sign-in (profile, per-account data, Premium). */
  socialSignIn: (method: SocialAuthMethod) => Promise<SocialAuthResult>;
  logOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<PasswordResetOutcome>;
  resendConfirmationEmail: (email: string) => Promise<PasswordResetOutcome>;
  /** Establishes a session from a password-recovery deep link — see app/reset-password.tsx. */
  confirmPasswordResetSession: (url: string) => Promise<boolean>;
  /** Sets a new password for whichever session is currently active (normally the one confirmPasswordResetSession just established from a recovery link) — that session is a real, valid one (Supabase's setSession, not a limited-purpose token), so app/reset-password.tsx calls load() afterward to pick up the now-authenticated profile and continue straight into the app, rather than forcing a redundant re-login with the password just set. */
  updatePassword: (newPassword: string) => Promise<PasswordResetOutcome>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  /**
   * Deletes the account on the backend first; only if that succeeds,
   * runs `afterRemoteDeletion(deletedUserId)` (the delete-account screen
   * passes the local re-homing of recipes/favorites/inventory/journal/
   * shopping list to the guest identity — kept out of this store to avoid a
   * circular import with recipesStore), then clears social data and the
   * session. Throws if the backend deletion fails, with nothing local changed.
   */
  deleteAccount: (
    afterRemoteDeletion?: (deletedUserId: string) => Promise<void>,
    options?: { appleAuthorizationCode?: string | null },
  ) => Promise<void>;
  /** The backend ended the session by itself — see load(). */
  handleSessionEnded: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  isLoaded: false,

  /**
   * Resolves who is signed in on this device. Deduplicated (concurrent
   * callers share one run) and bounded: it never waits on the network for
   * longer than authTimeouts allow — see runLoad.
   */
  load: () => {
    if (loadInFlight) return loadInFlight;
    loadInFlight = runLoad().finally(() => {
      loadInFlight = null;
    });
    return loadInFlight;
  },

  handleSessionEnded: () => inIdentityTransition(runSessionEndedCleanup),

  signUp: (input) =>
    inIdentityTransition(async () => {
      // The app language travels with the sign-up so the confirmation
      // email (and later reset emails) can be sent in it.
      const result = await authBackend.signUp({ ...input, locale: input.locale ?? useLocaleStore.getState().locale });
      if (result.ok === 'pending-confirmation') return result;
      if (!result.ok) return result;
      await adoptProfile(result.profile);
      return { ok: true } as const;
    }),

  logIn: (input) =>
    inIdentityTransition(async () => {
      const result = await authBackend.logIn(input);
      if (!result.ok) return result;
      await adoptProfile(result.profile);
      return { ok: true } as const;
    }),

  socialSignIn: (method) =>
    inIdentityTransition(async () => {
      const result = await socialAuthProvider.signIn(method);
      if (!result.ok) return result;
      await adoptProfile(result.profile);
      return result;
    }),

  logOut: () =>
    inIdentityTransition(async () => {
      // A failed server call must not leave the app half signed-out: the
      // backend removes the local session regardless (see SupabaseAuthBackend.logOut).
      await authBackend.logOut().catch((e) => reportError(e, { module: 'authStore', action: 'logOut' }));
      await socialAuthProvider.signOut?.().catch(() => undefined);
      set({ profile: null });
      resetSocialCaches();
      await writeCachedProfile(null);
      // Clears in-memory (not on-device — see accountScope.ts) local-store
      // state for anything account-scoped, so the very next screen render
      // can't flash the outgoing account's favorites/inventory/journal/
      // shopping list/private recipes…
      clearAccountScopedLocalData();
      // …then loads the GUEST identity's data. Without this the guest's own
      // favorites/bar/journal/shopping list stayed invisible after signing
      // out, and toggling a favorite the guest already had DELETED it
      // (the in-memory list said "not a favorite").
      await reloadAccountScopedLocalData();
      await useEntitlementStore.getState().identify(null);
    }),

  requestPasswordReset: async (email) => authBackend.requestPasswordReset(email),
  resendConfirmationEmail: async (email) => authBackend.resendConfirmationEmail(email),
  confirmPasswordResetSession: async (url) => authBackend.confirmPasswordResetSession(url),
  updatePassword: async (newPassword) => authBackend.updatePassword(newPassword),

  updateProfile: async (patch) => {
    const current = get().profile;
    if (!current) return;
    const updated = await authBackend.updateProfile(current.id, patch);
    if (updated) {
      set({ profile: updated });
      await writeCachedProfile(updated);
    }
  },

  deleteAccount: (afterRemoteDeletion, options) =>
    inIdentityTransition(async () => {
      const current = get().profile;
      if (!current) return;
      // Order matters for data safety. The backend deletion is the step that
      // can fail (network, server) — it runs FIRST. Only once it has
      // succeeded does the caller's local re-homing run (reassigning this
      // account's on-device recipes/favorites/etc. to the guest identity),
      // and only then is social data cleaned up. The previous order
      // re-homed everything first, so a failed deletion left a still-existing
      // account whose local data had silently been detached from it.
      await authBackend.deleteAccount(current.id, options);
      await socialAuthProvider.signOut?.().catch(() => undefined);
      if (afterRemoteDeletion) await afterRemoteDeletion(current.id);
      // Local backend: this is what actually removes likes/follows. Supabase:
      // already cascaded server-side with the auth user; best-effort only.
      await communityBackend.removeUserData(current.id).catch((e) => reportError(e, { module: 'authStore', action: 'deleteAccount:removeUserData' }));
      await moderationBackend.removeUserData(current.id).catch((e) => reportError(e, { module: 'authStore', action: 'deleteAccount:moderation' }));
      set({ profile: null });
      resetSocialCaches();
      await writeCachedProfile(null);
      clearAccountScopedLocalData();
      await reloadAccountScopedLocalData();
      await useEntitlementStore.getState().identify(null);
    }),
}));
