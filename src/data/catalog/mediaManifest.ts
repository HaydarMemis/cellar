import { CocktailMediaEntry } from '../../domain/mediaManifest';
import { cocktails } from './cocktails/index';

/**
 * Per-cocktail overrides, keyed by cocktail id — populate an entry here
 * once real, licensed photography exists for that cocktail (see
 * MEDIA_PIPELINE.md for the required fields and review process). Empty
 * today: MEDIA DATASET REQUIRED — this project has no licensed cocktail
 * photography source connected, and per this codebase's standing rule,
 * never hotlinks or scrapes images to fill the gap. Every cocktail below
 * therefore reports status: 'missing' until a real entry is added here.
 */
const overrides: Record<string, Partial<CocktailMediaEntry>> = {};

/** Derived from the live catalog (not hand-maintained) so it can never drift out of sync as cocktails are added, renamed, or removed. */
export const cocktailMediaManifest: CocktailMediaEntry[] = cocktails.map((cocktail) => ({
  cocktailId: cocktail.id,
  status: 'missing',
  ...overrides[cocktail.id],
}));

export const cocktailMediaByCocktailId: ReadonlyMap<string, CocktailMediaEntry> = new Map(
  cocktailMediaManifest.map((entry) => [entry.cocktailId, entry]),
);

export function getCocktailMedia(cocktailId: string): CocktailMediaEntry | undefined {
  return cocktailMediaByCocktailId.get(cocktailId);
}
