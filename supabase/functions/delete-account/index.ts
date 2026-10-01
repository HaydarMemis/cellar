// Supabase Edge Function — real account deletion.
//
// Deploy with the Supabase CLI: `supabase functions deploy delete-account`
// (requires a Supabase project linked via `supabase link`).
//
// Why this exists as a server-side function rather than a client call:
// deleting an `auth.users` row requires the Admin API, which requires the
// project's service-role key. That key must NEVER ship inside the mobile
// app bundle (anyone could extract it and delete arbitrary accounts) — it
// only ever lives here, as an Edge Function secret.
//
// Flow (every step is safe to retry — the client simply calls again on any
// non-2xx response, and nothing on the device is touched until a 2xx):
//  1. Caller identity: the Supabase gateway verifies the JWT signature and
//     expiry before this code runs (supabase/config.toml:
//     [functions.delete-account] verify_jwt = true); getUser() then confirms
//     the account still exists and body.userId must equal it — a user can
//     only ever delete themselves.
//  2. Storage cleanup — recipe media and the profile photo (see below). If it FAILS, the function returns
//     500 BEFORE deleting anything else, so a retry can finish the job —
//     once the auth user is gone nobody could ever list/remove those files
//     from the app again.
//  3. Sign in with Apple token revocation (best-effort, see below).
//  4. Delete the auth user — `profiles`, `recipes`, `likes`, `follows`,
//     `blocks`, `subscribers` rows cascade (ON DELETE CASCADE, see
//     supabase/schema.sql); `reports` is the deliberate exception (see
//     supabase/migrations/20260922000300_reports_retention_and_dedupe.sql):
//     filed reports survive as moderation evidence, un-attributed.
//  5. Delete the RevenueCat customer (best-effort, never blocks deletion;
//     skipped when REVENUECAT_SECRET_API_KEY is not set). Purchases stay
//     attached to the store account and can be restored into a new account.
//
// Retry after success: a retried call (e.g. the response of a successful
// deletion was lost) arrives with a JWT that is still validly signed (the
// gateway checked it) but whose user no longer exists, so getUser() fails
// with "user not found". Instead of a 401 the function decodes `sub` from
// that gateway-verified JWT, requires it to equal body.userId, confirms via
// the Admin API that the user really is gone, re-runs the idempotent cleanups
// and answers 200 { ok: true, alreadyDeleted: true } — the state the caller
// asked for already holds.
//
// Secrets (`supabase secrets set …`): SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided automatically. Optional:
// APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY / APPLE_CLIENT_ID (Sign in
// with Apple revocation, see below) and REVENUECAT_SECRET_API_KEY (a
// RevenueCat v1 secret key `sk_...`, the same one revenuecat-webhook needs).
//
// Storage does NOT cascade with the database — a `recipe-media` object is
// just a file under `<owner_id>/...`, with no foreign key tying it to the
// `recipes` row that referenced it. Deleting the auth user (and its
// recipes) alone leaves those files behind forever. Found live: a QA
// account with an uploaded recipe photo still had that object in Storage
// after deletion. Fixed by listing and removing everything under the
// user's own uid prefix BEFORE deleting the user — every upload in this
// bucket already lives under `<owner_id>/<recipe_id>/<kind>` (enforced by
// the bucket's own RLS, see supabase/migrations/20260922000400_recipe_media_storage.sql
// and 20260927120000_audit_hardening.sql), so this one list+remove catches
// every recipe's media for this user in one pass. The optional profile
// photo (`avatars` bucket, `<user_id>/avatar`) is removed the same way,
// with the same fail-before-delete semantics.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every object lives at `<ownerId>/<recipeId>/<kind>` — Storage's `list()`
 * only goes one level per call, so listing `ownerId` returns one
 * pseudo-folder entry per recipe (no `id` on folder entries, only on real
 * objects), and each of those needs its own `list()` call to reach the
 * actual files before they can be removed by full path.
 */
const LIST_PAGE_SIZE = 1000;

/** Storage list() is paginated (default 100 entries) — walk every page. */
async function listAll(
  bucket: ReturnType<SupabaseClient['storage']['from']>,
  prefix: string,
): Promise<{ name: string; id: string | null }[]> {
  const out: { name: string; id: string | null }[] = [];
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await bucket.list(prefix, { limit: LIST_PAGE_SIZE, offset });
    if (error) throw error;
    const page = data ?? [];
    out.push(...page.map((e) => ({ name: e.name, id: (e as { id?: string | null }).id ?? null })));
    if (page.length < LIST_PAGE_SIZE) return out;
  }
}

async function removeAllRecipeMediaForOwner(
  adminClient: SupabaseClient,
  ownerId: string,
): Promise<void> {
  const bucket = adminClient.storage.from('recipe-media');
  const recipeFolders = await listAll(bucket, ownerId);
  const allPaths: string[] = [];
  for (const entry of recipeFolders) {
    if (entry.id) {
      // A file directly under the owner prefix — removed rather than left behind.
      allPaths.push(`${ownerId}/${entry.name}`);
      continue;
    }
    for (const file of await listAll(bucket, `${ownerId}/${entry.name}`)) {
      allPaths.push(`${ownerId}/${entry.name}/${file.name}`);
    }
  }
  // remove() accepts many paths, but keep batches bounded.
  for (let i = 0; i < allPaths.length; i += 500) {
    const { error } = await bucket.remove(allPaths.slice(i, i + 500));
    if (error) throw error;
  }
}

