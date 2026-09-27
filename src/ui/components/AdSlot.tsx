import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AdCreative, AdPlacement, adProvider } from '../../data/ads';
import { useEntitlementStore } from '../../state/entitlementStore';
import { useTheme } from '../../theme/useTheme';
import { Text } from './Text';

export interface AdSlotProps {
  placement: AdPlacement;
}

/**
 * Renders nothing for Premium users, and nothing at all when no ad network
 * is connected (the current state — see src/data/ads/NoOpAdProvider.ts) so
 * this never ships as an ugly empty placeholder box. Wiring a real ad
 * network in only requires implementing AdProvider; this component doesn't
 * change.
 */
export function AdSlot({ placement }: AdSlotProps) {
  const theme = useTheme();
  const isPremium = useEntitlementStore((s) => s.isPremium);
  const [ad, setAd] = useState<AdCreative | null>(null);

  useEffect(() => {
    // Premium users never see an ad — the render guard below already covers
    // that, so there's nothing to fetch (and nothing to reset synchronously
    // here; letting stale `ad` state sit unused is harmless since it's
    // simply never rendered).
    if (isPremium) return;

    let cancelled = false;
    adProvider.getAd(placement).then((result) => {
      if (!cancelled) setAd(result);
    });
    return () => {
      cancelled = true;
    };
  }, [placement, isPremium]);

  if (isPremium || !ad) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
      <Text variant="caption" color="tertiary">
        {ad.sponsorName}
      </Text>
      <Text variant="bodyStrong" style={{ marginTop: 2 }}>
        {ad.headline}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
});
