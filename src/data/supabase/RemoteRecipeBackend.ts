import { PersonalRecipe } from '../../domain/types';
import { reportError } from '../../lib/crashReporting';
import { supabase } from './client';
import { isUuid, remoteRecipeId } from '../../domain/uuid';
import { isRecipeMediaUrlFor, isRemoteMediaUrl, removeRecipeMedia, removeRecipeMediaKind, uploadRecipeMedia } from './mediaUpload';

export interface RemoteRecipePage {
  recipes: PersonalRecipe[];
  /**
   * Pass back as `cursor` to fetch the next page; null means this was the
   * last page. Keyset-based on the composite (created_at, id) — see
   * encodeCursor — so it stays correct as new recipes are published between
   * page loads AND never skips/duplicates two rows that share a created_at
   * at a page boundary (the single-column cursor this replaced used a
   * strict `created_at < cursor`, which silently dropped such rows; that gap
   * was documented as "fix before wiring this in", and it had been wired in).
   */
  nextCursor: string | null;
}

/**
 * Publishes/fetches PUBLIC recipes against Supabase with real keyset
 * pagination. Wired into the app via src/data/community/index.ts
 * (`remoteRecipeBackend`): recipesStore publishes/unpublishes through it,
 * discoverFeedStore reads the community feed from it, and the recipe
 * detail / creator screens resolve other people's recipes through it.
 *
 * Every read THROWS on a backend error rather than returning an empty
 * page: an empty community and a failed request are different states the
 * UI has to be able to tell apart (Discover shows a retry for the latter).
 */
export interface PublishResult {
  /** Public URL of the recipe photo after publishing (null if none). */
  photoUrl: string | null;
}

export interface RemoteRecipeBackend {
  publishRecipe(recipe: PersonalRecipe): Promise<PublishResult>;
  /** Accepts either a local or a remote recipe id — see remoteRecipeId(). */
  unpublishRecipe(recipeId: string): Promise<void>;
  fetchPublicRecipesPage(cursor: string | null, limit: number): Promise<RemoteRecipePage>;
  fetchRecipesByOwner(ownerId: string, cursor: string | null, limit: number): Promise<RemoteRecipePage>;
  /** Resolves one published recipe by its remote id; undefined if it doesn't exist (or was unpublished). */
  fetchRecipeById(recipeId: string): Promise<PersonalRecipe | undefined>;
}

const CURSOR_SEPARATOR = '|';

/** Opaque to callers. `created_at` comes back from PostgREST as an ISO string with microseconds, which round-trips exactly as a string. */
export function encodeCursor(recipe: Pick<PersonalRecipe, 'createdAt' | 'id'>): string {
  return `${recipe.createdAt}${CURSOR_SEPARATOR}${recipe.id}`;
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  const index = cursor.lastIndexOf(CURSOR_SEPARATOR);
  if (index <= 0) return null;
  const createdAt = cursor.slice(0, index);
  const id = cursor.slice(index + 1);
  if (!isUuid(id) || Number.isNaN(Date.parse(createdAt))) return null;
  return { createdAt, id };
}

/** PostgREST `or=` filter for "strictly after this row" in (created_at desc, id desc) order. Values are double-quoted so the timestamp's `:`/`.`/`+` can't be misparsed. */
export function afterCursorFilter(cursor: { createdAt: string; id: string }): string {
  const ts = `"${cursor.createdAt}"`;
  return `created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${cursor.id})`;
}

/** The DB constrains prep_time_minutes to an integer in 1..240 (migration 20260922000100); the editor accepts free-form decimals, so normalize rather than have Postgres reject the whole publish (22P02 / 23514). */
export function normalizePrepTime(minutes: number): number {
  if (!Number.isFinite(minutes)) return 5;
  return Math.min(240, Math.max(1, Math.round(minutes)));
}

function client() {
  if (!supabase) throw new Error('supabaseRemoteRecipeBackend used without a configured Supabase client');
  return supabase;
}

interface RecipeRow {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  base_spirit: string;
  category: string[];
  tags: string[];
  ingredients: PersonalRecipe['ingredients'];
  method: PersonalRecipe['method'];
  steps: string[];
  glass: PersonalRecipe['glass'];
  garnish: string | null;
  abv_approx: number | null;
  difficulty: PersonalRecipe['difficulty'];
  prep_time_minutes: number;
  photo_url: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
}

function toPersonalRecipe(row: RecipeRow): PersonalRecipe {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    baseSpirit: row.base_spirit,
    category: row.category,
    tags: row.tags,
    ingredients: row.ingredients,
    method: row.method,
    steps: row.steps,
    glass: row.glass,
    garnish: row.garnish ?? undefined,
    abv: row.abv_approx !== null ? { approx: row.abv_approx } : null,
    difficulty: row.difficulty,
    prepTimeMinutes: row.prep_time_minutes,
    photoUri: row.photo_url ?? undefined,
    videoUri: row.video_url ?? undefined,
    visibility: 'public',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchPage(ownerId: string | null, cursor: string | null, limit: number, action: string): Promise<RemoteRecipePage> {
  let query = client().from('recipes').select('*');
  if (ownerId) query = query.eq('owner_id', ownerId);
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) return { recipes: [], nextCursor: null };
    // `created_at <= cursor` is implied by the or() below (so results are
    // identical), but Postgres can't derive an index range from an OR — the
    // extra bound turns a scan-from-the-newest-row-and-filter (cost grows
    // with page depth) into an index range scan on (created_at desc, id desc).
    query = query.lte('created_at', decoded.createdAt).or(afterCursorFilter(decoded));
  }
  const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
  if (error) {
    reportError(error, { module: 'RemoteRecipeBackend', action });
    throw error;
  }
  const recipes = (data ?? []).map(toPersonalRecipe);
  const last = recipes[recipes.length - 1];
  return { recipes, nextCursor: recipes.length === limit && last ? encodeCursor(last) : null };
}

