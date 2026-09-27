// Supabase Edge Function — RevenueCat entitlement webhook.
//
// Deploy with the Supabase CLI: `supabase functions deploy revenuecat-webhook`
// (requires a Supabase project linked via `supabase link`).
//
// External setup this needs (see LAUNCH_READINESS.md for the full list):
//  1. Set two Edge Function secrets (`supabase secrets set ...`, NOT env
//     vars in the client — these must never reach the mobile app bundle):
//       REVENUECAT_WEBHOOK_AUTH_HEADER  — any strong random string you
//         generate yourself, used only to verify a request genuinely came
//         from RevenueCat.
//       (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are already available
//       to every Edge Function automatically — no need to set them.)
//  2. In the RevenueCat dashboard: Project settings -> Integrations ->
//     Webhooks -> add this function's URL
//     (https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook),
//     and set its "Authorization header" field to the exact same string
//     as REVENUECAT_WEBHOOK_AUTH_HEADER above.
//  3. The client must call Purchases.logIn(supabaseUserId) at some point
//     (see src/data/purchases/RevenueCatPurchaseService.ts's
//     identifyRevenueCatUser, wired into src/state/authStore.ts) — a
//     webhook event's app_user_id only maps to a real profiles.id if the
//     client identified itself that way at least once.
//
// What this function does NOT do: gate the client's own UI. The
// RevenueCat SDK running on-device (via getCustomerInfo/checking
// entitlements.active) remains the source of truth for what the app
// shows right now — this webhook maintains a SERVER-SIDE mirror
// (public.subscribers) for everything that isn't the purchasing device
// itself. It is deliberately tolerant: an event it can't confidently
// attribute to a real account is logged and acknowledged with 200 rather
// than causing RevenueCat to retry it forever (RevenueCat retries any
// non-200 response up to 5 times over several hours).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Event types where, if the entitlement is present, the user should be
// considered premium. EXPIRATION is handled separately (always -> false).
// CANCELLATION and BILLING_ISSUE are deliberately treated as "still
// premium" here: cancelling auto-renew (or a billing hiccup with Apple/
// Google's grace period) does not mean access ends immediately — only an
// actual EXPIRATION event means that.
const PREMIUM_ENTITLEMENT_ID = 'premium';

/** Constant-time string comparison for the shared webhook secret. */
function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

function planFromProductId(productId: string | undefined | null): 'monthly' | 'yearly' | 'lifetime' | null {
  if (!productId) return null;
  const id = productId.toLowerCase();
  if (id.includes('lifetime')) return 'lifetime';
  if (id.includes('year') || id.includes('annual')) return 'yearly';
  if (id.includes('month')) return 'monthly';
  return null;
}

interface RevenueCatEvent {
  type: string;
  app_user_id?: string;
  product_id?: string;
  entitlement_ids?: string[];
  environment?: string;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  transferred_from?: string[];
  transferred_to?: string[];
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

  let body: { event?: RevenueCatEvent };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Malformed JSON body' }, 400);
  }

  const event = body.event;
  if (!event || typeof event.type !== 'string') {
    return jsonResponse({ error: 'Missing event.type' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const eventAt = typeof event.event_timestamp_ms === 'number' ? new Date(event.event_timestamp_ms).toISOString() : new Date().toISOString();

  // TRANSFER: the purchase moved to another app user (e.g. restored on a
  // different account). The previous owners lose the mirrored entitlement;
  // the new owner's state arrives with its own subsequent events.
  if (event.type === 'TRANSFER') {
    const from = (event.transferred_from ?? []).filter((id) => UUID_PATTERN.test(id));
    for (const userId of from) {
      await adminClient
        .from('subscribers')
        .update({ is_premium: false, active_plan: null, last_event_type: event.type, last_event_at: eventAt, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    }
    return jsonResponse({ ok: true, transferred: from.length }, 200);
  }

  const appUserId = event.app_user_id;
  if (!appUserId || !UUID_PATTERN.test(appUserId)) {
    // An anonymous RevenueCat id (pre-login) or a malformed id — nothing
    // to attribute this to. Acknowledge so RevenueCat doesn't retry.
    console.log(`revenuecat-webhook: ignoring event for non-UUID app_user_id (${event.type})`);
    return jsonResponse({ ok: true, skipped: 'non-uuid app_user_id' }, 200);
  }

  const hasPremiumEntitlement = (event.entitlement_ids ?? []).includes(PREMIUM_ENTITLEMENT_ID);
  const isExpiration = event.type === 'EXPIRATION';
  const expirationMs = event.expiration_at_ms ?? null;
  const isPastExpiration = typeof expirationMs === 'number' && expirationMs <= Date.now();

  const isPremium = !isExpiration && !isPastExpiration && hasPremiumEntitlement;

  // The subscriber's profile might not exist yet (rare race) — acknowledge
  // instead of letting the foreign key fail and RevenueCat retry forever.
  const { data: profile } = await adminClient.from('profiles').select('id').eq('id', appUserId).maybeSingle();
  if (!profile) {
    console.log(`revenuecat-webhook: no profile for ${appUserId} yet, skipping (${event.type})`);
    return jsonResponse({ ok: true, skipped: 'no matching profile' }, 200);
  }

  // RevenueCat can deliver events out of order (retries); never let an older
  // event overwrite a newer state.
  const { data: existing } = await adminClient.from('subscribers').select('last_event_at').eq('user_id', appUserId).maybeSingle();
  if (existing?.last_event_at && new Date(existing.last_event_at).getTime() > new Date(eventAt).getTime()) {
    return jsonResponse({ ok: true, skipped: 'stale event' }, 200);
  }

  const { error } = await adminClient.from('subscribers').upsert({
    user_id: appUserId,
    is_premium: isPremium,
    active_plan: isPremium ? planFromProductId(event.product_id) : null,
    revenuecat_environment: event.environment === 'SANDBOX' ? 'SANDBOX' : event.environment === 'PRODUCTION' ? 'PRODUCTION' : null,
    last_event_type: event.type,
    last_event_at: eventAt,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('revenuecat-webhook: upsert failed', error.message);
    return jsonResponse({ error: 'upsert failed' }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
