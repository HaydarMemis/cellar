import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthError, isAuthError, isAuthRetryableFetchError, isAuthSessionMissingError } from '@supabase/supabase-js';
import * as AuthSessionModule from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { AuthSession, UserProfile } from '../../domain/types';
import { recordAuthDiagnostic } from '../../lib/authDiagnostics';
import { reportError } from '../../lib/crashReporting';
import {
  AuthBackend,
  AuthErrorCode,
  AuthResult,
  LogInInput,
  PasswordResetOutcome,
  ProfilePatch,
  SessionInvalidError,
  SignUpInput,
  SignUpOutcome,
} from '../community/AuthBackend';
import { supabase, supabaseAuthStorageKey } from './client';

/**
 * A REAL implementation of AuthBackend against Supabase Auth + a `profiles`
 * table (see supabase/schema.sql). This is genuinely production-shaped
 * code — not a stub — but it is only ever used when `isSupabaseConfigured`
 * is true (see src/data/community/index.ts); this file assumes `supabase`
 * is non-null and will throw clearly if that invariant is ever violated by
 * a caller, rather than silently no-op.
 *
 * Passwords are never touched here — Supabase Auth owns hashing, salting,
 * and session tokens entirely server-side. This is the real production
 * auth path; src/data/community/AuthBackend.ts (local) is the dev/offline
 * stand-in, not the other way around.
 *
 * The account's real email address is what Supabase Auth actually
 * authenticates by (username is a separate, public display handle stored
 * only in `profiles`, never used to sign in) — earlier iterations of this
 * file derived a placeholder `${username}@users.cellar.app` address
 * instead of collecting a real one, which made password reset and email
 * verification impossible to build honestly. Fixed here: signUp/logIn now
 * take a real `email`.
 */
function client() {
  if (!supabase) throw new Error('SupabaseAuthBackend used without a configured Supabase client');
  return supabase;
}

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Exported for tests. `avatar_url` is optional so a database without the 20260928120000 migration still maps cleanly (no photo). */
export function toProfile(row: {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_color_seed: string;
  avatar_url?: string | null;
  created_at: string;
}): UserProfile {
  const profile: UserProfile = {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio ?? undefined,
    avatarColorSeed: row.avatar_color_seed,
    createdAt: row.created_at,
  };
  if (row.avatar_url) profile.avatarUrl = row.avatar_url;
  return profile;
}

async function fetchProfile(userId: string): Promise<UserProfile | undefined> {
  const { data, error } = await client().from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error || !data) return undefined;
  return toProfile(data);
}

/**
 * Maps a Supabase AuthError to one of this app's own AuthErrorCode values,
 * so the UI never has to show (or localize around) a raw string like
 * "AuthApiError: Invalid login credentials". Checks the stable `.code`
 * field first where GoTrue provides one, falling back to matching known
 * phrases in `.message` — defense in depth against relying on either
 * alone, since exact error codes have changed across GoTrue versions.
 */
function mapAuthError(error: AuthError, context: 'signUp' | 'logIn'): AuthErrorCode {
  const code = (error as { code?: string }).code?.toLowerCase() ?? '';
  const message = error.message.toLowerCase();

  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered') || message.includes('already exists')) {
    return 'email-taken';
  }
  if (code === 'weak_password' || message.includes('weak password') || message.includes('password should be at least')) {
    return 'weak-password';
  }
  if (code === 'invalid_credentials' || message.includes('invalid login credentials') || message.includes('invalid email or password')) {
    return context === 'signUp' ? 'invalid-password' : 'wrong-password';
  }
  // GoTrue answers a sign-up whose confirmation email could not be sent
  // (SMTP failure / sender not configured) with a 5xx "Error sending
  // confirmation email" — the sign-up is rolled back. That is not a
  // connection problem and must not be reported as one.
  if (message.includes('error sending') && message.includes('email')) {
    return 'email-send-failed';
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'email-not-confirmed';
  }
  if (code === 'email_address_invalid' || message.includes('invalid email') || message.includes('unable to validate email')) {
    return 'invalid-email';
  }
  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    error.status === 429 ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return 'rate-limited';
  }
  if (!error.status || error.status >= 500 || message.includes('network') || message.includes('fetch')) {
    return 'network-error';
  }
  return 'unknown';
}

