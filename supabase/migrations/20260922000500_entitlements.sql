-- Server-side entitlement mirror, fed by the RevenueCat webhook.
--
-- Until now there was no backend record of Premium status at all — the
-- RevenueCat SDK running on-device was the only source of truth, checked
-- live via getCustomerInfo(). That's fine for gating UI on the device
-- itself, but it means no other backend logic (a future admin view, a
-- server-side feature gate, analytics) can ever know who's premium, and
-- there's no audit trail of entitlement changes. This table is that
-- mirror — written ONLY by the `revenuecat-webhook` Edge Function via the
-- service-role key (see supabase/functions/revenuecat-webhook), never by
-- the client. RLS below is deliberately read-only for ordinary users:
-- there is no insert/update/delete policy for the `authenticated` role at
-- all, which — combined with RLS's default-deny — makes "can the client
-- modify its own premium status" categorically impossible, not just
-- discouraged.
--
-- This does NOT replace the RevenueCat SDK as the client's source of
-- truth for gating UI (see src/data/purchases/RevenueCatPurchaseService.ts)
-- — it's a server-side mirror for everything that isn't the purchasing
-- device itself.

create table if not exists public.subscribers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_premium boolean not null default false,
  active_plan text check (active_plan in ('monthly', 'yearly', 'lifetime') or active_plan is null),
  revenuecat_environment text check (revenuecat_environment in ('SANDBOX', 'PRODUCTION') or revenuecat_environment is null),
  last_event_type text,
  updated_at timestamptz not null default now()
);

alter table public.subscribers enable row level security;

create policy "a user can read only their own subscriber record"
  on public.subscribers for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy for `authenticated` or `anon` — writes
-- only ever happen via the service-role key inside the webhook Edge
-- Function, which bypasses RLS entirely by design (that's what
-- service-role means). This is intentional, not an oversight.
