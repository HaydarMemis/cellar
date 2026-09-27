import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Cocktail } from '../../domain/types';
import { DiscoveryCollection } from '../../domain/discovery';
import { getCollectionDescription, getCollectionTitle, isCuratedCollection } from '../../i18n/collectionLabels';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../theme/useTheme';
import { HorizontalDrinkRow } from './HorizontalDrinkRow';
import { Text } from './Text';

export interface DiscoveryCollectionRowProps {
  collection: DiscoveryCollection;
  cocktails: Cocktail[];
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
}

/** A titled, described horizontal row of cocktails for one Search collection, with a "See all" into its full Collection screen. */
export function DiscoveryCollectionRow({ collection, cocktails, isFavorite, onToggleFavorite }: DiscoveryCollectionRowProps) {
  const theme = useTheme();
  const router = useRouter();
  const { t, tVocab } = useTranslation();

  const title = getCollectionTitle(collection, t, tVocab);
  const description = getCollectionDescription(collection, t, tVocab);
  const openCollection = () => router.push({ pathname: '/collection/[id]', params: { id: collection.id } });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable onPress={openCollection} style={styles.titleWrap} accessibilityRole="button">
          <View style={styles.titleLine}>
            <Text variant="headline">{title}</Text>
            {isCuratedCollection(collection) && (
              <View style={[styles.badge, { backgroundColor: theme.colors.accentSoft }]}>
                <Text variant="label" color="accent">
                  {t('collections.curatedBadge')}
                </Text>
              </View>
            )}
          </View>
          {description ? (
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {description}
            </Text>
          ) : null}
        </Pressable>
        <Pressable onPress={openCollection} hitSlop={8} accessibilityRole="button">
          <Text variant="captionStrong" color="accent">
            {t('search.seeAll')}
          </Text>
        </Pressable>
      </View>
      <HorizontalDrinkRow
        items={cocktails.slice(0, 10)}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        onPress={(id) => router.push({ pathname: '/cocktail/[id]', params: { id, type: 'cocktail' } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 12,
  },
  titleWrap: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
