// Pure helpers for the revenuecat-webhook function (no I/O, no Deno APIs), kept
// separate from index.ts so they can be unit-tested without starting a server.

export const PREMIUM_ENTITLEMENT_ID = 'premium';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Plan = 'monthly' | 'yearly' | 'lifetime';

export interface RevenueCatEvent {
  id?: string;
  type: string;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
  environment?: string | null;
  event_timestamp_ms?: number | null;
}

/** The subset of GET /v1/subscribers/{app_user_id} this function reads. */
export interface RevenueCatSubscriberResponse {
  subscriber?: {
    entitlements?: Record<
      string,
      {
        expires_date?: string | null;
        grace_period_expires_date?: string | null;
        product_identifier?: string | null;
      }
    >;
    subscriptions?: Record<string, { is_sandbox?: boolean } | undefined>;
    non_subscriptions?: Record<string, { is_sandbox?: boolean }[] | undefined>;
  };
}

export function planFromProductId(productId: string | undefined | null): Plan | null {
  if (!productId) return null;
  const id = productId.toLowerCase();
  if (id.includes('lifetime')) return 'lifetime';
  if (id.includes('year') || id.includes('annual')) return 'yearly';
  if (id.includes('month')) return 'monthly';
  return null;
}

/**
 * Every id the event could concern that can be one of OUR accounts: RevenueCat
 * app user ids are the Supabase user id once the app has called
 * Purchases.logIn(userId); anonymous `$RCAnonymousID:…` ids are never UUIDs.
 * A TRANSFER names both sides in transferred_from/transferred_to, and aliases
 * cover the ids merged into the same customer. Order-preserving, de-duplicated
 * (case-insensitively — profile ids are lowercase UUIDs).
 */
export function candidateAppUserIds(event: RevenueCatEvent): string[] {
  const raw: unknown[] = [
    event.app_user_id,
    event.original_app_user_id,
    ...(Array.isArray(event.aliases) ? event.aliases : []),
    ...(Array.isArray(event.transferred_from) ? event.transferred_from : []),
    ...(Array.isArray(event.transferred_to) ? event.transferred_to : []),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function isSandboxProduct(subscriber: NonNullable<RevenueCatSubscriberResponse['subscriber']>, productId: string | null | undefined): boolean {
  if (!productId) return false;
  const subscription = subscriber.subscriptions?.[productId];
  if (subscription) return subscription.is_sandbox === true;
  const purchases = subscriber.non_subscriptions?.[productId];
  if (purchases && purchases.length > 0) return purchases.every((p) => p.is_sandbox === true);
  return false;
}

/**
 * Current premium state from RevenueCat's own view of the customer (not from
 * the event payload, which describes one transaction and can arrive out of
 * order or be superseded).
 * - no `premium` entitlement              -> not premium
 * - expires_date null                      -> lifetime / non-expiring grant, active
 * - expires_date or grace period in future -> active
 * Sandbox purchases are ignored unless allowSandbox (TestFlight/dev testers
 * must not become premium in the production mirror).
 */
export function premiumStateFromSubscriber(
  body: RevenueCatSubscriberResponse,
  nowMs: number,
  allowSandbox: boolean,
): { isPremium: boolean; plan: Plan | null } {
  const subscriber = body.subscriber;
  const entitlement = subscriber?.entitlements?.[PREMIUM_ENTITLEMENT_ID];
  if (!subscriber || !entitlement) return { isPremium: false, plan: null };
  if (!allowSandbox && isSandboxProduct(subscriber, entitlement.product_identifier)) return { isPremium: false, plan: null };

  const expires = entitlement.expires_date;
  const grace = entitlement.grace_period_expires_date;
  const active =
    expires === null ||
    (typeof expires === 'string' && Date.parse(expires) > nowMs) ||
    (typeof grace === 'string' && Date.parse(grace) > nowMs);
  return active ? { isPremium: true, plan: planFromProductId(entitlement.product_identifier) } : { isPremium: false, plan: null };
}

export function environmentOf(event: RevenueCatEvent): 'SANDBOX' | 'PRODUCTION' | null {
  return event.environment === 'SANDBOX' ? 'SANDBOX' : event.environment === 'PRODUCTION' ? 'PRODUCTION' : null;
}

/** When the event happened (ordering key for apply_subscriber_state); falls back to receipt time. */
export function eventTimeIso(event: RevenueCatEvent, nowMs: number): string {
  const ms = event.event_timestamp_ms;
  return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : new Date(nowMs).toISOString();
}
