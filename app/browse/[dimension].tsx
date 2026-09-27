import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cocktails } from '../../src/data/catalog';
import { DiscoveryCollectionGroup, getNonEmptyCollections } from '../../src/domain/discovery';
import { SearchSpiritId } from '../../src/domain/searchSpirits';
import { getCollectionShortLabel, getCollectionTitle } from '../../src/i18n/collectionLabels';
import { useTranslation } from '../../src/i18n/useTranslation';
import { EmptyState } from '../../src/ui/components/EmptyState';
import { Screen } from '../../src/ui/components/Screen';
import { SpiritTile } from '../../src/ui/components/SpiritTile';
import { Text } from '../../src/ui/components/Text';
import { useTheme } from '../../src/theme/useTheme';

const titleKeys: Record<DiscoveryCollectionGroup, 'search.dimensionSpiritTitle' | 'search.dimensionStyleTitle' | 'search.dimensionTasteTitle' | 'search.dimensionMethodTitle' | never> = {
  spirit: 'search.dimensionSpiritTitle',
  style: 'search.dimensionStyleTitle',
  taste: 'search.dimensionTasteTitle',
  method: 'search.dimensionMethodTitle',
  featured: 'search.dimensionSpiritTitle',
};

/**
 * The full browse grid for one of Search's four discovery dimensions
 * (spirit/style/taste/method) — reached by tapping its large card on
 * Search. One shared screen for all four rather than four near-duplicate
 * screens.
 */
export default function BrowseDimensionScreen() {
  const { dimension } = useLocalSearchParams<{ dimension: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, tVocab } = useTranslation();

  const group = (['spirit', 'style', 'taste', 'method'] as const).includes(dimension as never) ? (dimension as DiscoveryCollectionGroup) : 'spirit';

  const entries = useMemo(() => getNonEmptyCollections(group, cocktails), [group]);

  const openCollection = (id: string) => router.push({ pathname: '/collection/[id]', params: { id } });

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text variant="headline">{t(titleKeys[group])}</Text>
        <View style={{ width: 24 }} />
      </View>

      {group === 'spirit' ? (
        <FlatList
          // Defensive, matching the fix in my-bar.tsx/search.tsx: this
          // branch is numColumns={2}, the other branch below has none. Not
          // currently reachable as a live bug (`group` is fixed for a
          // screen instance's lifetime, since it comes from a route param
          // that only changes via a fresh navigation), but a `key` costs
          // nothing and removes the risk if that ever stops being true.
          key="spirit-grid"
          data={entries}
          keyExtractor={(entry) => entry.collection.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.spiritTileWrap}>
              <SpiritTile
                spiritId={item.collection.id.replace('spirit-', '') as SearchSpiritId}
                label={getCollectionShortLabel(item.collection, tVocab)}
                onPress={() => openCollection(item.collection.id)}
                size={168}
              />
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="search" title={t('browse.emptyTitle')} message={t('browse.emptyMessage')} />}
        />
      ) : (
        <FlatList
          key="collection-list"
          data={entries}
          keyExtractor={(entry) => entry.collection.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openCollection(item.collection.id)}
              accessibilityRole="button"
              accessibilityLabel={getCollectionTitle(item.collection, t, tVocab)}
              style={[styles.listRow, { backgroundColor: theme.colors.surfaceAlt }]}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{getCollectionTitle(item.collection, t, tVocab)}</Text>
                <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
                  {t('collections.count', { count: item.cocktails.length })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="search" title={t('browse.emptyTitle')} message={t('browse.emptyMessage')} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  grid: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  row: { gap: 14 },
  spiritTileWrap: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 14 },
});
