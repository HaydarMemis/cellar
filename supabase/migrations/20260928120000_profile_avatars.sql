-- Profile photos (avatars).
--
-- Until now avatars were generated colored monograms only
-- (src/ui/components/Avatar.tsx). This adds an OPTIONAL profile photo with
-- exactly the same trust model as recipe media
-- (20260922000400_recipe_media_storage.sql, tightened in
-- 20260927120000_audit_hardening.sql):
--
-- * One object per user, at exactly `<auth.uid()>/avatar` in the public
--   `avatars` bucket — the only shape src/data/supabase/avatarUpload.ts
--   ever writes (a fixed name, so a replacement upserts the same object
--   instead of leaving the old one behind).
-- * Writes (insert / replace / delete) are allowed only for that exact path
--   of the CALLER's own uid, and only while the caller's profile still
--   exists (a deleted account's JWT stays valid for up to an hour).
-- * The bucket is public-read: profiles (display name, bio, username) are
--   already publicly readable, and a profile photo is shown next to them
--   everywhere. There is deliberately NO public SELECT policy — a public
--   bucket serves /object/public/ URLs without one; a SELECT policy would
--   only add listing/enumeration. Listing is limited to the owner's own
--   folder (upsert/remove need SELECT on the row).
-- * profiles.avatar_url may only be null or the public URL of the owner's
--   OWN avatar object (optionally with the ?v=<epoch ms> cache-buster that
--   withVersion() appends) — never an external URL (tracking pixel) or
--   another user's photo.
-- * The delete-account Edge Function removes the object before deleting the
--   auth user (Storage does not cascade with the database).

-- ---------------------------------------------------------------------------
-- 1. profiles.avatar_url
-- ---------------------------------------------------------------------------
-- Same approach as public.recipe_media_url_ok.
--
-- NOTE: the host pattern only matches hosted Supabase project URLs
-- (<20-char ref>.supabase.co). Serving Storage from a CUSTOM DOMAIN (or
-- uploading against a local `supabase start` stack at
-- http://127.0.0.1:54321) requires updating this function in a new migration.
create or replace function public.profile_avatar_url_ok(url text, profile_id uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select url ~ (
    '^https://[a-z0-9]{20}\.supabase\.co/storage/v1/object/public/avatars/'
    || profile_id::text || '/avatar(\?v=[0-9]+)?$'
  );
$$;

-- A brand-new nullable column has no existing rows to violate the check, so
-- (unlike the constraints added to populated columns in earlier migrations)
-- it is added VALIDATED.
alter table public.profiles
  add column if not exists avatar_url text
    constraint profiles_avatar_url_own_object check (avatar_url is null or public.profile_avatar_url_ok(avatar_url, id));

-- ---------------------------------------------------------------------------
-- 2. Storage bucket
-- ---------------------------------------------------------------------------
-- The app always uploads the re-encoded JPEG produced by
-- src/data/localMedia.ts (prepareAvatarPhoto: longest edge 512 px, JPEG
-- 0.8 — typically 30–120 KB). PNG/WebP are allowed for forward
-- compatibility; HEIC and video are not.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 3. storage.objects policies for the avatars bucket
-- ---------------------------------------------------------------------------
create policy "a user can list only their own avatar"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "a user can upload only their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '/avatar'
    and exists (select 1 from public.profiles p where p.id = auth.uid())
  );

create policy "a user can replace only their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '/avatar')
  with check (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '/avatar'
    and exists (select 1 from public.profiles p where p.id = auth.uid())
  );

create policy "a user can delete only their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '/avatar'
    and exists (select 1 from public.profiles p where p.id = auth.uid())
  );
