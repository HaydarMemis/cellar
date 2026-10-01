import { File } from 'expo-file-system';
import { recordAuthDiagnostic } from '../../lib/authDiagnostics';
import { reportError } from '../../lib/crashReporting';
import { supabase } from './client';
import { withVersion } from './mediaUpload';

/**
 * Profile photo upload — the avatar counterpart of mediaUpload.ts, with the
 * same security model (supabase/migrations/20260928120000_profile_avatars.sql):
 * - exactly one object per user at `<userId>/avatar` in the public `avatars`
 *   bucket; storage RLS only lets the signed-in user write that one path,
 *   and only while their profile exists;
 * - profiles.avatar_url must be that object's public URL (optionally with
 *   the `?v=<ms>` cache-buster), so nothing else can ever be referenced.
 *
 * Only the PROCESSED photo (localMedia.prepareAvatarPhoto: ≤512 px JPEG, no
 * EXIF/GPS) is ever passed in here — never the picker's original.
 */

export const AVATAR_BUCKET = 'avatars';

/** Mirrors the `avatars` bucket's file_size_limit (5 MB). A processed avatar is ~30–120 KB; this only guards against a processing bug. */
export const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024;

/** The only content type the app uploads — prepareAvatarPhoto always re-encodes to JPEG. */
export const AVATAR_CONTENT_TYPE = 'image/jpeg';

/**
 * - offline: no connection / timeout — retryable, the previous photo is kept.
 * - too-large: the file exceeds the bucket limit.
 * - processing-failed: the photo couldn't be resized/re-encoded (or the processed file vanished).
 * - upload-failed: the server rejected or failed the upload / profile update.
 * - not-available: no Supabase backend or not signed in.
 */
export type AvatarErrorCode = 'offline' | 'too-large' | 'processing-failed' | 'upload-failed' | 'not-available';

