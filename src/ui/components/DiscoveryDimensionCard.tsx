import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';

export interface DiscoveryDimensionCardProps {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: { from: string; to: string; ink: string };
  onPress: () => void;
}

const CARD_WIDTH = 272;
const CARD_HEIGHT = 168;

/**
 * One of the four large discovery-dimension cards at the top of Search
 * (by spirit / style / taste / method) — a horizontally-swipeable rail of
 * a handful of big, confident cards, not a grid of small tiles. Reuses the
 * app's existing duotone identity (same treatment as SpiritTile/SpiritHero)
 * rather than introducing a new decorative visual language.
 */
export function DiscoveryDimensionCard({ title, subtitle, icon, tone, onPress }: DiscoveryDimensionCardProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`}>
      <LinearGradient
        colors={[tone.from, tone.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={26} color={tone.ink} />
        </View>
        <View>
          <Text style={[styles.title, { color: tone.ink }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: tone.ink }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    padding: 18,
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 3, opacity: 0.82 },
});