/**
 * The profile photo lives at exactly `<userId>/avatar` in the public
 * `avatars` bucket (supabase/migrations/20260928120000_profile_avatars.sql).
 * The folder is still listed rather than guessing the name, so anything
 * else under the user's prefix (none today) is removed too. A no-op when
 * the user never set a photo.
 */
async function removeAvatarForUser(adminClient: SupabaseClient, userId: string): Promise<void> {
  const bucket = adminClient.storage.from('avatars');
  const paths = (await listAll(bucket, userId)).filter((e) => e.id).map((e) => `${userId}/${e.name}`);
  if (paths.length === 0) return;
  const { error } = await bucket.remove(paths);
  if (error) throw error;
}

/** Every Storage object this user owns (recipe media + profile photo). Throws on any failure. */
async function removeAllStorageForUser(adminClient: SupabaseClient, userId: string): Promise<void> {
  await removeAllRecipeMediaForOwner(adminClient, userId);
  await removeAvatarForUser(adminClient, userId);
}

// ---------------------------------------------------------------------------
// Sign in with Apple token revocation (App Store Review Guideline 5.1.1(v)):
// when an account that uses Sign in with Apple is deleted, the app must
// revoke the user's Apple tokens. The app re-authorizes with Apple right
// before deleting and sends the fresh authorization code; this function
// exchanges it for a refresh token and revokes it.
//
// Secrets (supabase secrets set …): APPLE_TEAM_ID, APPLE_KEY_ID,
// APPLE_PRIVATE_KEY (contents of the .p8 key with "Sign in with Apple"
// enabled), APPLE_CLIENT_ID (the iOS bundle id — native sign-in's audience).
// ---------------------------------------------------------------------------

