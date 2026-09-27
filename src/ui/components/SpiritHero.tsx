import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { getSpiritTone } from '../../theme/spiritPalette';

export interface SpiritHeroProps {
  baseSpirit: string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * The catalog's stand-in for photography: a duotone keyed to the cocktail's
 * spirit group with a single watermark glass mark. See project plan,
 * Audit item 1 / Section 19.
 */
export function SpiritHero({ baseSpirit, height, borderRadius = 0, style }: SpiritHeroProps) {
  const tone = getSpiritTone(baseSpirit);

  return (
    <LinearGradient
      colors={[tone.from, tone.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ height, borderRadius, overflow: 'hidden' }, styles.container, style]}
    >
      <View style={styles.markWrap}>
        <Ionicons name="wine-outline" size={height * 0.62} color={tone.ink} style={{ opacity: 0.16 }} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  markWrap: { alignItems: 'center', justifyContent: 'center' },
});
