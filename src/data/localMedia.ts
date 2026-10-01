import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { reportError } from '../lib/crashReporting';

/** Longest edge of a stored recipe photo. Enough for a full-width hero on any phone; keeps uploads small (typically 200–600 KB instead of 3–8 MB). */
export const RECIPE_PHOTO_MAX_EDGE = 1600;
export const RECIPE_PHOTO_JPEG_QUALITY = 0.8;
export const PHOTO_DIRECTORY_NAME = 'recipe-photos';

/** File names this module generates: `<base36 time>-<random>.jpg` (older builds also stored the original extension). */
const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function photoDirectory(): Directory {
  return new Directory(Paths.document, PHOTO_DIRECTORY_NAME);
}

/**
 * Thrown when a picked photo could not be resized/re-encoded or saved. The
 * original is deliberately NOT used as a fallback: it may be a full-size
 * HEIC still carrying EXIF/GPS metadata, and it would later be uploaded
 * as-is when the recipe is published (the privacy policy promises photos
 * are resized and re-encoded).
 */
export class PhotoProcessingError extends Error {
  constructor(
    readonly stage: 'process' | 'persist',
    readonly cause: unknown,
  ) {
    super(stage === 'process' ? 'Could not process the selected photo' : 'Could not save the selected photo');
    this.name = 'PhotoProcessingError';
  }
}

/** Resize so the longest edge is at most `maxEdge`, never upscaling. Exported for tests. */
export function targetResize(width: number, height: number, maxEdge = RECIPE_PHOTO_MAX_EDGE): { width?: number; height?: number } | null {
  if (!width || !height || Math.max(width, height) <= maxEdge) return null;
  return width >= height ? { width: maxEdge } : { height: maxEdge };
}

/** The stable, container-independent reference persisted in PersonalRecipe.photoUri for a photo this app stored. */
export function managedPhotoRef(fileName: string): string {
  return `${PHOTO_DIRECTORY_NAME}/${fileName}`;
}

/**
 * If `uri` refers to a photo this app stored in documents/recipe-photos —
 * either the current relative form (`recipe-photos/<name>`) or a legacy
 * absolute `file://…/recipe-photos/<name>` URI, possibly from an app
 * container path that no longer exists (iOS moves the container on some
 * updates and on backup restores) — returns its file name; otherwise null.
 */
export function managedPhotoFileName(uri: string | undefined): string | null {
  if (!uri) return null;
  let path: string;
  if (uri.startsWith(`${PHOTO_DIRECTORY_NAME}/`)) {
    path = uri;
  } else if (uri.startsWith('file://')) {
    path = uri.split('?')[0].split('#')[0];
  } else {
    return null;
  }
  const segments = path.split('/');
  const name = segments.pop() ?? '';
  const parent = segments.pop();
  if (parent !== PHOTO_DIRECTORY_NAME || !SAFE_FILE_NAME.test(name) || name.includes('..')) return null;
  return name;
}

/**
 * The URI to actually render / read / delete for a stored photo reference.
 * A managed photo always resolves under the CURRENT documents directory by
 * file name — so photos saved as absolute URIs by older builds keep working
 * after the container path changes. Anything else (https URLs, content://,
 * unmanaged file URIs) is returned unchanged. Pure string work: no
 * filesystem access, safe to call during render.
 */
export function resolveLocalPhotoUri(uri: string): string;
export function resolveLocalPhotoUri(uri: string | undefined): string | undefined;
export function resolveLocalPhotoUri(uri: string | undefined): string | undefined {
  const name = managedPhotoFileName(uri);
  if (!name) return uri;
  try {
    const directoryUri = photoDirectory().uri;
    if (uri!.startsWith(directoryUri)) return uri;
    return new File(photoDirectory(), name).uri;
  } catch (e) {
    reportError(e, { module: 'localMedia', action: 'resolvePhoto' });
    return uri;
  }
}

/**
 * Resize (longest edge ≤ maxEdge, never upscaling) and re-encode as JPEG —
 * converts HEIC and drops EXIF/GPS metadata. Returns the manipulator's
 * output file (in the cache directory). Throws PhotoProcessingError; the
 * unprocessed original is never returned as a fallback.
 */
