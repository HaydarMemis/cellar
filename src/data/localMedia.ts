import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { reportError } from '../lib/crashReporting';

/** Longest edge of a stored recipe photo. Enough for a full-width hero on any phone; keeps uploads small (typically 200–600 KB instead of 3–8 MB). */
export const RECIPE_PHOTO_MAX_EDGE = 1600;
export const RECIPE_PHOTO_JPEG_QUALITY = 0.8;
const PHOTO_DIRECTORY_NAME = 'recipe-photos';

function photoDirectory(): Directory {
  return new Directory(Paths.document, PHOTO_DIRECTORY_NAME);
}

/** Resize so the longest edge is at most `maxEdge`, never upscaling. Exported for tests. */
export function targetResize(width: number, height: number, maxEdge = RECIPE_PHOTO_MAX_EDGE): { width?: number; height?: number } | null {
  if (!width || !height || Math.max(width, height) <= maxEdge) return null;
  return width >= height ? { width: maxEdge } : { height: maxEdge };
}

/**
 * Turns a freshly picked photo into the file a recipe stores:
 * 1. resized (longest edge ≤ 1600 px) and re-encoded as JPEG — this also
 *    converts HEIC, which not every viewer can display;
 * 2. copied into the app's DOCUMENTS directory. expo-image-picker returns a
 *    file in the CACHE directory, which the OS may purge at any time — a
 *    recipe pointing there would eventually lose its photo.
 *
 * Never throws: if processing fails, falls back to copying the original, and
 * if even that fails, returns the picked URI so the pick still works now.
 */
export async function prepareRecipePhoto(asset: { uri: string; width?: number; height?: number }): Promise<string> {
  let sourceUri = asset.uri;
  let extension = 'jpg';
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    const resize = targetResize(asset.width ?? 0, asset.height ?? 0);
    if (resize) context.resize(resize);
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: RECIPE_PHOTO_JPEG_QUALITY, format: SaveFormat.JPEG });
    sourceUri = saved.uri;
  } catch (e) {
    reportError(e, { module: 'localMedia', action: 'processPhoto' });
    const original = asset.uri.split('?')[0].split('.').pop()?.toLowerCase();
    extension = original && /^[a-z0-9]{2,5}$/.test(original) ? original : 'jpg';
  }

  try {
    const directory = photoDirectory();
    if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
    const target = new File(directory, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extension}`);
    await new File(sourceUri).copy(target);
    return target.uri;
  } catch (e) {
    reportError(e, { module: 'localMedia', action: 'persistPhoto' });
    return sourceUri;
  }
}

/** Back-compat name used by the recipe editor before processing was added. */
export async function persistPickedPhoto(pickedUri: string): Promise<string> {
  return prepareRecipePhoto({ uri: pickedUri });
}

/** True only for photos this app itself stored in documents/recipe-photos — the only local files it may delete. */
export function isManagedLocalPhoto(uri: string | undefined): uri is string {
  if (!uri || !uri.startsWith('file://')) return false;
  try {
    return uri.startsWith(photoDirectory().uri);
  } catch {
    return false;
  }
}

/** Deletes a managed local photo that no recipe uses any more (replaced photo, deleted recipe). Best-effort, never throws. */
export function deleteManagedLocalPhoto(uri: string | undefined): void {
  if (!isManagedLocalPhoto(uri)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (e) {
    reportError(e, { module: 'localMedia', action: 'deletePhoto' });
  }
}
