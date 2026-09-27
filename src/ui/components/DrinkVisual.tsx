import { Image } from 'expo-image';
import React, { useState } from 'react';
import { getCocktailMedia } from '../../data/catalog/mediaManifest';
import { isMediaEntryValid } from '../../domain/mediaManifest';
import { DrinkSource } from '../../domain/types';
import { SpiritHero } from './SpiritHero';

/**
 * Catalog photography comes ONLY from an approved, fully-licensed manifest
 * entry (src/data/catalog/mediaManifest.ts, see MEDIA_PIPELINE.md). Until an
 * entry is approved, the designed spirit-tone hero is shown.
 */
function catalogPhotoUri(cocktailId: string, legacyImageUrl: string | undefined): string | undefined {
  const entry = getCocktailMedia(cocktailId);
  if (entry && entry.status === 'approved' && isMediaEntryValid(entry) && entry.imageUrl) return entry.imageUrl;
  return legacyImageUrl;
}

export interface DrinkVisualProps {
  source: DrinkSource;
  height: number;
  borderRadius?: number;
}

/**
 * Renders a real photo when one exists (always true for a personal recipe
 * the user attached a photo to), and falls back to the abstract spirit-tone
 * hero for every built-in catalog cocktail, which ships without photography
 * — and for a personal recipe photo that fails to load (moved/corrupt file),
 * so a broken image never renders as a blank/broken box.
 */
export function DrinkVisual({ source, height, borderRadius = 0 }: DrinkVisualProps) {
  // Tracked per URI, so a replaced photo gets a fresh chance to load.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const photoUri = source.kind === 'recipe' ? source.item.photoUri : catalogPhotoUri(source.item.id, source.item.imageUrl);

  if (photoUri && failedUri !== photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={{ height, borderRadius, backgroundColor: '#0000' }}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={photoUri}
        accessibilityIgnoresInvertColors
        onError={() => setFailedUri(photoUri)}
      />
    );
  }

  return <SpiritHero baseSpirit={source.item.baseSpirit} height={height} borderRadius={borderRadius} />;
}
