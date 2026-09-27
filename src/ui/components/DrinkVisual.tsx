import { Image } from 'expo-image';
import React, { useState } from 'react';
import { DrinkSource } from '../../domain/types';
import { drinkPhotoUri } from './DrinkVisualSources';
import { SpiritHero } from './SpiritHero';

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
  const photoUri = drinkPhotoUri(source);

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
