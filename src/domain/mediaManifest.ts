/**
 * The structured record a built-in catalog cocktail's photography must
 * carry before it's ever shown to a user — see src/data/catalog/mediaManifest.ts
 * for the actual (currently all-`missing`) manifest, and MEDIA_PIPELINE.md
 * for why: there is no licensed photo source wired into this project, and
 * this codebase must never hotlink, scrape, or fabricate one. A status can
 * only become 'approved' once every licensing field below is filled in for
 * real — see isMediaEntryValid.
 */
export type MediaLicense = 'CC0' | 'CC-BY' | 'CC-BY-SA' | 'licensed' | 'original' | 'unknown';
export type MediaStatus = 'missing' | 'pending-review' | 'approved';

export interface CocktailMediaEntry {
  cocktailId: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  /** Where this came from, e.g. "commissioned", "staff-photo", "unsplash" — never "unknown internet source". */
  source?: string;
  license?: MediaLicense;
  /** Required whenever `license` demands credit (CC-BY, CC-BY-SA). */
  attribution?: string;
  /** Short display string shown near the image, e.g. "Photo by Jane Doe". */
  credit?: string;
  /** width / height, for layout reservation before the image loads. */
  aspectRatio?: number;
  status: MediaStatus;
}

/**
 * A 'missing' entry is always valid (that's the honest, current state of
 * every built-in cocktail). Anything claiming to be 'pending-review' or
 * 'approved' must carry a real imageUrl, source, and license — this is
 * what stops a future edit from flipping a status flag without actually
 * doing the licensing work.
 */
export function isMediaEntryValid(entry: CocktailMediaEntry): boolean {
  if (entry.status === 'missing') return true;
  if (!entry.imageUrl || !entry.source || !entry.license) return false;
  if ((entry.license === 'CC-BY' || entry.license === 'CC-BY-SA') && !entry.attribution) return false;
  return true;
}
