import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DrinkSource } from '../../domain/types';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../theme/useTheme';
import { DrinkVisual } from './DrinkVisual';
import { FavoriteButton } from './FavoriteButton';
import { Text } from './Text';

export interface DrinkCardProps {
  source: DrinkSource;
  onPress: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  width?: number;
}

export function DrinkCard({ source, onPress, isFavorite, onToggleFavorite, width }: DrinkCardProps) {
  const theme = useTheme();
  const { t, tVocab } = useTranslation();
  const item = source.item;
  const subtitle = [tVocab(`difficulty.${item.difficulty}`), t('common.min', { count: item.prepTimeMinutes })].join(
    ' · ',
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      style={({ pressed }) => [styles.card, width ? { width } : undefined, { opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={styles.heroWrap}>
        <DrinkVisual source={source} height={140} borderRadius={theme.radii.md} />
        <View style={styles.favoriteOverlay}>
          <FavoriteButton isFavorite={isFavorite} onToggle={onToggleFavorite} onLightSurface={false} size={19} />
        </View>
      </View>
      <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
        {item.name}
      </Text>
      <Text variant="caption" color="secondary" numberOfLines={1}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6 },
  heroWrap: { position: 'relative' },
  favoriteOverlay: { position: 'absolute', top: 6, right: 6 },
  name: { marginTop: 2 },
});