/**
 * The last upload can be reused only while it still describes this photo
 * AND lives under this owner's/recipe's storage path. After an unpublish
 * (which deletes the object) or an owner change (account deletion,
 * local-data adoption) the remembered URL points at a deleted object or at
 * someone else's folder — reusing it would publish a dead link, so upload
 * again instead.
 */
function canReusePublishedPhoto(recipe: PersonalRecipe, remoteId: string): boolean {
  const published = recipe.publishedPhoto;
  return !!published && published.localUri === recipe.photoUri && isRecipeMediaUrlFor(published.url, recipe.ownerId, remoteId, 'photo');
}

export const supabaseRemoteRecipeBackend: RemoteRecipeBackend = {
  async publishRecipe(recipe) {
    const id = remoteRecipeId(recipe.id);
    // A recipe's photoUri/videoUri is a *local device* URI until it's been
    // uploaded — never write that into photo_url/video_url. Anything that is
    // already a remote URL is reused as-is. Storage paths are keyed by the
    // REMOTE id so they line up with the row (and with delete-account's
    // `<owner>/<recipe>/<kind>` cleanup).
    const photoUrl = recipe.photoUri
      ? isRemoteMediaUrl(recipe.photoUri)
        ? recipe.photoUri
        : canReusePublishedPhoto(recipe, id)
          ? recipe.publishedPhoto!.url // unchanged since the last upload
          : await uploadRecipeMedia(recipe.ownerId, id, recipe.photoUri, 'photo')
      : null;
    const videoUrl = recipe.videoUri
      ? isRemoteMediaUrl(recipe.videoUri)
        ? recipe.videoUri
        : await uploadRecipeMedia(recipe.ownerId, id, recipe.videoUri, 'video')
      : null;

    const { error, status } = await client()
      .from('recipes')
      .upsert({
        id,
        owner_id: recipe.ownerId,
        name: recipe.name,
        description: recipe.description,
        base_spirit: recipe.baseSpirit,
        category: recipe.category,
        tags: recipe.tags,
        ingredients: recipe.ingredients,
        method: recipe.method,
        steps: recipe.steps,
        glass: recipe.glass,
        garnish: recipe.garnish ?? null,
        abv_approx: recipe.abv?.approx ?? null,
        difficulty: recipe.difficulty,
        prep_time_minutes: normalizePrepTime(recipe.prepTimeMinutes),
        photo_url: photoUrl,
        video_url: videoUrl,
        updated_at: new Date().toISOString(),
      });
    if (error) {
      reportError(error, { module: 'RemoteRecipeBackend', action: 'publishRecipe', recipeId: id });
      // Keep the HTTP status with the error so classifySyncError can tell a
      // rejected request (4xx) from a transient failure.
      throw Object.assign(error, { status });
    }

    // The author removed a photo/video from an already-published recipe:
    // the row no longer references it, but the public object would stay
    // reachable at its old URL forever. Best-effort — the publish itself
    // already succeeded.
    if (!photoUrl) await removeRecipeMediaKind(recipe.ownerId, id, 'photo').catch(() => undefined);
    if (!videoUrl) await removeRecipeMediaKind(recipe.ownerId, id, 'video').catch(() => undefined);
    return { photoUrl };
  },

  async unpublishRecipe(recipeId) {
    const id = remoteRecipeId(recipeId);
    const { data: row } = await client().from('recipes').select('owner_id').eq('id', id).maybeSingle();
    const { error } = await client().from('recipes').delete().eq('id', id);
    if (error) {
      reportError(error, { module: 'RemoteRecipeBackend', action: 'unpublishRecipe', recipeId: id });
      throw error;
    }
    // Best-effort: the row is already gone either way, so a cleanup
    // failure must not surface as an unpublish failure. Storage RLS still
    // requires the owner's own auth to ever touch these objects again.
    if (row?.owner_id) await removeRecipeMedia(row.owner_id, id).catch(() => undefined);
  },

  async fetchPublicRecipesPage(cursor, limit) {
    return fetchPage(null, cursor, limit, 'fetchPublicRecipesPage');
  },

  async fetchRecipesByOwner(ownerId, cursor, limit) {
    return fetchPage(ownerId, cursor, limit, 'fetchRecipesByOwner');
  },

  async fetchRecipeById(recipeId) {
    if (!isUuid(recipeId)) return undefined; // can't be a remote row; also avoids a guaranteed 22P02
    const { data, error } = await client().from('recipes').select('*').eq('id', recipeId).maybeSingle();
    if (error) {
      reportError(error, { module: 'RemoteRecipeBackend', action: 'fetchRecipeById', recipeId });
      throw error;
    }
    return data ? toPersonalRecipe(data as RecipeRow) : undefined;
  },
};
