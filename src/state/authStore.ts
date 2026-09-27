import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { authBackend, communityBackend, moderationBackend, AuthErrorCode, LogInInput, PasswordResetOutcome, ProfilePatch, SignUpInput, SocialAuthMethod, SocialAuthResult, socialAuthProvider } from '../data/community';
import { LOCAL_GUEST_OWNER_ID, UserProfile } from '../domain/types';
import { reportError, setCrashReportingUser } from '../lib/crashReporting';
import { clearAccountScopedLocalData, reloadAccountScopedLocalData } from './accountScope';
import { useCommunityStore } from './communityStore';
import { useEntitlementStore } from './entitlementStore';
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

  load: async () => {
    const session = await authBackend.getSession();
    let profile: UserProfile | null = null;
    if (session) {
      profile = (await authBackend.getProfile(session.userId)) ?? null;
      if (!profile && authBackend.ensureProfileForCurrentSession) {
        profile = (await authBackend.ensureProfileForCurrentSession().catch(() => undefined)) ?? null;
      }
      if (!profile) profile = await readCachedProfile(session.userId);
    }
    set({ profile, isLoaded: true });
    if (profile) await writeCachedProfile(profile);
    resetSocialCaches();
    // Reload every account-scoped local store (favorites, inventory,
    // journal, shopping list) to whichever identity is actually signed in
    // right now, on every cold start — see accountScope.ts.
    await reloadAccountScopedLocalData();

    // Once per app run: if the backend ends the session by itself (refresh
    // token revoked/expired, account deleted on another device), stop
    // presenting this device as signed in — otherwise the UI keeps showing
    // the account while every request silently runs as anonymous.
    if (!sessionEndSubscribed && authBackend.onSessionEnded) {
      sessionEndSubscribed = true;
      authBackend.onSessionEnded(() => {
        if (!useAuthStore.getState().profile) return; // our own logOut/deleteAccount already handled it
        void useAuthStore.getState().handleSessionEnded();
      });
    }
    // Fire-and-forget: identifies the restored session to billing
    // (RevenueCat) and refreshes Premium for it. Never awaited here — it must
    // not add network latency to app boot, and it cannot throw.
    void useEntitlementStore.getState().identify(profile?.id ?? null);
  },

  handleSessionEnded: async () => {
    set({ profile: null });
    clearAccountScopedLocalData();
    resetSocialCaches();
    await writeCachedProfile(null);
    await reloadAccountScopedLocalData();
    await useEntitlementStore.getState().identify(null);
  },

  signUp: async (input) => {
    const result = await authBackend.signUp(input);
    if (result.ok === 'pending-confirmation') return result;
    if (!result.ok) return result;
    set({ profile: result.profile });
    await writeCachedProfile(result.profile);
    resetSocialCaches();
    await reloadAccountScopedLocalData();
    await useEntitlementStore.getState().identify(result.profile.id);
    return { ok: true };
  },

  logIn: async (input) => {
    const result = await authBackend.logIn(input);
    if (!result.ok) return result;
    set({ profile: result.profile });
    await writeCachedProfile(result.profile);
    resetSocialCaches();
    await reloadAccountScopedLocalData();
    await useEntitlementStore.getState().identify(result.profile.id);
    return { ok: true };
  },

  socialSignIn: async (method) => {
    const result = await socialAuthProvider.signIn(method);
    if (!result.ok) return result;
    set({ profile: result.profile });
    await writeCachedProfile(result.profile);
    resetSocialCaches();
    await reloadAccountScopedLocalData();
    await useEntitlementStore.getState().identify(result.profile.id);
    return result;
  },

  logOut: async () => {
    await authBackend.logOut();
    await socialAuthProvider.signOut?.().catch(() => undefined);
    set({ profile: null });
    resetSocialCaches();
    await writeCachedProfile(null);
    // Clears in-memory (not on-device — see accountScope.ts) local-store
    // state for anything account-scoped, so the very next screen render
    // can't flash the outgoing account's favorites/inventory/journal/
    // shopping list/private recipes before a different account signs in.
    await clearAccountScopedLocalData();
    await useEntitlementStore.getState().identify(null);
  },

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

  deleteAccount: async (afterRemoteDeletion, options) => {
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
  },
}));
