import { AuthError } from '@supabase/supabase-js';
import * as AuthSessionModule from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { AuthSession, UserProfile } from '../../domain/types';
import { reportError } from '../../lib/crashReporting';
import { AuthBackend, AuthErrorCode, AuthResult, LogInInput, PasswordResetOutcome, ProfilePatch, SignUpInput, SignUpOutcome } from '../community/AuthBackend';
import { supabase } from './client';

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

function toProfile(row: { id: string; username: string; display_name: string; bio: string | null; avatar_color_seed: string; created_at: string }): UserProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio ?? undefined,
    avatarColorSeed: row.avatar_color_seed,
    createdAt: row.created_at,
  };
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

export const supabaseAuthBackend: AuthBackend = {
  async getSession(): Promise<AuthSession | null> {
    const { data } = await client().auth.getSession();
    if (!data.session) return null;
    return { userId: data.session.user.id, createdAt: new Date(data.session.user.created_at).toISOString() };
  },

  onSessionEnded(listener) {
    const { data } = client().auth.onAuthStateChange((event) => {
      // Deferred: supabase-js holds an internal lock while dispatching
      // auth events, and the listener goes on to touch app state.
      if (event === 'SIGNED_OUT') setTimeout(listener, 0);
    });
    return () => data.subscription.unsubscribe();
  },

  async ensureProfileForCurrentSession() {
    const { data, error } = await client().auth.getUser();
    if (error || !data.user) return undefined;
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

  async signUp({ username, displayName, email, password }: SignUpInput): Promise<SignUpOutcome> {
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
    const { data: existingUsername } = await client().from('profiles').select('id').eq('username', normalizedUsername).maybeSingle();
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
        data: { username: normalizedUsername, display_name: displayNameValue },
        emailRedirectTo: emailConfirmationRedirectUrl(),
      },
    });
    if (error) {
      reportError(error, { module: 'SupabaseAuthBackend', action: 'signUp' });
      return { ok: false, error: mapAuthError(error, 'signUp') };
    }
    if (!data.user) return { ok: false, error: 'unknown' };

    // With email confirmation on, Supabase answers a sign-up for an
    // already-registered email with a user object that has NO identities
    // (and sends no email) instead of an error — its documented
    // anti-enumeration behavior. Treat that as the duplicate it is rather
    // than telling the person to go check an inbox that will stay empty.
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { ok: false, error: 'email-taken' };
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
      return { ok: false, error: mapAuthError(error, 'logIn') };
    }
    if (!data.user) return { ok: false, error: 'unknown' };

    let profile = await fetchProfile(data.user.id);
    if (!profile) {
      // A confirmed, authenticated user with no profile row yet — the
      // normal first sign-in when email confirmation is on (sign-up can't
      // create the row without a session), or defensively if a sign-up's
      // profile write never landed. See createProfileOnFirstSignIn.
      profile = await createProfileOnFirstSignIn(data.user.id, data.user.user_metadata, data.user.email);
    }
    if (!profile) return { ok: false, error: 'unknown' };
    return { ok: true, profile };
  },

  async logOut() {
    await client().auth.signOut();
  },

  async updateProfile(userId, patch: ProfilePatch) {
    const update: Record<string, string> = {};
    if (patch.displayName !== undefined) update.display_name = patch.displayName;
    if (patch.bio !== undefined) update.bio = patch.bio;
    if (patch.avatarColorSeed !== undefined) update.avatar_color_seed = patch.avatarColorSeed;

    const { data, error } = await client().from('profiles').update(update).eq('id', userId).select('*').maybeSingle();
    if (error || !data) return undefined;
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
      throw error;
    }
    await client().auth.signOut().catch(() => undefined);
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
    const { error } = await client().auth.resend({ type: 'signup', email: normalizedEmail });
    if (error) {
      reportError(error, { module: 'SupabaseAuthBackend', action: 'resendConfirmationEmail' });
      const mapped = mapAuthError(error, 'logIn');
      if (mapped === 'rate-limited') return { ok: false, error: 'rate-limited' };
      return { ok: false, error: 'network-error' };
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
      return false;
    }
    return true;
  },

  async updatePassword(newPassword): Promise<PasswordResetOutcome> {
    if (newPassword.length < 6) return { ok: false, error: 'unknown' };
    const { error } = await client().auth.updateUser({ password: newPassword });
    if (error) {
      reportError(error, { module: 'SupabaseAuthBackend', action: 'updatePassword' });
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
