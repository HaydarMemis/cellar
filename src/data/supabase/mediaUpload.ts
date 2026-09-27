import { File } from 'expo-file-system';
import { reportError } from '../../lib/crashReporting';
import { supabase } from './client';

export type RecipeMediaKind = 'photo' | 'video';

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

/** Mirrors the `recipe-media` bucket's file_size_limit — see supabase/migrations/20260922000400_recipe_media_storage.sql. Checked client-side too, so a too-large file fails with a clear message instead of a network round-trip to discover the same thing server-side. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export class MediaUploadError extends Error {
  code: 'too-large' | 'unsupported-type' | 'read-failed' | 'upload-failed';
  constructor(message: string, code: MediaUploadError['code']) {
    super(message);
    this.name = 'MediaUploadError';
    this.code = code;
  }
}

function client() {
  if (!supabase) throw new Error('mediaUpload used without a configured Supabase client');
  return supabase;
}

/** A local (not-yet-uploaded) media reference is always a device URI scheme (file://, content://, ph://, assets-library://) — a value already synced from the server is always the public http(s) URL that came back from a prior upload. This is how publishRecipe decides whether there's anything to upload at all. */
export function isRemoteMediaUrl(uri: string): boolean {
  return uri.startsWith('https://') || uri.startsWith('http://');
}

function inferContentType(localUri: string, hintedMimeType: string | null | undefined, file: File): string {
  if (hintedMimeType) return hintedMimeType;
  const withoutQuery = localUri.split('?')[0];
  const ext = withoutQuery.split('.').pop()?.toLowerCase();
  if (ext && EXTENSION_MIME_TYPES[ext]) return EXTENSION_MIME_TYPES[ext];
  if (file.type) return file.type;
  return 'application/octet-stream';
}

/**
 * Uploads a personal recipe's local photo/video to the `recipe-media`
 * Supabase Storage bucket and returns its public URL. This is the
 * previously-missing half of publishing: writing a recipe's *local
 * device* file:// URI straight into the `recipes.photo_url`/`video_url`
 * columns (what the code did before this was added) is meaningless on
 * any other device — publishRecipe now calls this first for any
 * not-yet-remote media, see RemoteRecipeBackend.ts.
 *
 * Every upload goes under `<ownerId>/<recipeId>/<kind>` — the storage RLS
 * policies only allow a user to write under their own uid prefix (see the
 * migration above), so passing a mismatched ownerId here fails server-side
 * rather than silently writing into someone else's namespace; this
 * function doesn't need to re-check ownership itself, the database does.
 */
export async function uploadRecipeMedia(
  ownerId: string,
  recipeId: string,
  localUri: string,
  kind: RecipeMediaKind,
  hintedMimeType?: string | null,
): Promise<string> {
  const file = new File(localUri);
  if (!file.exists) throw new MediaUploadError('Local media file no longer exists.', 'read-failed');
  if (file.size > MAX_UPLOAD_BYTES) throw new MediaUploadError('File is too large to upload (25MB max).', 'too-large');

  const contentType = inferContentType(localUri, hintedMimeType, file);
  const expectedPrefix = kind === 'photo' ? 'image/' : 'video/';
  if (!contentType.startsWith(expectedPrefix)) {
    throw new MediaUploadError(`Unsupported ${kind} type: ${contentType}`, 'unsupported-type');
  }

  let bytes: Uint8Array;
  try {
    bytes = await file.bytes();
  } catch {
    throw new MediaUploadError('Could not read the local media file.', 'read-failed');
  }

  // Fixed filename per kind (no extension) so re-uploading a replacement
  // — even in a different format than the original — genuinely upserts
  // the same object instead of leaving the old one orphaned alongside it.
  const path = `${ownerId}/${recipeId}/${kind}`;

  const { error } = await client().storage.from('recipe-media').upload(path, bytes, { contentType, upsert: true });
  if (error) {
    // Unlike the validation errors above (bad file, too large — expected
    // failures from user input), a storage upload failing is worth
    // logging for diagnosis: it could be a real backend/network/RLS
    // misconfiguration issue rather than anything the user did wrong.
    reportError(error, { module: 'mediaUpload', action: 'uploadRecipeMedia', ownerId, recipeId, kind });
    throw new MediaUploadError(error.message, 'upload-failed');
  }

  const { data } = client().storage.from('recipe-media').getPublicUrl(path);
  return withVersion(data.publicUrl, Date.now());
}

/**
 * The object path is fixed per kind (see above), so a replaced photo would
 * otherwise keep the exact same public URL — and both Supabase's CDN and
 * expo-image cache by URL, so viewers would keep seeing the OLD photo. A
 * version query parameter makes each upload a distinct URL; Storage
 * ignores it when serving the object.
 */
export function withVersion(publicUrl: string, version: number): string {
  const separator = publicUrl.includes('?') ? '&' : '?';
  return `${publicUrl}${separator}v=${version}`;
}

/** Removes one kind (photo/video) of a recipe's uploaded media — used when the author removes it from a still-published recipe. A no-op if nothing was uploaded. */
export async function removeRecipeMediaKind(ownerId: string, recipeId: string, kind: RecipeMediaKind): Promise<void> {
  const prefix = `${ownerId}/${recipeId}`;
  const { data: files } = await client().storage.from('recipe-media').list(prefix);
  if (!files?.some((f) => f.name === kind)) return;
  const { error } = await client().storage.from('recipe-media').remove([`${prefix}/${kind}`]);
  if (error) reportError(error, { module: 'mediaUpload', action: 'removeRecipeMediaKind', recipeId, kind });
}

/**
 * Removes every uploaded media object for a recipe — called when
 * unpublishing or deleting a published recipe so storage doesn't
 * accumulate orphaned objects nobody references any more. Listing first
 * (rather than guessing `photo`/`video` filenames) means this correctly
 * cleans up regardless of which kinds were actually uploaded, and is a
 * safe no-op if nothing was.
 */
export async function removeRecipeMedia(ownerId: string, recipeId: string): Promise<void> {
  const prefix = `${ownerId}/${recipeId}`;
  const { data: files } = await client().storage.from('recipe-media').list(prefix);
  if (!files || files.length === 0) return;
  await client()
    .storage.from('recipe-media')
    .remove(files.map((f) => `${prefix}/${f.name}`));
}