function base64Url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let binary = '';
  for (const b of raw) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function appleClientSecret(teamId: string, keyId: string, clientId: string, privateKeyPem: string): Promise<string> {
  const pem = privateKeyPem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ iss: teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: clientId }));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${payload}`)));
  return `${header}.${payload}.${base64Url(signature)}`;
}

async function revokeAppleGrant(authorizationCode: string): Promise<'revoked' | 'not-configured' | 'failed'> {
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const clientId = Deno.env.get('APPLE_CLIENT_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
  if (!teamId || !keyId || !clientId || !privateKey) return 'not-configured';
  try {
    const clientSecret = await appleClientSecret(teamId, keyId, clientId, privateKey);
    const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: authorizationCode, grant_type: 'authorization_code' }),
    });
    if (!tokenRes.ok) {
      console.error('delete-account: Apple token exchange failed', tokenRes.status);
      return 'failed';
    }
    const tokens = (await tokenRes.json()) as { refresh_token?: string; access_token?: string };
    const token = tokens.refresh_token ?? tokens.access_token;
    if (!token) return 'failed';
    const revokeRes = await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token,
        token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token',
      }),
    });
    if (!revokeRes.ok) {
      console.error('delete-account: Apple revoke failed', revokeRes.status);
      return 'failed';
    }
    return 'revoked';
  } catch (e) {
    console.error('delete-account: Apple revocation error', e instanceof Error ? e.message : String(e));
    return 'failed';
  }
}

// ---------------------------------------------------------------------------
// RevenueCat customer deletion (best-effort). Removes the customer record
// (and its attribute/purchase history) RevenueCat keeps under this app user
// id. Never blocks account deletion; the outcome is returned and logged.
// ---------------------------------------------------------------------------
async function deleteRevenueCatCustomer(userId: string): Promise<'deleted' | 'not-found' | 'not-configured' | 'failed'> {
  const secretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!secretKey) return 'not-configured';
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    await res.body?.cancel();
    if (res.ok) return 'deleted';
    if (res.status === 404) return 'not-found';
    console.error('delete-account: RevenueCat customer deletion failed (account deletion continues)', res.status);
    return 'failed';
  } catch (e) {
    console.error('delete-account: RevenueCat customer deletion error (account deletion continues)', e instanceof Error ? e.message : String(e));
    return 'failed';
  }
}

/** `Authorization: Bearer <jwt>` -> `<jwt>`. */
function bearerToken(header: string): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Reads `sub` from a JWT payload WITHOUT verifying the signature — only ever
 * used on a token the Supabase gateway has already verified (verify_jwt =
 * true for this function). Returns null for anything malformed.
 */
function unverifiedJwtSub(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0)));
    const payload = JSON.parse(json) as { sub?: unknown };
    return typeof payload.sub === 'string' && UUID_PATTERN.test(payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

/** GoTrue's answer for a validly signed JWT whose user no longer exists (403 user_not_found, "User from sub claim in JWT does not exist"). */
function isUserNotFound(error: { status?: number; code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === 'user_not_found' || error.status === 404) return true;
  return /user.*(not found|does not exist)/i.test(error.message ?? '');
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const authHeader = req.headers.get('Authorization');
  const token = authHeader ? bearerToken(authHeader) : null;
  if (!authHeader || !token) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  // Every field this function trusts is validated before use — the
  // request body in particular used to be parsed with a bare
  // `await req.json()` with no try/catch, so a malformed/missing body
  // threw an unhandled exception out of the handler instead of a clean
  // error response. Caught during the backend hardening audit.
  let userId: unknown;
  let appleAuthorizationCode: unknown;
  try {
    const body = await req.json();
    userId = body?.userId;
    appleAuthorizationCode = body?.appleAuthorizationCode;
  } catch {
    return jsonResponse({ error: 'Malformed JSON body' }, 400);
  }
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) {
    return jsonResponse({ error: 'userId must be a UUID string' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('delete-account: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY not available');
    return jsonResponse({ error: 'Function not configured' }, 500);
  }
  const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
  const adminClient = createClient(supabaseUrl, serviceRoleKey, clientOptions);

  // Verify the caller's identity using their own token against the anon client.
  const callerClient = createClient(supabaseUrl, anonKey, { ...clientOptions, global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await callerClient.auth.getUser(token);

  if (!userData?.user) {
    if (!isUserNotFound(userError)) {
      return jsonResponse({ error: 'Invalid session' }, 401);
    }
    // Retry after a successful deletion (see the header comment). The
    // gateway verified this token; its subject must be the account the
    // caller asked to delete, and that account must really be gone.
    const sub = unverifiedJwtSub(token);
    if (!sub || sub.toLowerCase() !== userId.toLowerCase()) {
      return jsonResponse({ error: 'Invalid session' }, 401);
    }
    const { data: existing, error: lookupError } = await adminClient.auth.admin.getUserById(sub);
    if (existing?.user) {
      // getUser() said "not found" but the account exists — don't guess.
      console.error('delete-account: getUser reported user_not_found for an existing user');
      return jsonResponse({ error: 'Invalid session' }, 401);
    }
    if (lookupError && !isUserNotFound(lookupError)) {
      console.error('delete-account: admin user lookup failed', lookupError.message);
      return jsonResponse({ error: 'Account lookup failed' }, 500);
    }
    // Both cleanups are idempotent; re-running them finishes anything a
    // previous attempt could not.
    try {
      await removeAllStorageForUser(adminClient, sub);
    } catch (e) {
      console.error('delete-account: storage cleanup failed for an already-deleted account', e instanceof Error ? e.message : String(e));
      return jsonResponse({ error: 'Media cleanup failed' }, 500);
    }
    const revenueCatDeletion = await deleteRevenueCatCustomer(sub);
    return jsonResponse({ ok: true, alreadyDeleted: true, revenueCatDeletion }, 200);
  }

  if (userId.toLowerCase() !== userData.user.id.toLowerCase()) {
    return jsonResponse({ error: 'You can only delete your own account' }, 403);
  }
  // The canonical (lowercase) id — storage paths and the RevenueCat app user
  // id are both exactly this string.
  const uid = userData.user.id;

  // Media first, and a hard stop on failure: while the account still exists
  // the client retries and this runs again; after deletion nothing could.
  try {
    await removeAllStorageForUser(adminClient, uid);
  } catch (e) {
    console.error('delete-account: storage cleanup (recipe media / avatar) failed; account NOT deleted (client will retry)', e instanceof Error ? e.message : String(e));
    return jsonResponse({ error: 'Media cleanup failed' }, 500);
  }

  // Best-effort and never blocks deletion; the outcome is returned so the
  // result is observable. (Only the code's owner can have obtained it.)
  let appleRevocation: 'revoked' | 'not-configured' | 'failed' | 'not-requested' = 'not-requested';
  if (typeof appleAuthorizationCode === 'string' && appleAuthorizationCode.length > 0 && appleAuthorizationCode.length < 2048) {
    appleRevocation = await revokeAppleGrant(appleAuthorizationCode);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(uid);
  if (deleteError) {
    // A concurrent request may have deleted it between getUser() and here —
    // the end state the caller wanted holds, so treat it as success.
    if (isUserNotFound(deleteError) || deleteError.message.toLowerCase().includes('not exist')) {
      const revenueCatDeletion = await deleteRevenueCatCustomer(uid);
      return jsonResponse({ ok: true, alreadyDeleted: true, appleRevocation, revenueCatDeletion }, 200);
    }
    console.error('delete-account: auth user deletion failed', deleteError.message);
    return jsonResponse({ error: 'Account deletion failed' }, 500);
  }

  // Only after the account is really gone: a failed auth deletion must not
  // leave a live account whose RevenueCat history was already wiped.
  const revenueCatDeletion = await deleteRevenueCatCustomer(uid);

  return jsonResponse({ ok: true, appleRevocation, revenueCatDeletion }, 200);
});