async function resizeAndReencode(
  asset: { uri: string; width?: number; height?: number },
  maxEdge: number,
  quality: number,
  action: string,
): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    const resize = targetResize(asset.width ?? 0, asset.height ?? 0, maxEdge);
    if (resize) context.resize(resize);
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    return saved.uri;
  } catch (e) {
    reportError(e, { module: 'localMedia', action });
    throw new PhotoProcessingError('process', e);
  }
}

/** Longest edge of an uploaded profile photo — shown at most ~72 pt (216 px @3x); 512 leaves headroom and keeps uploads ~30–120 KB. */
export const AVATAR_MAX_EDGE = 512;
export const AVATAR_JPEG_QUALITY = 0.8;

/**
 * Turns a freshly picked photo into the file uploaded as the profile photo:
 * resized (longest edge ≤ 512 px) and re-encoded as JPEG (HEIC converted,
 * EXIF/GPS dropped). Not square-cropped — every Avatar renders it with
 * `contentFit="cover"` inside a circle. The result is a temporary cache
 * file: it is uploaded right away and then deleted with
 * discardProcessedAvatar(); nothing is kept in documents (the server copy
 * is the source of truth). Throws PhotoProcessingError — the caller shows
 * an error and never uploads the unprocessed original.
 */
export async function prepareAvatarPhoto(asset: { uri: string; width?: number; height?: number }): Promise<string> {
  return resizeAndReencode(asset, AVATAR_MAX_EDGE, AVATAR_JPEG_QUALITY, 'processAvatar');
}

/** Deletes the temporary file prepareAvatarPhoto produced. Best-effort, never throws. */
export function discardProcessedAvatar(uri: string | undefined): void {
  if (!uri || !uri.startsWith('file://')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // cache files are purged by the OS eventually anyway
  }
}

/**
 * Turns a freshly picked photo into the file a recipe stores:
 * 1. resized (longest edge ≤ 1600 px) and re-encoded as JPEG — this also
 *    converts HEIC and drops EXIF/GPS metadata;
 * 2. copied into the app's DOCUMENTS directory. expo-image-picker returns a
 *    file in the CACHE directory, which the OS may purge at any time — a
 *    recipe pointing there would eventually lose its photo.
 *
 * Returns the stable reference to persist (`recipe-photos/<name>.jpg`) —
 * render it through resolveLocalPhotoUri(). Throws PhotoProcessingError if
 * either step fails; callers show an error and keep the previous photo.
 */
export async function prepareRecipePhoto(asset: { uri: string; width?: number; height?: number }): Promise<string> {
  const processedUri = await resizeAndReencode(asset, RECIPE_PHOTO_MAX_EDGE, RECIPE_PHOTO_JPEG_QUALITY, 'processPhoto');

  try {
    const directory = photoDirectory();
    if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
    const fileName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const processed = new File(processedUri);
    await processed.copy(new File(directory, fileName));
    try {
      if (processed.exists) processed.delete(); // the manipulator's cache output is no longer needed
    } catch {
      // cache files are purged by the OS eventually anyway
    }
    return managedPhotoRef(fileName);
  } catch (e) {
    reportError(e, { module: 'localMedia', action: 'persistPhoto' });
    throw new PhotoProcessingError('persist', e);
  }
}

/** Back-compat name used by the recipe editor before processing was added. */
export async function persistPickedPhoto(pickedUri: string): Promise<string> {
  return prepareRecipePhoto({ uri: pickedUri });
}

/** True only for photos this app itself stored in documents/recipe-photos (relative or legacy absolute form) — the only local files it may delete. */
export function isManagedLocalPhoto(uri: string | undefined): uri is string {
  return managedPhotoFileName(uri) !== null;
}

/** Deletes a managed local photo that no recipe uses any more (replaced photo, deleted recipe, abandoned pick). Best-effort, never throws. */
export function deleteManagedLocalPhoto(uri: string | undefined): void {
  if (!isManagedLocalPhoto(uri)) return;
  try {
    const file = new File(resolveLocalPhotoUri(uri));
    if (file.exists) file.delete();
  } catch (e) {
    reportError(e, { module: 'localMedia', action: 'deletePhoto' });
  }
}
