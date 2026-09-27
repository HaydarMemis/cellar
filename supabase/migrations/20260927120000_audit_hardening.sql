-- Cellar — audit hardening (follow-up to 20260926120000_production_hardening)
--
-- Every finding below was reproduced against the migrations with the PGlite
-- harness in supabase/tests/rls-pglite before it was fixed; the same harness
-- now asserts each fix.
--
-- Additive and safe to apply to a live database:
-- * every new CHECK constraint is NOT VALID — enforced for every NEW or
--   UPDATED row, without rejecting (or rewriting) rows that already exist;
-- * no table, column or row is dropped. The only drops are two indexes that
--   are strict prefixes of existing composite indexes (section 9) and
--   storage policies that are recreated in tightened form (section 8).

-- ---------------------------------------------------------------------------
-- 1. recipes: content shape/size validation
-- ---------------------------------------------------------------------------
-- Before this, a client calling the API directly could store: an empty steps
-- array (`array_length('{}', 1)` is NULL, and a NULL CHECK passes), a
-- multi-megabyte method/step/tag, a 2-D array, an unknown glass, or
-- ingredients that are not objects at all — every one of which the app would
-- then try to render on other people's devices.
--
-- The limits mirror the app, and are never tighter than what the recipe
-- editor (app/recipe-editor.tsx, RECIPE_LIMITS) can produce, so a recipe that
-- saves locally can always be published:
-- * method: PreparationMethod in src/domain/types.ts;
-- * glass: GlassType in src/domain/types.ts (the editor sends exactly one);
-- * steps: editor allows 30 steps of 500 chars; the DB allows 30 x 1000;
-- * category / tags: ids from src/domain/filterOptions.ts; <= 20 items of
--   <= 64 chars (the item-count bound already exists since 20260926120000);
-- * ingredients: RecipeIngredient[] in src/domain/types.ts, exactly as
--   RemoteRecipeBackend.publishRecipe sends it (JSON of the local object):
--     { ingredientId: string, amount: { value: number, unit: Unit } | null,
--       note?: string, isOptional: boolean, isGarnish: boolean }
--   Catalog ingredient ids are <= 23 chars (DB allows 100); the editor
--   allows 40 ingredients (DB allows 40). Unknown extra keys are tolerated
--   (forward compatibility); the whole document is bounded to 32 KB.
--
-- If PreparationMethod, GlassType or Unit gains a value in the app, the
-- matching list here must be extended in a new migration FIRST.

create or replace function public.recipe_text_array_ok(arr text[], max_items integer, max_len integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_ndims(arr), 1) = 1
     and cardinality(arr) <= max_items
     and not exists (select 1 from unnest(arr) as e(v) where e.v is null or char_length(e.v) > max_len);
$$;

