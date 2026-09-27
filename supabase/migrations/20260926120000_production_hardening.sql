-- Cellar — production hardening (release candidate)
--
-- Additive only: no table, column, policy or row is dropped. Every new
-- constraint is added NOT VALID, so it is enforced for every NEW write
-- without failing on (or rewriting) any row that already exists in
-- production. RLS policies are unchanged.

-- ---------------------------------------------------------------------------
-- 1. recipes: server-owned timestamps and an immutable owner
-- ---------------------------------------------------------------------------
-- The client used to be able to send any `created_at`, e.g. a date far in the
-- future to pin its recipe to the top of Discover (the feed is ordered by
-- created_at). Timestamps are now always set by the database, and owner_id
-- can never change after insert (RLS already requires owner_id = auth.uid()
-- on every write; this is defense in depth).
create or replace function public.recipes_set_server_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
  else
    new.created_at := old.created_at;
    new.owner_id := old.owner_id;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists recipes_set_server_fields on public.recipes;
create trigger recipes_set_server_fields
  before insert or update on public.recipes
  for each row execute function public.recipes_set_server_fields();

-- Keyset pagination for Discover / creator pages orders by (created_at, id).
create index if not exists recipes_created_at_id_idx on public.recipes (created_at desc, id desc);
create index if not exists recipes_owner_created_at_idx on public.recipes (owner_id, created_at desc, id desc);

-- Bounded text/array sizes (the app enforces the same limits in its forms).
alter table public.recipes
  add constraint recipes_base_spirit_length check (char_length(base_spirit) between 1 and 64) not valid,
  add constraint recipes_garnish_length check (garnish is null or char_length(garnish) <= 200) not valid,
  add constraint recipes_category_bounded check (coalesce(array_length(category, 1), 0) <= 20) not valid,
  add constraint recipes_tags_bounded check (coalesce(array_length(tags, 1), 0) <= 20) not valid,
  add constraint recipes_glass_bounded check (coalesce(array_length(glass, 1), 0) <= 10) not valid,
  add constraint recipes_abv_range check (abv_approx is null or (abv_approx >= 0 and abv_approx <= 100)) not valid,
  add constraint recipes_photo_url_https check (photo_url is null or photo_url like 'https://%') not valid,
  add constraint recipes_video_url_https check (video_url is null or video_url like 'https://%') not valid;

-- ---------------------------------------------------------------------------
-- 2. profiles: bounded public text
-- ---------------------------------------------------------------------------
alter table public.profiles
  add constraint profiles_display_name_length check (char_length(trim(display_name)) between 1 and 50) not valid,
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 300) not valid,
  add constraint profiles_avatar_seed_length check (char_length(avatar_color_seed) between 1 and 64) not valid;

-- ---------------------------------------------------------------------------
-- 3. reports: known reasons, bounded details, and a moderation index
-- ---------------------------------------------------------------------------
alter table public.reports
  add constraint reports_reason_valid check (reason in ('spam', 'inappropriate', 'harassment', 'copyright', 'other')) not valid,
  add constraint reports_details_length check (details is null or char_length(details) <= 1000) not valid;

create index if not exists reports_status_created_at_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

-- is_blocked_with() looks blocks up in both directions.
create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);

-- ---------------------------------------------------------------------------
-- 4. Like counts aggregated in the database
-- ---------------------------------------------------------------------------
-- The client used to download every like row for the visible recipes and
-- count them itself, which is capped by PostgREST's row limit (1000) and
-- wasteful. SECURITY INVOKER: it reads exactly what the caller could already
-- read (likes are publicly readable for counts), just aggregated.
create or replace function public.recipe_like_counts(recipe_ids uuid[])
returns table (recipe_id uuid, like_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select l.recipe_id, count(*)::bigint
  from public.likes l
  where l.recipe_id = any (recipe_ids)
    and cardinality(recipe_ids) <= 500
  group by l.recipe_id;
$$;

revoke all on function public.recipe_like_counts(uuid[]) from public;
grant execute on function public.recipe_like_counts(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. subscribers: ignore out-of-order RevenueCat webhook deliveries
-- ---------------------------------------------------------------------------
-- RevenueCat retries and can deliver events out of order; the webhook now
-- only applies an event newer than the last one it applied.
alter table public.subscribers add column if not exists last_event_at timestamptz;
