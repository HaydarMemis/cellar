// Supabase Edge Function — RevenueCat entitlement webhook.
//
// Deploy with the Supabase CLI: `supabase functions deploy revenuecat-webhook`
// (requires a Supabase project linked via `supabase link`). JWT verification
// is OFF for this function (supabase/config.toml, [functions.revenuecat-webhook]
// verify_jwt = false): RevenueCat does not send a Supabase JWT; requests are
// authenticated with the shared Authorization header below instead.
//
// External setup this needs (see LAUNCH_READINESS.md for the full list):
//  1. Edge Function secrets (`supabase secrets set ...`, NEVER in the client
//     bundle):
//       REVENUECAT_WEBHOOK_AUTH_HEADER — REQUIRED. Any strong random string
//         you generate yourself; the exact value RevenueCat must send in the
//         Authorization header.
//       REVENUECAT_SECRET_API_KEY      — REQUIRED. A RevenueCat *v1 secret*
//         API key (`sk_...`, RevenueCat dashboard -> Project settings -> API
//         keys). Used to read the customer's current entitlements from
//         GET https://api.revenuecat.com/v1/subscribers/{app_user_id}.
//         Without it every event fails with 500 (and is retried).
//       ALLOW_SANDBOX_EVENTS           — optional. Only the exact string
//         'true' makes SANDBOX events (and sandbox purchases) count; leave it
//         unset in production so TestFlight/dev purchases never mark anyone
//         premium in the server mirror.
//       (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided to every Edge
//       Function automatically.)
//  2. RevenueCat dashboard: Project settings -> Integrations -> Webhooks ->
//     add https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
//     and set its "Authorization header" field to exactly
//     REVENUECAT_WEBHOOK_AUTH_HEADER.
//  3. The client must call Purchases.logIn(supabaseUserId) (see
//     identifyRevenueCatUser in src/data/purchases/RevenueCatPurchaseService.ts)
//     — only then is a RevenueCat app user id a real profiles.id.
//
// How it works: an event is only a TRIGGER. The payload describes a single
// transaction, can arrive late, twice, or out of order, and a TRANSFER moves
// a purchase between customers — so the function never derives state from
// it. Instead, for every account the event could concern (app_user_id,
// original_app_user_id, aliases, transferred_from, transferred_to — UUIDs
// with a profile only), it fetches the customer's CURRENT entitlements from
// RevenueCat and writes them via public.apply_subscriber_state(), which
// upserts atomically and ignores anything older than the last applied event
// (event_timestamp_ms).
//
// Acknowledgement rules (RevenueCat retries any non-2xx response):
// - 200 only when the event was fully applied, or deliberately skipped
//   (SANDBOX without ALLOW_SANDBOX_EVENTS, no UUID ids, no matching profile —
//   none of which a retry would change).
// - 500/503 on ANY database or RevenueCat failure (and on missing
//   configuration), so the event is retried instead of silently lost.
//
// This does NOT gate the client's own UI: the RevenueCat SDK on-device stays
// the source of truth there. public.subscribers is a server-side mirror for
// everything that isn't the purchasing device itself.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import {
  candidateAppUserIds,
  environmentOf,
  eventTimeIso,
  premiumStateFromSubscriber,
  type RevenueCatEvent,
  type RevenueCatSubscriberResponse,
} from './state.ts';

const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';
const REVENUECAT_TIMEOUT_MS = 10_000;

/** Constant-time string comparison for the shared webhook secret. */
function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

class UpstreamError extends Error {
  status: 500 | 503;
  constructor(message: string, status: 500 | 503) {
    super(message);
    this.status = status;
  }
}