/**
 * First sign-in after email confirmation: the profile row doesn't exist yet
 * (sign-up couldn't create it without a session — see signUp). Uses the
 * username/display name chosen at sign-up (stored in user_metadata). If that
 * username was claimed by someone else in the meantime, a short numeric
 * suffix is added rather than locking a real, confirmed account out forever.
 * Idempotent: an upsert on `id`, so a concurrent duplicate attempt is safe.
 */
export async function createProfileOnFirstSignIn(
  userId: string,
  metadata: unknown,
  email: string | undefined,
  hints: { fullName?: string } = {},
): Promise<UserProfile | undefined> {
  const meta = (metadata ?? {}) as { username?: unknown; display_name?: unknown; full_name?: unknown; name?: unknown };
  const cleaned = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20);
  const fullName =
    hints.fullName?.trim() ||
    (typeof meta.full_name === 'string' ? meta.full_name.trim() : '') ||
    (typeof meta.name === 'string' ? meta.name.trim() : '');
  // Apple "Hide My Email" addresses (…@privaterelay.appleid.com) have a
  // random local part — a poor username, so prefer the person's name there.
  const isPrivateRelay = !!email && email.toLowerCase().endsWith('@privaterelay.appleid.com');
  let base = typeof meta.username === 'string' ? cleaned(meta.username) : '';
  if (base.length < 3 && isPrivateRelay && fullName) base = cleaned(fullName);
  if (base.length < 3 && !isPrivateRelay) base = cleaned(email?.split('@')[0] ?? '');
  if (base.length < 3 && fullName) base = cleaned(fullName);
  if (base.length < 3) base = 'user';
  const metaDisplayName = typeof meta.display_name === 'string' ? meta.display_name.trim() : '';
  const displayNameValue = (metaDisplayName || fullName || base).slice(0, 50);

  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = attempt === 0 ? '' : `_${Math.floor(1000 + Math.random() * 9000)}`;
    const username = (base.slice(0, 20 - suffix.length) + suffix).padEnd(3, '_');
    const { data: created, error } = await client()
      .from('profiles')
      // ignoreDuplicates => ON CONFLICT (id) DO NOTHING: if the profile
      // actually exists and fetchProfile only failed transiently, this must
      // never overwrite a display name/bio the user has since edited.
      .upsert({ id: userId, username, display_name: displayNameValue, avatar_color_seed: username }, { onConflict: 'id', ignoreDuplicates: true })
      .select('*')
      .maybeSingle();
    if (created) return toProfile(created);
    if (!error) break; // conflict on id => the row already exists; read it below
    if (error.code !== '23505') {
      if (error) reportError(error, { module: 'SupabaseAuthBackend', action: 'createProfileOnFirstSignIn' });
      break;
    }
  }
  return fetchProfile(userId);
}

/**
 * How long app boot waits for supabase-js's getSession(). With an expired
 * access token getSession() refreshes it first, and on a dead network that
 * refresh retries with backoff for ~30 s before giving up — while the app
 * sits on its splash screen.
 */
export const GET_SESSION_TIMEOUT_MS = 3000;
/** Upper bound for an explicit sign-out's server call (the local session is removed regardless). */
export const SIGN_OUT_TIMEOUT_MS = 5000;

const TIMED_OUT = Symbol('timed-out');

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

type StoredSession = { user?: { id?: unknown; created_at?: unknown } | null; refresh_token?: unknown } | null;