create or replace function public.recipe_ingredient_ok(e jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(e) is distinct from 'object' then false
    else coalesce(
      jsonb_typeof(e -> 'ingredientId') = 'string'
      and char_length(e ->> 'ingredientId') between 1 and 100
      and (
        coalesce(jsonb_typeof(e -> 'amount'), 'null') = 'null'
        or (
          jsonb_typeof(e -> 'amount') = 'object'
          and jsonb_typeof(e -> 'amount' -> 'value') = 'number'
          and (e -> 'amount' ->> 'unit') in ('ml', 'cl', 'oz', 'dash', 'tsp', 'barspoon', 'piece', 'leaf', 'rinse')
        )
      )
      and (
        coalesce(jsonb_typeof(e -> 'note'), 'null') = 'null'
        or (jsonb_typeof(e -> 'note') = 'string' and char_length(e ->> 'note') <= 500)
      )
      and coalesce(jsonb_typeof(e -> 'isOptional'), 'null') in ('null', 'boolean')
      and coalesce(jsonb_typeof(e -> 'isGarnish'), 'null') in ('null', 'boolean'),
      false)
  end;
$$;

create or replace function public.recipe_ingredients_ok(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(j) is distinct from 'array' then false
    else jsonb_array_length(j) between 1 and 40
     and octet_length(j::text) <= 32768
     and not exists (select 1 from jsonb_array_elements(j) as x(e) where not public.recipe_ingredient_ok(x.e))
  end;
$$;

-- photo_url / video_url must be the public URL of the OWNER's OWN media object
-- for THIS recipe, exactly as src/data/supabase/mediaUpload.ts builds it:
--   getPublicUrl(`${ownerId}/${recipeId}/${kind}`)  ->
--     https://<project-ref>.supabase.co/storage/v1/object/public/recipe-media/<owner_id>/<id>/<kind>
--   withVersion(url, Date.now())                    -> + ?v=<epoch ms>
-- Before this, any https URL was accepted — e.g. an attacker's tracking pixel
-- or another user's media, rendered on every viewer's device.
--
-- NOTE: the host pattern only matches hosted Supabase project URLs
-- (<20-char ref>.supabase.co). Serving Storage from a CUSTOM DOMAIN (or
-- publishing with photos against a local `supabase start` stack at
-- http://127.0.0.1:54321) requires updating this function in a new migration.
create or replace function public.recipe_media_url_ok(url text, owner_id uuid, recipe_id uuid, kind text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select url ~ (
    '^https://[a-z0-9]{20}\.supabase\.co/storage/v1/object/public/recipe-media/'
    || owner_id::text || '/' || recipe_id::text || '/' || kind || '(\?v=[0-9]+)?$'
  );
$$;

alter table public.recipes
  add constraint recipes_method_valid check (method in ('shake', 'stir', 'build', 'blend', 'muddle', 'layer')) not valid,
  add constraint recipes_steps_valid check (cardinality(steps) >= 1 and public.recipe_text_array_ok(steps, 30, 1000)) not valid,
  add constraint recipes_category_items check (public.recipe_text_array_ok(category, 20, 64)) not valid,
  add constraint recipes_tags_items check (public.recipe_text_array_ok(tags, 20, 64)) not valid,
  add constraint recipes_glass_valid check (
    public.recipe_text_array_ok(glass, 10, 32)
    and glass <@ array['rocks', 'coupe', 'martini', 'collins', 'highball', 'copper-mug', 'julep-cup', 'hurricane', 'flute',
                       'wine-glass', 'irish-coffee-glass', 'pint-glass', 'tiki-mug', 'nick-and-nora', 'snifter', 'shot', 'mug', 'other']::text[]
  ) not valid,
  add constraint recipes_ingredients_valid check (public.recipe_ingredients_ok(ingredients)) not valid,
  add constraint recipes_photo_url_own_media check (photo_url is null or public.recipe_media_url_ok(photo_url, owner_id, id, 'photo')) not valid,
  add constraint recipes_video_url_own_media check (video_url is null or public.recipe_media_url_ok(video_url, owner_id, id, 'video')) not valid;

-- ---------------------------------------------------------------------------
-- 2. recipes: the primary key is immutable too
-- ---------------------------------------------------------------------------
-- Same function as 20260926120000, plus `new.id := old.id`: an owner could
-- previously re-key a published recipe (breaking every like, report and link
-- that pointed at it).
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
    new.id := old.id;
    new.created_at := old.created_at;
    new.owner_id := old.owner_id;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Server-owned created_at on likes, follows, blocks and profiles
-- ---------------------------------------------------------------------------
-- Clients could forge created_at (e.g. a profile "created" in 2999 sorts
-- first wherever profiles are ordered by created_at desc).
create or replace function public.set_server_created_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

revoke all on function public.set_server_created_at() from public, anon, authenticated;

create trigger likes_set_server_created_at
  before insert on public.likes
  for each row execute function public.set_server_created_at();
create trigger follows_set_server_created_at
  before insert on public.follows
  for each row execute function public.set_server_created_at();
create trigger blocks_set_server_created_at
  before insert on public.blocks
  for each row execute function public.set_server_created_at();
create trigger profiles_set_server_created_at
  before insert or update on public.profiles
  for each row execute function public.set_server_created_at();

-- ---------------------------------------------------------------------------
-- 4. reports: server-owned status/created_at, target validation, rate limit
-- ---------------------------------------------------------------------------
-- Before this, a reporter could:
-- * insert with status = 'dismissed'/'reviewed' — hiding the report from a
--   moderation queue AND bypassing the one-open-report-per-target index;
-- * backdate created_at;
-- * file unlimited reports against targets that do not exist.
-- Error codes (mapped by src/data/supabase/SupabaseModerationBackend.ts):
--   23503 foreign_key_violation   — the target does not exist (or is yourself)
--   54000 program_limit_exceeded  — more than 20 reports in the last hour
-- SECURITY INVOKER on purpose: recipes/profiles are publicly readable, and
-- the rate-limit count only needs the reporter's own reports, which RLS lets
-- them read (a forged reporter_id is rejected by the insert policy anyway).
create or replace function public.reports_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.status := 'open';
  new.created_at := now();

  if new.target_type = 'recipe' then
    if not exists (select 1 from public.recipes r where r.id = new.target_id) then
      raise exception 'report target not found' using errcode = '23503', hint = 'report_target_not_found';
    end if;
  elsif new.target_type = 'user' then
    if new.target_id = new.reporter_id or not exists (select 1 from public.profiles p where p.id = new.target_id) then
      raise exception 'report target not found' using errcode = '23503', hint = 'report_target_not_found';
    end if;
  end if;

  if new.reporter_id is not null then
    -- Serializes concurrent reports from the same reporter so the count
    -- below cannot be raced past the limit.
    perform pg_advisory_xact_lock(hashtextextended('cellar.reports:' || new.reporter_id::text, 0));
    if (
      select count(*)
      from public.reports r
      where r.reporter_id = new.reporter_id
        and r.created_at > now() - interval '1 hour'
    ) >= 20 then
      raise exception 'report rate limit exceeded' using errcode = '54000', hint = 'report_rate_limited';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.reports_before_insert() from public, anon, authenticated;

create trigger reports_before_insert
  before insert on public.reports
  for each row execute function public.reports_before_insert();

-- ---------------------------------------------------------------------------
-- 5. A block severs existing follows and likes, in both directions
-- ---------------------------------------------------------------------------
-- The block-aware insert policies only stop NEW interactions; an existing
-- follow/like survived the block. SECURITY DEFINER because the blocker's own
-- RLS cannot delete the OTHER user's follow/like rows. It only ever touches
-- rows between the two parties of the block row being inserted (whose
-- blocker_id RLS already pins to auth.uid()), and is not callable directly.
create or replace function public.blocks_sever_relationships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows f
   where (f.follower_id = new.blocker_id and f.following_id = new.blocked_id)
      or (f.follower_id = new.blocked_id and f.following_id = new.blocker_id);

  delete from public.likes l
   using public.recipes r
   where l.recipe_id = r.id
     and ((l.user_id = new.blocked_id and r.owner_id = new.blocker_id)
       or (l.user_id = new.blocker_id and r.owner_id = new.blocked_id));

  return new;
end;
$$;

revoke all on function public.blocks_sever_relationships() from public, anon, authenticated;

create trigger blocks_sever_relationships
  after insert on public.blocks
  for each row execute function public.blocks_sever_relationships();

-- ---------------------------------------------------------------------------
-- 6. SECURITY DEFINER helpers: not executable by anon
-- ---------------------------------------------------------------------------
-- 20260925120000 revoked these from PUBLIC, but Supabase ALSO grants EXECUTE
-- on every new public function to anon/authenticated/service_role
-- explicitly (default privileges), so anon kept it. Only the authenticated
-- insert policies on likes/follows need them.
revoke execute on function public.is_blocked_with(uuid) from anon;
revoke execute on function public.is_blocked_from_recipe(uuid) from anon;

-- ---------------------------------------------------------------------------
-- 7. Server-side subscriber (entitlement) mirror: ordered upsert
-- ---------------------------------------------------------------------------
-- Called only by the revenuecat-webhook Edge Function (service_role). Does the
-- "only if newer" comparison and the write in ONE statement, so two
-- concurrent deliveries can no longer both pass a read-then-write check and
-- apply out of order. Returns:
--   'applied'    — row inserted/updated
--   'stale'      — a newer event was already applied (nothing changed)
--   'no_profile' — no profiles row for this user (nothing changed)
create or replace function public.apply_subscriber_state(
  p_user_id uuid,
  p_is_premium boolean,
  p_active_plan text,
  p_environment text,
  p_event_type text,
  p_event_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_is_premium is null or p_event_at is null then
    raise exception 'apply_subscriber_state: p_user_id, p_is_premium and p_event_at are required' using errcode = '22004';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    return 'no_profile';
  end if;

  insert into public.subscribers as s
    (user_id, is_premium, active_plan, revenuecat_environment, last_event_type, last_event_at, updated_at)
  values
    (p_user_id, p_is_premium, p_active_plan, p_environment, p_event_type, p_event_at, now())
  on conflict (user_id) do update set
    is_premium = excluded.is_premium,
    active_plan = excluded.active_plan,
    revenuecat_environment = excluded.revenuecat_environment,
    last_event_type = excluded.last_event_type,
    last_event_at = excluded.last_event_at,
    updated_at = now()
  where s.last_event_at is null or excluded.last_event_at >= s.last_event_at;

  if found then
    return 'applied';
  end if;
  return 'stale';
end;
$$;

revoke all on function public.apply_subscriber_state(uuid, boolean, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_subscriber_state(uuid, boolean, text, text, text, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Storage: owner-only listing, exact object paths, live profile required
-- ---------------------------------------------------------------------------
-- * The `recipe-media` bucket is PUBLIC (20260922000400), so
--   /storage/v1/object/public/recipe-media/... URLs are served without any
--   SELECT policy. The old "publicly readable" SELECT policy only added the
--   ability for anyone (anon included) to LIST/enumerate every object in the
--   bucket, including media of recipes that were never published. Listing
--   is now limited to the owner's own prefix (mediaUpload.ts lists its own
--   `<owner>/<recipe>` prefix; upsert/remove also need SELECT on the row).
-- * Writes must use exactly `<auth.uid()>/<recipe uuid>/(photo|video)` —
--   the only shape mediaUpload.ts ever writes — instead of anything under
--   the uid prefix, and require the caller's profile to still exist (a
--   deleted account's JWT stays valid for up to an hour).
drop policy if exists "recipe media is publicly readable" on storage.objects;

create policy "a user can list only their own recipe media"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "a user can upload recipe media only under their own uid prefix" on storage.objects;

create policy "a user can upload recipe media only under their own uid prefix"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recipe-media'
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(photo|video)$')
    and exists (select 1 from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "a user can replace only their own recipe media" on storage.objects;

create policy "a user can replace only their own recipe media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'recipe-media'
    and name ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(photo|video)$')
    and exists (select 1 from public.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 9. Redundant indexes
-- ---------------------------------------------------------------------------
-- Both are strict leading prefixes of composites added in 20260926120000:
--   recipes_created_at_idx (created_at desc)  <- recipes_created_at_id_idx (created_at desc, id desc)
--   recipes_owner_id_idx   (owner_id)         <- recipes_owner_created_at_idx (owner_id, created_at desc, id desc)
-- The composites serve every lookup these did (incl. the owner_id FK
-- cascade), so these only cost write amplification.
drop index if exists public.recipes_created_at_idx;
drop index if exists public.recipes_owner_id_idx;