async function fetchRevenueCatSubscriber(appUserId: string, secretKey: string): Promise<RevenueCatSubscriberResponse> {
  let res: Response;
  try {
    res = await fetch(`${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(REVENUECAT_TIMEOUT_MS),
    });
  } catch (e) {
    throw new UpstreamError(`RevenueCat request failed: ${e instanceof Error ? e.message : String(e)}`, 503);
  }
  if (!res.ok) {
    await res.body?.cancel();
    // 401/403: wrong/revoked key — a configuration problem, still retried.
    throw new UpstreamError(`RevenueCat GET subscriber returned ${res.status}`, res.status === 401 || res.status === 403 ? 500 : 503);
  }
  try {
    return (await res.json()) as RevenueCatSubscriberResponse;
  } catch {
    throw new UpstreamError('RevenueCat returned a non-JSON body', 503);
  }
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const expectedAuth = Deno.env.get('REVENUECAT_WEBHOOK_AUTH_HEADER');
  if (!expectedAuth) {
    console.error('revenuecat-webhook: REVENUECAT_WEBHOOK_AUTH_HEADER secret is not set');
    return jsonResponse({ error: 'Webhook not configured' }, 500);
  }
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !timingSafeEqual(authHeader, expectedAuth)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const revenueCatKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!revenueCatKey || !supabaseUrl || !serviceRoleKey) {
    console.error(
      `revenuecat-webhook: missing configuration (${[
        !revenueCatKey && 'REVENUECAT_SECRET_API_KEY',
        !supabaseUrl && 'SUPABASE_URL',
        !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
      ]
        .filter(Boolean)
        .join(', ')}) — returning 500 so RevenueCat retries once it is set`,
    );
    return jsonResponse({ error: 'Webhook not configured' }, 500);
  }

  let body: { event?: RevenueCatEvent };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Malformed JSON body' }, 400);
  }
  const event = body?.event;
  if (!event || typeof event.type !== 'string') {
    return jsonResponse({ error: 'Missing event.type' }, 400);
  }

  const allowSandbox = Deno.env.get('ALLOW_SANDBOX_EVENTS') === 'true';
  if (event.environment === 'SANDBOX' && !allowSandbox) {
    console.log(`revenuecat-webhook: skipping SANDBOX ${event.type} event ${event.id ?? ''}`);
    return jsonResponse({ ok: true, skipped: 'sandbox' }, 200);
  }

  const candidates = candidateAppUserIds(event);
  if (candidates.length === 0) {
    // Only anonymous ($RCAnonymousID) or malformed ids — nothing to attribute.
    console.log(`revenuecat-webhook: no UUID app user ids in ${event.type} event ${event.id ?? ''}, skipping`);
    return jsonResponse({ ok: true, skipped: 'no uuid app user ids' }, 200);
  }

  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: profiles, error: profilesError } = await adminClient.from('profiles').select('id').in('id', candidates);
    if (profilesError) {
      console.error('revenuecat-webhook: profile lookup failed', profilesError.message);
      return jsonResponse({ error: 'Database error' }, 500);
    }
    const profileIds = new Set((profiles ?? []).map((p: { id: string }) => p.id.toLowerCase()));
    const targets = candidates.filter((id) => profileIds.has(id.toLowerCase()));
    if (targets.length === 0) {
      // A profile can be missing only for an account that was deleted (or,
      // very briefly, one still being created); the next event re-syncs.
      console.log(`revenuecat-webhook: no profile for any of ${candidates.length} candidate id(s) in ${event.type} event ${event.id ?? ''}, skipping`);
      return jsonResponse({ ok: true, skipped: 'no matching profile' }, 200);
    }

    const eventAt = eventTimeIso(event, Date.now());
    const results: { userId: string; result: string }[] = [];
    for (const appUserId of targets) {
      const subscriber = await fetchRevenueCatSubscriber(appUserId, revenueCatKey);
      const { isPremium, plan } = premiumStateFromSubscriber(subscriber, Date.now(), allowSandbox);
      const { data: result, error: rpcError } = await adminClient.rpc('apply_subscriber_state', {
        p_user_id: appUserId.toLowerCase(),
        p_is_premium: isPremium,
        p_active_plan: plan,
        p_environment: environmentOf(event),
        p_event_type: event.type,
        p_event_at: eventAt,
      });
      if (rpcError) {
        console.error('revenuecat-webhook: apply_subscriber_state failed', rpcError.code, rpcError.message);
        return jsonResponse({ error: 'Database error' }, 500);
      }
      results.push({ userId: appUserId.toLowerCase(), result: String(result) });
    }

    return jsonResponse({ ok: true, results }, 200);
  } catch (e) {
    if (e instanceof UpstreamError) {
      console.error(`revenuecat-webhook: ${e.message}`);
      return jsonResponse({ error: 'RevenueCat unavailable' }, e.status);
    }
    console.error('revenuecat-webhook: unexpected error', e instanceof Error ? e.message : String(e));
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
