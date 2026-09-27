import { isSupabaseConfigured } from '../supabase/client';
import { supabaseAuthBackend } from '../supabase/SupabaseAuthBackend';
import { supabaseCommunityBackend } from '../supabase/SupabaseCommunityBackend';
import { supabaseModerationBackend } from '../supabase/SupabaseModerationBackend';
import { supabaseRemoteRecipeBackend } from '../supabase/RemoteRecipeBackend';
import { supabaseSocialAuthProvider } from '../supabase/SupabaseSocialAuthProvider';
import { localAuthBackend } from './AuthBackend';
import { localCommunityBackend } from './CommunityBackend';
import { localModerationBackend } from './ModerationBackend';
import { notConfiguredSocialAuthProvider } from './SocialAuthProvider';

/**
 * The active backend instances. Every caller (stores, screens) imports from
 * here rather than from a specific implementation directly — this is the
 * ENTIRE integration surface for going from local-only to a real hosted
 * backend: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
 * (see src/data/supabase/client.ts and supabase/schema.sql) and the app
 * switches automatically, with no other code changes. Unset (this
 * project's current, fully-tested state), everything runs on the local,
 * fully offline dev backend.
 */
/**
 * Accounts are real (Supabase) in every release build. The on-device dev
 * backend exists for development/tests only: a release build that somehow
 * lacks the Supabase env vars must not quietly create device-only "accounts"
 * that look real to users — the sign-in screen shows "unavailable" instead.
 */
export const accountsAvailable = isSupabaseConfigured || (typeof __DEV__ !== 'undefined' && __DEV__);

export const authBackend = isSupabaseConfigured ? supabaseAuthBackend : localAuthBackend;
export const communityBackend = isSupabaseConfigured ? supabaseCommunityBackend : localCommunityBackend;
// Apple/Google sign-in fundamentally requires a real identity backend to
// verify the token (see SupabaseSocialAuthProvider's doc comment) — there
// is no honest local equivalent, so this stays "not configured" until
// Supabase is. Once Supabase is configured, "not configured" degrades
// further per-method (see isAvailable) until real Apple Developer / Google
// Cloud Console credentials are also present — never a fake success.
export const socialAuthProvider = isSupabaseConfigured ? supabaseSocialAuthProvider : notConfiguredSocialAuthProvider;
export const moderationBackend = isSupabaseConfigured ? supabaseModerationBackend : localModerationBackend;

/**
 * Publishing a recipe means putting it in front of OTHER people, which has
 * no honest local-only equivalent — so unlike the backends above there is
 * no local fallback here, just `null` when Supabase isn't configured.
 * Callers branch on that explicitly (see recipesStore's syncPublication and
 * discoverFeedStore): with no backend, a "public" recipe stays a local flag
 * and Discover keeps reading the on-device store, exactly as it always has.
 */
export const remoteRecipeBackend = isSupabaseConfigured ? supabaseRemoteRecipeBackend : null;

export * from './AuthBackend';
export * from './CommunityBackend';
export * from './ModerationBackend';
export * from './SocialAuthProvider';
