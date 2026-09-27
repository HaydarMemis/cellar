-- Cellar — initial schema (baseline)
--
-- This is the original supabase/schema.sql, moved here verbatim as the
-- first real migration so the schema becomes reproducible from a clean
-- database via `supabase db push` / `supabase migration up`, per the
-- production backend hardening audit. Nothing in this file is rewritten —
-- see later migrations in this directory for every subsequent change,
-- each with its own reasoning. supabase/schema.sql itself is now a
-- generated, human-readable "current state" reference; migrations are the
-- source of truth.
--
-- Design notes:
-- * auth.users (Supabase-managed) is the source of truth for accounts —
--   there is no separate password table; Supabase Auth handles hashing,
--   sessions, and (once configured in the dashboard) Apple/Google OAuth.
-- * `profiles` is a public-readable 1:1 extension of auth.users (display
--   name, username, bio, avatar seed) — auth.users itself is never
--   directly readable from the client.
-- * `recipes` mirrors the local PersonalRecipe shape closely enough to
--   round-trip, but only PUBLISHED (visibility = 'public') recipes ever
--   sync here — private recipes stay device-local, by design (see
--   src/domain/types.ts PersonalRecipe and the account-deletion flow).
-- * RLS (Row Level Security) is enabled on every table. Nothing is
--   readable/writable by default; each policy below opens exactly one
--   specific operation for exactly one specific actor.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
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
  on public.profiles for select
  using (true);

create policy "a user can insert only their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "a user can update only their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Deleting a profile row is handled by ON DELETE CASCADE from auth.users;
-- account deletion itself happens via a Supabase Edge Function or the
-- Admin API (service-role key), never directly from the client — see
-- "Account deletion" in the launch tracker.

-- ---------------------------------------------------------------------------
-- recipes (public recipes only — private recipes never leave the device)
-- ---------------------------------------------------------------------------
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

create policy "public recipes are readable by anyone"
  on public.recipes for select
  using (true); -- only ever-published rows are written here at all — see app-layer note above

create policy "an owner can insert their own recipes"
  on public.recipes for insert
  with check (auth.uid() = owner_id);

create policy "an owner can update only their own recipes"
  on public.recipes for update
  using (auth.uid() = owner_id);

create policy "an owner can delete only their own recipes"
  on public.recipes for delete
  using (auth.uid() = owner_id);

create index if not exists recipes_owner_id_idx on public.recipes(owner_id);
create index if not exists recipes_created_at_idx on public.recipes(created_at desc);

-- ---------------------------------------------------------------------------
-- likes
-- ---------------------------------------------------------------------------
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

alter table public.likes enable row level security;

create policy "likes are publicly readable (for counts)"
  on public.likes for select
  using (true);

create policy "a user can like as only themselves"
  on public.likes for insert
  with check (auth.uid() = user_id);

create policy "a user can remove only their own like"
  on public.likes for delete
  using (auth.uid() = user_id);

create index if not exists likes_recipe_id_idx on public.likes(recipe_id);

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------
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
  on public.follows for select
  using (true);

create policy "a user can follow as only themselves"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "a user can unfollow as only themselves"
  on public.follows for delete
  using (auth.uid() = follower_id);

create index if not exists follows_follower_id_idx on public.follows(follower_id);
create index if not exists follows_following_id_idx on public.follows(following_id);

-- ---------------------------------------------------------------------------
-- reports (user-generated-content moderation — see src/data/community/ModerationBackend.ts)
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('recipe', 'user')),
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

-- Reports are intentionally NOT publicly readable — only the reporter can
-- see their own submitted reports; moderation review happens via the
-- Supabase dashboard (service-role) or a future admin tool, not the client.
create policy "a user can read only their own submitted reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

create policy "a user can file a report as only themselves"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- blocks (client-side content filtering — hides a blocked user's recipes
-- from the blocker's own feed; does not affect what others see)
-- ---------------------------------------------------------------------------
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
  on public.blocks for select
  using (auth.uid() = blocker_id);

create policy "a user can block as only themselves"
  on public.blocks for insert
  with check (auth.uid() = blocker_id);

create policy "a user can unblock as only themselves"
  on public.blocks for delete
  using (auth.uid() = blocker_id);
