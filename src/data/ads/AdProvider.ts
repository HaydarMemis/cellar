export type AdPlacement = 'discoverFeed';

export interface AdCreative {
  id: string;
  headline: string;
  sponsorName: string;
}

/**
 * The seam for a real ad network. `AdSlot` (src/ui/components/AdSlot.tsx)
 * renders nothing when this returns null and nothing at all for Premium
 * users — so with no network connected (the current state, see
 * NoOpAdProvider) the app never shows a placeholder box. Wiring in a real
 * network means implementing this interface and swapping the export in
 * ./index.ts.
 */
export interface AdProvider {
  getAd(placement: AdPlacement): Promise<AdCreative | null>;
}
