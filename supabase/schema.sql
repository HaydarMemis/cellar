-- Cellar — consolidated schema snapshot (GENERATED, for human reading only)
--
-- This file is NOT applied directly and is NOT the source of truth —
-- supabase/migrations/*.sql is. This is a single-file, current-state view
-- of what those migrations produce, kept for quick review without reading
-- five files. Run `supabase db push` (or `supabase migration up` against a
-- fresh database) to actually apply the schema; if you ever change the
-- schema, add a new migration file and regenerate this snapshot to match
-- — never hand-edit this file's DDL and expect it to take effect.
--
-- Until EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are set,
-- none of this is required at all — the app runs entirely on its local,
-- on-device dev backend. See .env.example.
--
-- Design notes:
-- * auth.users (Supabase-managed) is the source of truth for accounts —
--   there is no separate password table; Supabase Auth handles hashing,
--   sessions, and (once configured in the dashboard) Apple/Google OAuth.
-- * `profiles` is a public-readable 1:1 extension of auth.users.
-- * `recipes` mirrors the local PersonalRecipe shape closely enough to
--   round-trip, but only PUBLISHED recipes ever sync here — private
--   recipes stay device-local by design. `visibility` is a database-
--   enforced invariant (CHECK = 'public'), not just an app-layer promise.
-- * RLS is enabled on every table. Nothing is readable/writable by
--   default; each policy opens exactly one operation for one actor.
-- * Blocking is enforced at the RLS layer for new likes/follows (a
--   blocked-either-way pair cannot create a new interaction), not just
--   filtered client-side.
-- * `reports.reporter_id` deliberately does NOT cascade-delete — a report
--   survives its reporter deleting their account (retained as moderation
--   evidence, no longer attributable), and a partial unique index throttles
--   duplicate open reports from the same reporter against the same target.
-- * `subscribers` is a server-side entitlement mirror written only by the
--   revenuecat-webhook Edge Function via the service-role key — ordinary
--   users have read-only access to their own row and no write path exists
--   for the `authenticated` role at all.
-- * Recipe media (photos/videos) lives in the `recipe-media` Storage
--   bucket, path-scoped to `<owner_id>/<recipe_id>/...` and enforced by
--   storage.objects RLS keyed on that path prefix.

-- ============================================================================
-- profiles
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null,
  bio text,
  avatar_color_seed text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select using (true);
create policy "a user can insert only their own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "a user can update only their own profile"
  on public.profiles for update using (auth.uid() = id);

-- ============================================================================
-- recipes (public recipes only — private recipes never leave the device)
-- ============================================================================
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  base_spirit text not null,
  category text[] not null default '{}',
  tags text[] not null default '{}',
  ingredients jsonb not null default '[]',
  method text not null,
  steps text[] not null default '{}',
  glass text[] not null default '{}',
  garnish text,
  abv_approx numeric,
  difficulty text not null,
  prep_time_minutes int not null,
  photo_url text,
  video_url text,
  visibility text not null default 'public' check (visibility = 'public'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_name_not_blank check (length(trim(name)) > 0),
  constraint recipes_name_length check (char_length(name) <= 120),
  constraint recipes_description_length check (char_length(description) <= 2000),
  constraint recipes_prep_time_positive check (prep_time_minutes > 0 and prep_time_minutes <= 240),
  constraint recipes_difficulty_valid check (difficulty in ('easy', 'medium', 'hard')),
  constraint recipes_ingredients_nonempty check (jsonb_array_length(ingredients) > 0),
  constraint recipes_ingredients_bounded check (jsonb_array_length(ingredients) <= 40),
  constraint recipes_steps_nonempty check (array_length(steps, 1) > 0),
  constraint recipes_steps_bounded check (array_length(steps, 1) <= 30)
);

alter table public.recipes enable row level security;

create policy "public recipes are readable by anyone"
  on public.recipes for select using (true); -- safe: visibility CHECK guarantees only public rows ever exist
create policy "an owner can insert their own recipes"
  on public.recipes for insert with check (auth.uid() = owner_id);
create policy "an owner can update only their own recipes"
  on public.recipes for update using (auth.uid() = owner_id);
create policy "an owner can delete only their own recipes"
  on public.recipes for delete using (auth.uid() = owner_id);

create index if not exists recipes_owner_id_idx on public.recipes(owner_id);
create index if not exists recipes_created_at_idx on public.recipes(created_at desc);

-- ============================================================================
-- likes
-- ============================================================================
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

alter table public.likes enable row level security;

create policy "likes are publicly readable (for counts)"
  on public.likes for select using (true);
create policy "a user can like as only themselves, unless blocked either way"
  on public.likes for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.recipes r
      join public.blocks b
        on (b.blocker_id = r.owner_id and b.blocked_id = auth.uid())
        or (b.blocker_id = auth.uid() and b.blocked_id = r.owner_id)
      where r.id = recipe_id
    )
  );
create policy "a user can remove only their own like"
  on public.likes for delete using (auth.uid() = user_id);

create index if not exists likes_recipe_id_idx on public.likes(recipe_id);

-- ============================================================================
-- follows
-- ============================================================================
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

create policy "follows are publicly readable (for counts)"
  on public.follows for select using (true);
create policy "a user can follow as only themselves, unless blocked either way"
  on public.follows for insert
  with check (
    auth.uid() = follower_id
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = following_id and b.blocked_id = auth.uid())
         or (b.blocker_id = auth.uid() and b.blocked_id = following_id)
    )
  );
create policy "a user can unfollow as only themselves"
  on public.follows for delete using (auth.uid() = follower_id);

create index if not exists follows_follower_id_idx on public.follows(follower_id);
create index if not exists follows_following_id_idx on public.follows(following_id);

-- ============================================================================
-- reports (moderation — see src/data/community/ModerationBackend.ts)
-- ============================================================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('recipe', 'user')),
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

-- Not publicly readable — only the reporter sees their own submissions;
-- moderation review happens via the dashboard/service-role, not the client.
create policy "a user can read only their own submitted reports"
  on public.reports for select using (auth.uid() = reporter_id);
create policy "a user can file a report as only themselves"
  on public.reports for insert with check (auth.uid() = reporter_id);

-- At most one OPEN report per (reporter, target) — throttles duplicate
-- spam-reporting without preventing a follow-up report once the first is resolved.
create unique index if not exists reports_one_open_per_reporter_target
  on public.reports (reporter_id, target_type, target_id)
  where status = 'open' and reporter_id is not null;

-- ============================================================================
-- blocks (client-side content filtering + server-side interaction blocking)
-- ============================================================================
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

create policy "a user can read only their own block list"
  on public.blocks for select using (auth.uid() = blocker_id);
create policy "a user can block as only themselves"
  on public.blocks for insert with check (auth.uid() = blocker_id);
create policy "a user can unblock as only themselves"
  on public.blocks for delete using (auth.uid() = blocker_id);

-- ============================================================================
-- subscribers (server-side entitlement mirror — written only by the
-- revenuecat-webhook Edge Function via the service-role key)
-- ============================================================================
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
  on public.subscribers for select using (auth.uid() = user_id);
-- No insert/update/delete policy for authenticated/anon — the client can
-- never modify its own entitlement record; only the service-role webhook can.

-- ============================================================================
-- Storage: recipe-media bucket (public read, owner-scoped write)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-media', 'recipe-media', true, 26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "recipe media is publicly readable"
  on storage.objects for select using (bucket_id = 'recipe-media');
create policy "a user can upload recipe media only under their own uid prefix"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "a user can replace only their own recipe media"
  on storage.objects for update to authenticated
  using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "a user can delete only their own recipe media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 20260925120000_fix_block_aware_rls_subquery_blindness.sql and
-- 20260926120000_production_hardening.sql (see those files for rationale)
-- ---------------------------------------------------------------------------

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

create index if not exists recipes_created_at_id_idx on public.recipes (created_at desc, id desc);
create index if not exists recipes_owner_created_at_idx on public.recipes (owner_id, created_at desc, id desc);

alter table public.recipes
  add constraint recipes_base_spirit_length check (char_length(base_spirit) between 1 and 64) not valid,
  add constraint recipes_garnish_length check (garnish is null or char_length(garnish) <= 200) not valid,
  add constraint recipes_category_bounded check (coalesce(array_length(category, 1), 0) <= 20) not valid,
  add constraint recipes_tags_bounded check (coalesce(array_length(tags, 1), 0) <= 20) not valid,
  add constraint recipes_glass_bounded check (coalesce(array_length(glass, 1), 0) <= 10) not valid,
  add constraint recipes_abv_range check (abv_approx is null or (abv_approx >= 0 and abv_approx <= 100)) not valid,
  add constraint recipes_photo_url_https check (photo_url is null or photo_url like 'https://%') not valid,
  add constraint recipes_video_url_https check (video_url is null or video_url like 'https://%') not valid;

alter table public.profiles
  add constraint profiles_display_name_length check (char_length(trim(display_name)) between 1 and 50) not valid,
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 300) not valid,
  add constraint profiles_avatar_seed_length check (char_length(avatar_color_seed) between 1 and 64) not valid;

alter table public.reports
  add constraint reports_reason_valid check (reason in ('spam', 'inappropriate', 'harassment', 'copyright', 'other')) not valid,
  add constraint reports_details_length check (details is null or char_length(details) <= 1000) not valid;

create index if not exists reports_status_created_at_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);

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

alter table public.subscribers add column if not exists last_event_at timestamptz;

create or replace function public.is_blocked_with(other_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = other_user)
       or (b.blocker_id = other_user and b.blocked_id = auth.uid())
  );
$$;

create or replace function public.is_blocked_from_recipe(target_recipe uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.recipes r
    join public.blocks b
      on (b.blocker_id = r.owner_id and b.blocked_id = auth.uid())
      or (b.blocker_id = auth.uid() and b.blocked_id = r.owner_id)
    where r.id = target_recipe
  );
$$;

revoke all on function public.is_blocked_with(uuid) from public;
revoke all on function public.is_blocked_from_recipe(uuid) from public;
grant execute on function public.is_blocked_with(uuid) to authenticated;
grant execute on function public.is_blocked_from_recipe(uuid) to authenticated;


drop policy if exists "a user can like as only themselves, unless blocked either way" on public.likes;

create policy "a user can like as only themselves, unless blocked either way"
  on public.likes for insert
  with check (
    auth.uid() = user_id
    and not public.is_blocked_from_recipe(recipe_id)
  );

drop policy if exists "a user can follow as only themselves, unless blocked either way" on public.follows;

create policy "a user can follow as only themselves, unless blocked either way"
  on public.follows for insert
  with check (
    auth.uid() = follower_id
    and not public.is_blocked_with(following_id)
  );
