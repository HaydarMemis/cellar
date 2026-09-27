import { getCocktailMedia } from '../../data/catalog/mediaManifest';
import { resolveLocalPhotoUri } from '../../data/localMedia';
import { isMediaEntryValid } from '../../domain/mediaManifest';
import { DrinkSource } from '../../domain/types';

/**
 * Catalog photography comes ONLY from an approved, fully-licensed manifest
 * entry (src/data/catalog/mediaManifest.ts, see MEDIA_PIPELINE.md). There is
 * deliberately no fallback to a cocktail's own `imageUrl`: that field has
 * no license/source record attached, so rendering it would bypass the
 * license gate. Until an entry is approved, the designed spirit-tone hero
 * is shown.
 */
export function catalogPhotoUri(cocktailId: string): string | undefined {
  const entry = getCocktailMedia(cocktailId);
  if (entry && entry.status === 'approved' && isMediaEntryValid(entry) && entry.imageUrl) return entry.imageUrl;
  return undefined;
}

/** The URI to render for a drink: a recipe's own photo (a stored local reference is resolved against today's documents directory), or a licensed catalog photo. */
export function drinkPhotoUri(source: DrinkSource): string | undefined {
  return source.kind === 'recipe' ? resolveLocalPhotoUri(source.item.photoUri) : catalogPhotoUri(source.item.id);
}