async function readStoredSession(): Promise<StoredSession> {
  const key = supabaseAuthStorageKey();
  if (!key) return null;
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

/**
 * The identity of the session supabase-js has persisted on this device,
 * WITHOUT the network. Used only when getSession() can't answer because the
 * network is down (timeout / retryable fetch error) — supabase-js keeps the
 * stored session in exactly that case, so the person is still signed in and
 * must not be treated as a guest for the whole app run.
 */
async function storedSessionIdentity(): Promise<AuthSession | null> {
  const stored = await readStoredSession();
  const id = stored?.user?.id;
  if (typeof id !== 'string' || !id || typeof stored?.refresh_token !== 'string') return null;
  const createdAt = typeof stored.user?.created_at === 'string' ? stored.user.created_at : null;
  const parsed = createdAt ? new Date(createdAt) : null;
  return { userId: id, createdAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date(0).toISOString() };
}

/**
 * The backend authoritatively rejected the session: the user no longer
 * exists (deleted on another device), the JWT is invalid, or the server-side
 * session is gone. Anything else (no connection, timeouts, 5xx) is NOT this.
 */
export function isSessionRejectedError(error: unknown): boolean {
  if (!error || isAuthRetryableFetchError(error)) return false;
  if (isAuthSessionMissingError(error)) return true;
  if (!isAuthError(error)) return false;
  const code = (error.code ?? '').toString().toLowerCase();
  if (code === 'user_not_found' || code === 'bad_jwt' || code === 'session_not_found' || code === 'no_authorization') return true;
  return error.status === 401 || error.status === 403 || error.status === 404;
}

/** This device only, never throws, and the stored session is gone afterwards even offline. */
async function signOutLocally(): Promise<void> {
  try {
    const result = await withTimeout(client().auth.signOut({ scope: 'local' }), SIGN_OUT_TIMEOUT_MS);
    if (result !== TIMED_OUT && !result.error) return;
  } catch (e) {
    reportError(e, { module: 'SupabaseAuthBackend', action: 'signOutLocally' });
  }
  await clearStoredSession();
}

/**
 * Last resort for sign-out: supabase-js's signOut() does NOT remove the
 * stored session when it can't first load it (an expired access token whose
 * refresh fails offline) — the person would come back signed in on the next
 * launch. The key is removed directly; an in-flight refresh that completes
 * later discards its result because storage changed under it.
 */
async function clearStoredSession(): Promise<void> {
  const key = supabaseAuthStorageKey();
  if (!key) return;
  try {
    if (await AsyncStorage.getItem(key)) {
      await AsyncStorage.removeItem(key);
      await AsyncStorage.removeItem(`${key}-user`);
      await AsyncStorage.removeItem(`${key}-code-verifier`);
    }
  } catch (e) {
    reportError(e, { module: 'SupabaseAuthBackend', action: 'clearStoredSession' });
  }
}

export const supabaseAuthBackend: AuthBackend = {
  async getSession(): Promise<AuthSession | null> {
    let result: Awaited<ReturnType<ReturnType<typeof client>['auth']['getSession']>> | typeof TIMED_OUT;
    try {
      result = await withTimeout(client().auth.getSession(), GET_SESSION_TIMEOUT_MS);
    } catch (e) {
      reportError(e, { module: 'SupabaseAuthBackend', action: 'getSession' });
      return storedSessionIdentity();
    }
    if (result === TIMED_OUT) return storedSessionIdentity();
    const { data, error } = result;
    if (data.session) return { userId: data.session.user.id, createdAt: new Date(data.session.user.created_at).toISOString() };
    // Offline with an expired access token: supabase-js answers "no session"
    // plus a retryable error but KEEPS the stored session (it will refresh
    // once the network is back) — so this device is still signed in.
    if (error && isAuthRetryableFetchError(error)) return storedSessionIdentity();
    return null;
  },

  onSessionEnded(listener) {
    const { data } = client().auth.onAuthStateChange((event) => {
      // Deferred: supabase-js holds an internal lock while dispatching
      // auth events, and the listener goes on to touch app state.
      if (event === 'SIGNED_OUT') setTimeout(listener, 0);
    });
    return () => data.subscription.unsubscribe();
  },

  onSessionActive(listener) {
    const { data } = client().auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED' && event !== 'USER_UPDATED') return;
      const userId = session?.user?.id;
      // Deferred for the same reason as onSessionEnded.
      if (userId) setTimeout(() => listener(userId), 0);
    });
    return () => data.subscription.unsubscribe();
  },

  signOutLocally,

  async ensureProfileForCurrentSession() {
    const { data, error } = await client().auth.getUser();
    if (error) {
      if (isSessionRejectedError(error)) throw new SessionInvalidError(error.message);
      return undefined; // network — the caller may use its cached profile
    }
    if (!data.user) return undefined;
    return (await fetchProfile(data.user.id)) ?? createProfileOnFirstSignIn(data.user.id, data.user.user_metadata, data.user.email);
  },

  async getCurrentUserEmail() {
    const { data } = await client().auth.getUser();
    return data.user?.email ?? null;
  },

  async getProfile(userId) {
    return fetchProfile(userId);
  },

  async getAllProfiles() {
    // Bounded on purpose — see class doc. A creator-search feature would
    // need a proper paginated/queried endpoint, not this. Prefer
    // getProfilesByIds whenever the caller already knows which authors it
    // needs (e.g. Discover resolving a feed's distinct owner ids) — this
    // unbounded-by-usage fetch doesn't scale with the community, that one does.
    const { data, error } = await client().from('profiles').select('*').order('created_at', { ascending: false }).limit(200);
    if (error || !data) return [];
    return data.map(toProfile);
  },

  async getProfilesByIds(userIds) {
    if (userIds.length === 0) return [];
    const { data, error } = await client().from('profiles').select('*').in('id', userIds);
    if (error || !data) return [];
    return data.map(toProfile);
  },

  async signUp({ username, displayName, email, password, locale }: SignUpInput): Promise<SignUpOutcome> {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalizedUsername)) return { ok: false, error: 'invalid-username' };
    if (!EMAIL_PATTERN.test(normalizedEmail)) return { ok: false, error: 'invalid-email' };
    if (password.length < 6) return { ok: false, error: 'invalid-password' };

    // The username itself still has to be reserved up front — Supabase
    // Auth has no idea it exists, only `profiles` does, and profile
    // creation happens after auth.signUp below. Checking here avoids
    // creating an orphaned auth.users row (a real account with no way to
    // ever get a profile) for a username that was always going to collide.
    const { data: existingUsername, error: usernameCheckError } = await client().from('profiles').select('id').eq('username', normalizedUsername).maybeSingle();
    if (usernameCheckError) recordAuthDiagnostic('signUp:usernameCheck', usernameCheckError); // TEMPORARY auth diagnostics
    if (existingUsername) return { ok: false, error: 'username-taken' };

    const displayNameValue = displayName.trim() || normalizedUsername;
    const { data, error } = await client().auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        // Carried on the auth user itself so the profile can be created on
        // first sign-in when email confirmation is on (see below) — without
        // this the chosen username was simply lost and logIn fell back to
        // the email's local-part.
        data: { username: normalizedUsername, display_name: displayNameValue, ...(locale === 'tr' || locale === 'en' ? { locale } : {}) },
        emailRedirectTo: emailConfirmationRedirectUrl(),
      },
    });
    if (error) {
      reportError(error, { module: 'SupabaseAuthBackend', action: 'signUp' });
      recordAuthDiagnostic('signUp', error); // TEMPORARY auth diagnostics
      return { ok: false, error: mapAuthError(error, 'signUp') };
    }
    if (!data.user) {
      recordAuthDiagnostic('signUp', new Error('signUp returned no user and no error')); // TEMPORARY auth diagnostics
      return { ok: false, error: 'unknown' };
    }

    // With email confirmation on, Supabase answers a sign-up for an
    // already-registered email with an obfuscated user that has NO
    // identities (and sends no email) instead of an error — its documented
    // anti-enumeration behavior. Keep that property: answer exactly like a
    // fresh sign-up, so this screen can't be used to probe which email
    // addresses have Cellar accounts. The "check your email" screen tells
    // people who already have an account to sign in or reset their
    // password instead.
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { ok: 'pending-confirmation', email: normalizedEmail };
    }

    // The one signal Supabase actually gives for "this project requires
    // email confirmation before a session exists": a user was created but
    // no session came back. In that state the client is still anonymous,
    // so a `profiles` insert would be rejected by RLS (auth.uid() is null —
    // verified against the real migrations: 42501). The profile is created
    // on first sign-in instead, from the metadata stored above.
    if (!data.session) {
      return { ok: 'pending-confirmation', email: normalizedEmail };
    }

    // upsert (onConflict: 'id'), not a bare insert — signUp can legitimately
    // be retried against the same already-created auth user, and this must
    // not throw a duplicate-key error second time around.
    const { error: upsertError } = await client()
      .from('profiles')
      .upsert(
        { id: data.user.id, username: normalizedUsername, display_name: displayNameValue, avatar_color_seed: normalizedUsername },
        { onConflict: 'id' },
      );
    if (upsertError) {
      reportError(upsertError, { module: 'SupabaseAuthBackend', action: 'signUp:profileUpsert' });
      recordAuthDiagnostic('signUp:profileUpsert', upsertError); // TEMPORARY auth diagnostics
      // The auth user and its session exist, but the app will report a
      // failure and stay signed out — never leave a hidden live session
      // behind. The profile is created on the next sign-in instead.
      await signOutLocally();
      // Only a unique violation means the username was taken in a race
      // since the pre-check above; anything else (network, RLS) is not
      // the user's fault and must not be reported as if it were.
      return { ok: false, error: upsertError.code === '23505' ? 'username-taken' : 'network-error' };
    }

    const profile: UserProfile = {
      id: data.user.id,
      username: normalizedUsername,
      displayName: displayNameValue,
      avatarColorSeed: normalizedUsername,
      createdAt: new Date().toISOString(),
    };

    return { ok: true, profile };
  },

  async logIn({ email, password }: LogInInput): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await client().auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      reportError(error, { module: 'SupabaseAuthBackend', action: 'logIn' });
      // TEMPORARY auth diagnostics — booleans only, never the session/user objects.
      recordAuthDiagnostic('logIn', error, `session=${!!data?.session} user=${!!data?.user}`);
      return { ok: false, error: mapAuthError(error, 'logIn') };
    }
    if (!data.user) {
      recordAuthDiagnostic('logIn', new Error('signInWithPassword returned no user'), `session=${!!data.session} user=false`); // TEMPORARY auth diagnostics
      return { ok: false, error: 'unknown' };
    }

    let profile = await fetchProfile(data.user.id);
    if (!profile) {
      // A confirmed, authenticated user with no profile row yet — the
      // normal first sign-in when email confirmation is on (sign-up can't
      // create the row without a session), or defensively if a sign-up's
      // profile write never landed. See createProfileOnFirstSignIn.
      profile = await createProfileOnFirstSignIn(data.user.id, data.user.user_metadata, data.user.email);
    }
    if (!profile) {
      recordAuthDiagnostic('logIn:profile', new Error('profile could not be read or created after sign-in'), `session=${!!data.session} user=true`); // TEMPORARY auth diagnostics
      // signInWithPassword already established a session. The app reports
      // a failure and stays signed out, so drop it — otherwise every later
      // request would silently run as this account while the UI shows a guest.
      await signOutLocally();
      return { ok: false, error: 'unknown' };
    }
    return { ok: true, profile };
  },

  async logOut() {
    // Bounded: the server-side revoke is best-effort, but the local session
    // must be gone when this returns, even offline (see clearStoredSession).
    await withTimeout(
      client()
        // 'local': signing out on this phone must not end the person's
        // sessions on their other devices (supabase-js defaults to global).
        .auth.signOut({ scope: 'local' })
        .catch((e) => reportError(e, { module: 'SupabaseAuthBackend', action: 'logOut' })),
      SIGN_OUT_TIMEOUT_MS,
    );
    await clearStoredSession();
  },

  async updateProfile(userId, patch: ProfilePatch) {
    const update: Record<string, string | null> = {};
    if (patch.displayName !== undefined) update.display_name = patch.displayName;
    if (patch.bio !== undefined) update.bio = patch.bio;
    if (patch.avatarColorSeed !== undefined) update.avatar_color_seed = patch.avatarColorSeed;
    // null clears the photo; the column's CHECK only accepts the owner's own avatars/<id>/avatar URL.
    if (patch.avatarUrl !== undefined) update.avatar_url = patch.avatarUrl;

    const { data, error } = await client().from('profiles').update(update).eq('id', userId).select('*').maybeSingle();
    if (error || !data) {
      // e.g. 42703 (column missing: migration not applied), 23514 (CHECK),
      // or no row returned (RLS) — recorded so the screen can show a reference.
      reportError(error ?? new Error('profile update returned no row'), { module: 'SupabaseAuthBackend', action: 'updateProfile' });
      recordAuthDiagnostic('profileUpdate', error ?? { message: 'no row returned (RLS or missing profile)', code: 'no_row' });
      return undefined;
    }
    return toProfile(data);
  },

  async deleteAccount(userId, options) {
    // Deleting auth.users needs the service-role key, which never ships in
    // the app — the delete-account Edge Function verifies the caller's JWT
    // (a user can only delete themselves), removes their Storage media,
    // revokes Sign in with Apple when an authorization code is supplied,
    // and deletes the auth user (profiles/recipes/likes/follows cascade).
    const body: Record<string, string> = { userId };
    if (options?.appleAuthorizationCode) body.appleAuthorizationCode = options.appleAuthorizationCode;
    const { error } = await client().functions.invoke('delete-account', { body });
    if (error) {
      reportError(error, { module: 'SupabaseAuthBackend', action: 'deleteAccount' });
      recordAuthDiagnostic('deleteAccount', error); // TEMPORARY auth diagnostics
      throw error;
    }
    // The user no longer exists server-side; just drop this device's session.
    await client().auth.signOut({ scope: 'local' }).catch(() => undefined);
  },

  async getSignInProviders() {
    const { data } = await client().auth.getUser();
    const providers = (data.user?.app_metadata as { providers?: unknown } | undefined)?.providers;
    if (Array.isArray(providers)) return providers.filter((p): p is string => typeof p === 'string');
    const single = (data.user?.app_metadata as { provider?: unknown } | undefined)?.provider;
    return typeof single === 'string' ? [single] : [];
  },

  async requestPasswordReset(email): Promise<PasswordResetOutcome> {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await client().auth.resetPasswordForEmail(normalizedEmail, { redirectTo: passwordResetRedirectUrl() });
    if (error) {
      reportError(error, { module: 'SupabaseAuthBackend', action: 'requestPasswordReset' });
      recordAuthDiagnostic('requestPasswordReset', error); // TEMPORARY auth diagnostics
      const mapped = mapAuthError(error, 'logIn');
      // Never surface anything that would let a caller distinguish "no
      // such account" from "sent" — resetPasswordForEmail itself already
      // doesn't reveal that (Supabase's own anti-enumeration behavior);
      // only pass through failures that are about the request itself.
      if (mapped === 'rate-limited' || mapped === 'network-error') return { ok: false, error: mapped };
      return { ok: false, error: 'unknown' };
    }
    return { ok: true };
  },

  async resendConfirmationEmail(email): Promise<PasswordResetOutcome> {
    const normalizedEmail = email.trim().toLowerCase();
    // Same redirect as signUp — without it the resent link lands on the
    // project's Site URL instead of app/auth-callback.tsx.
    const { error } = await client().auth.resend({ type: 'signup', email: normalizedEmail, options: { emailRedirectTo: emailConfirmationRedirectUrl() } });
    if (error) {
      reportError(error, { module: 'SupabaseAuthBackend', action: 'resendConfirmationEmail' });
      recordAuthDiagnostic('resendConfirmationEmail', error); // TEMPORARY auth diagnostics
      const mapped = mapAuthError(error, 'logIn');
      // Rate-limited is the NORMAL answer to a resend within Supabase's
      // per-address window (default 60 s) right after sign-up — the first
      // email was sent. The screen must present that as "already sent",
      // not as a failure.
      if (mapped === 'rate-limited') return { ok: false, error: 'rate-limited' };
      if (mapped === 'network-error') return { ok: false, error: 'network-error' };
      return { ok: false, error: 'unknown' };
    }
    return { ok: true };
  },

  async confirmPasswordResetSession(url) {
    // Supabase's recovery link redirects here (app/reset-password.tsx)
    // carrying access_token/refresh_token — as either a `?query` string or
    // a `#fragment`, depending on flow; getQueryParams handles both, which
    // a plain URL/URLSearchParams parse would not reliably do.
    const { params, errorCode } = QueryParams.getQueryParams(url);
    if (errorCode || !params.access_token || !params.refresh_token) return false;

    const { error } = await client().auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token });
    if (error) {
      reportError(error, { module: 'SupabaseAuthBackend', action: 'confirmPasswordResetSession' });
      recordAuthDiagnostic('confirmPasswordResetSession', error); // TEMPORARY auth diagnostics
      return false;
    }
    return true;
  },

  async updatePassword(newPassword): Promise<PasswordResetOutcome> {
    if (newPassword.length < 6) return { ok: false, error: 'unknown' };
    const { error } = await client().auth.updateUser({ password: newPassword });
    if (error) {
      reportError(error, { module: 'SupabaseAuthBackend', action: 'updatePassword' });
      recordAuthDiagnostic('updatePassword', error); // TEMPORARY auth diagnostics
      const code = ((error as { code?: string }).code ?? '').toLowerCase();
      // "Secure password change" is on and this session is older than
      // Supabase's recent-login window: a fresh sign-in is required.
      if (code === 'reauthentication_needed' || code === 'reauthentication_not_valid') return { ok: false, error: 'reauthentication-needed' };
      if (code === 'same_password') return { ok: false, error: 'same-password' };
      const mapped = mapAuthError(error, 'signUp');
      if (mapped === 'weak-password' || mapped === 'rate-limited' || mapped === 'network-error') return { ok: false, error: mapped };
      return { ok: false, error: 'unknown' };
    }
    return { ok: true };
  },
};

/**
 * Where the sign-up confirmation email's link sends the user back to — see
 * app/auth-callback.tsx, which turns the link's tokens into a session. This
 * URL must be in the Supabase dashboard's Redirect URLs allow-list; if it
 * isn't, Supabase falls back to the Site URL (`cellar://`), which still
 * opens the app (the user then just signs in manually).
 */
function emailConfirmationRedirectUrl(): string {
  return AuthSessionModule.makeRedirectUri({ scheme: 'cellar', path: 'auth-callback' });
}

/** Where Supabase's password-recovery email link must send the user back to — see app/reset-password.tsx, the screen that resolves this route and completes the flow. */
function passwordResetRedirectUrl(): string {
  return AuthSessionModule.makeRedirectUri({ scheme: 'cellar', path: 'reset-password' });
}
