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
// This function verifies the caller's own JWT (so a user can only ever
// delete their own account, never someone else's), then uses the
// service-role client to actually remove the auth user — `profiles`,
// `recipes`, `likes`, and `follows` rows all cascade-delete automatically
// per the ON DELETE CASCADE foreign keys in supabase/schema.sql (`reports`
// is the one deliberate exception — see
// supabase/migrations/20260922000300_reports_retention_and_dedupe.sql —
// filed reports survive as moderation evidence, un-attributed).
//
// Storage does NOT cascade with the database — a `recipe-media` object is
// just a file under `<owner_id>/...`, with no foreign key tying it to the
// `recipes` row that referenced it. Deleting the auth user (and its
// recipes) alone leaves those files behind forever. Found live: a QA
// account with an uploaded recipe photo still had that object in Storage
// after deletion. Fixed by listing and removing everything under the
// user's own uid prefix BEFORE deleting the user — every upload in this
// bucket already lives under `<owner_id>/<recipe_id>/<kind>` (enforced by
// the bucket's own RLS, see supabase/migrations/20260922000400_recipe_media_storage.sql),
// so this one list+remove catches every recipe's media for this user in
// one pass, not just the recipes this function otherwise knows about.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Verify the caller's identity using their own token against the anon client.
  const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Invalid session' }, 401);
  }

  if (userId !== userData.user.id) {
    return jsonResponse({ error: 'You can only delete your own account' }, 403);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Best-effort and never blocks deletion; the outcome is returned so the
  // result is observable. (Only the code's owner can have obtained it.)
  let appleRevocation: 'revoked' | 'not-configured' | 'failed' | 'not-requested' = 'not-requested';
  if (typeof appleAuthorizationCode === 'string' && appleAuthorizationCode.length > 0 && appleAuthorizationCode.length < 2048) {
    appleRevocation = await revokeAppleGrant(appleAuthorizationCode);
  }

  // Best-effort, and deliberately BEFORE the user is deleted: if this
  // fails, the account deletion itself must still proceed (a stuck account
  // is worse than a few orphaned files) — logged, never thrown.
  try {
    await removeAllRecipeMediaForOwner(adminClient, userId);
  } catch (e) {
    console.error('delete-account: recipe-media cleanup failed (continuing with account deletion)', e);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    // "User not found" here almost always means a double-call (e.g. a
    // retried request after the first one actually succeeded) — the end
    // state the caller wanted (this account gone) already holds, so treat
    // it as success rather than a scary error.
    if (deleteError.message.toLowerCase().includes('not found') || deleteError.message.toLowerCase().includes('not exist')) {
      return jsonResponse({ ok: true, alreadyDeleted: true, appleRevocation }, 200);
    }
    console.error('delete-account: auth user deletion failed', deleteError.message);
    return jsonResponse({ error: 'Account deletion failed' }, 500);
  }

  return jsonResponse({ ok: true, appleRevocation }, 200);
});