export class AvatarError extends Error {
  code: AvatarErrorCode;
  /** HTTP status of a failed storage request, when known. */
  status?: number;
  constructor(message: string, code: AvatarErrorCode, status?: number) {
    super(message);
    this.name = 'AvatarError';
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

/** The one object path a user's avatar may have — anything else is rejected by storage RLS. */
export function avatarObjectPath(userId: string): string {
  return `${userId}/avatar`;
}

/** True when `url` is the public URL of exactly this user's avatar object (ignoring the ?v= cache-buster). */
export function isAvatarUrlFor(url: string, userId: string): boolean {
  const path = url.split('?')[0].split('#')[0];
  return path.endsWith(`/${AVATAR_BUCKET}/${avatarObjectPath(userId)}`);
}

interface ErrorLike {
  name?: unknown;
  message?: unknown;
  status?: unknown;
  statusCode?: unknown;
}

function statusOf(e: ErrorLike): number | undefined {
  if (typeof e.status === 'number' && e.status > 0) return e.status;
  if (typeof e.statusCode === 'string' && /^\d{3}$/.test(e.statusCode)) return Number(e.statusCode);
  if (typeof e.statusCode === 'number' && e.statusCode > 0) return e.statusCode;
  return undefined;
}

/** Transport-level failure (offline, DNS, timeout, aborted) — same heuristics as syncErrors.classifySyncError. */
export function isNetworkFailure(error: unknown): boolean {
  const e = (error && typeof error === 'object' ? error : {}) as ErrorLike;
  const name = typeof e.name === 'string' ? e.name : '';
  const message = typeof e.message === 'string' ? e.message : '';
  if (name === 'AuthRetryableFetchError' || name === 'AbortError' || name === 'TimeoutError') return true;
  return /network request failed|failed to fetch|network ?error|timed? ?out|timeout|aborted|offline|internet connection/i.test(message);
}

/** Maps a Storage (or thrown fetch) error to an AvatarError. Exported for tests. */
export function toAvatarError(error: unknown): AvatarError {
  if (error instanceof AvatarError) return error;
  const e = (error && typeof error === 'object' ? error : {}) as ErrorLike;
  const message = typeof e.message === 'string' ? e.message : 'Avatar upload failed';
  const status = statusOf(e);
  if (isNetworkFailure(error)) return new AvatarError(message, 'offline', status);
  if (status === 413 || /maximum allowed size|payload too large|too large/i.test(message)) return new AvatarError(message, 'too-large', status);
  return new AvatarError(message, 'upload-failed', status);
}

/**
 * storage-js errors carry the HTTP status as `statusCode` (string) and the
 * storage API's reason in `error`/`message`; normalize to {status, code, message}
 * for recordAuthDiagnostic. Exported for tests.
 */
export function storageErrorForDiagnostics(error: unknown, status?: number): { name?: string; status?: number; code?: string; message?: string } {
  const e = (error && typeof error === 'object' ? error : {}) as { name?: unknown; message?: unknown; error?: unknown };
  const reason = typeof e.error === 'string' ? e.error : undefined;
  return {
    name: typeof e.name === 'string' ? e.name : undefined,
    status,
    code: reason ? reason.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) : undefined,
    message: typeof e.message === 'string' ? e.message : undefined,
  };
}

/** Profile photos need the real backend (other people must be able to see them); the local dev backend has no shared storage. */
export function isAvatarUploadAvailable(): boolean {
  return supabase !== null && supabase !== undefined;
}

function client() {
  if (!supabase) throw new AvatarError('Profile photos need the Supabase backend', 'not-available');
  return supabase;
}

/**
 * Uploads an already-processed avatar (local file URI) to `avatars/<userId>/avatar`
 * (upsert — a replacement overwrites the same object) and returns its public
 * URL with a `?v=<now>` cache-buster, ready to store in profiles.avatar_url.
 * Throws AvatarError.
 */
export async function uploadAvatar(userId: string, processedUri: string): Promise<string> {
  const storage = client().storage.from(AVATAR_BUCKET);

  let bytes: Uint8Array;
  try {
    const file = new File(processedUri);
    if (!file.exists) throw new Error('processed avatar file is missing');
    if (file.size > MAX_AVATAR_UPLOAD_BYTES) throw new AvatarError('Profile photo is too large (5 MB max).', 'too-large');
    bytes = await file.bytes();
  } catch (e) {
    if (e instanceof AvatarError) throw e;
    throw new AvatarError('Could not read the processed profile photo.', 'processing-failed');
  }

  const path = avatarObjectPath(userId);
  let uploadError: unknown;
  try {
    const { error } = await storage.upload(path, bytes, { contentType: AVATAR_CONTENT_TYPE, upsert: true });
    uploadError = error;
  } catch (e) {
    uploadError = e; // a thrown fetch failure (offline) rather than a returned error
  }
  if (uploadError) {
    const mapped = toAvatarError(uploadError);
    // Storage's own error (statusCode / error / message — e.g. 403 "new row
    // violates row-level security policy", 404 "Bucket not found") becomes
    // the error reference shown on the Edit Profile screen.
    recordAuthDiagnostic('avatarUpload', storageErrorForDiagnostics(uploadError, mapped.status));
    if (mapped.code !== 'offline') reportError(uploadError, { module: 'avatarUpload', action: 'uploadAvatar', status: mapped.status });
    throw mapped;
  }

  const { data } = storage.getPublicUrl(path);
  return withVersion(data.publicUrl, Date.now());
}

/** Deletes the user's avatar object. Idempotent: removing a photo that doesn't exist succeeds. Throws AvatarError. */
export async function removeAvatarObject(userId: string): Promise<void> {
  const storage = client().storage.from(AVATAR_BUCKET);
  let removeError: unknown;
  try {
    const { error } = await storage.remove([avatarObjectPath(userId)]);
    removeError = error;
  } catch (e) {
    removeError = e;
  }
  if (removeError) {
    const mapped = toAvatarError(removeError);
    recordAuthDiagnostic('avatarRemove', storageErrorForDiagnostics(removeError, mapped.status));
    if (mapped.code !== 'offline') reportError(removeError, { module: 'avatarUpload', action: 'removeAvatarObject', status: mapped.status });
    throw mapped;
  }
}
