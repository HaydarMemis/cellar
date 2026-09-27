-- Recipe media storage bucket + object-level RLS.
--
-- Media upload was previously only half-built: `public.recipes` has
-- `photo_url`/`video_url` columns and the client's publish path sent a
-- value into them, but there was no actual Supabase Storage bucket and no
-- upload code — see src/data/supabase/mediaUpload.ts for the real
-- upload client added alongside this migration, and its doc comment for
-- the specific bug this fixes (a local file:// URI was being written
-- straight into photo_url, which is meaningless on any other device).
--
-- Path convention every upload MUST follow: `<owner_id>/<recipe_id>/<file>`
-- — this is what the RLS policies below key off (the first path segment
-- must equal the uploader's own auth.uid()), so a user can only ever
-- write, overwrite, or delete objects under their own prefix. There is no
-- way to manipulate the path to touch another user's media, because the
-- policy checks the actual authenticated uid against the path segment
-- Postgres parses out of the object name — not anything the client claims.
--
-- The bucket is public-read (recipe media only ever belongs to a
-- published, public recipe — same trust boundary as the `recipes` table
-- itself) but write/update/delete all require ownership.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-media',
  'recipe-media',
  true,
  26214400, -- 25 MB — generous for a phone photo/short clip, bounded against abuse
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "recipe media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'recipe-media');

create policy "a user can upload recipe media only under their own uid prefix"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recipe-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "a user can replace only their own recipe media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "a user can delete only their own recipe media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'recipe-media' and (storage.foldername(name))[1] = auth.uid()::text);
