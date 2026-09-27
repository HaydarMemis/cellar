import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SearchSpiritId } from '../../domain/searchSpirits';
import { getSearchSpiritTone } from '../../theme/searchSpiritPalette';
import { Text } from './Text';

export interface SpiritTileProps {
  spiritId: SearchSpiritId;
  label: string;
  onPress: () => void;
  size?: number;
}

/**
 * A colored discovery tile for one spirit — reuses the catalog's own
 * abstract duotone visual identity (see spiritPalette.ts) rather than a
 * plain gray filter chip, so browsing by spirit feels like a real
 * discovery surface rather than a database filter list.
 */
export function SpiritTile({ spiritId, label, onPress, size = 108 }: SpiritTileProps) {
  const tone = getSearchSpiritTone(spiritId);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <LinearGradient
        colors={[tone.from, tone.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.tile, { width: size, height: size }]}
      >
        <Text style={[styles.label, { color: tone.ink }]} numberOfLines={2}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: 16, padding: 12, justifyContent: 'flex-end' },
  label: { fontSize: 15, fontWeight: '700' },
});
