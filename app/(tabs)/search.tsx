import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cocktails } from '../../src/data/catalog';
import { getCocktailContent } from '../../src/i18n/cocktailContent';
import { discoveryDimensions, getCollectionCocktails, discoveryCollectionsById } from '../../src/domain/discovery';
import { activeFilterCount, isFilterActive, searchCatalog } from '../../src/domain/search';
import { getIngredientNameVariants, getVocabVariants } from '../../src/i18n/searchResolvers';
import { useTranslation } from '../../src/i18n/useTranslation';
import { DiscoveryCollectionRow } from '../../src/ui/components/DiscoveryCollectionRow';
import { DiscoveryDimensionCard } from '../../src/ui/components/DiscoveryDimensionCard';
import { DrinkCard } from '../../src/ui/components/DrinkCard';
import { EmptyState } from '../../src/ui/components/EmptyState';
import { IngredientsBanner } from '../../src/ui/components/IngredientsBanner';
import { Screen } from '../../src/ui/components/Screen';
import { SearchBar } from '../../src/ui/components/SearchBar';
import { SectionLabel } from '../../src/ui/components/SectionLabel';
import { Text } from '../../src/ui/components/Text';
import { useFavoritesStore } from '../../src/state/favoritesStore';
import { useFilterStore } from '../../src/state/filterStore';
import { useTheme } from '../../src/theme/useTheme';

const dimensionMeta = {
  spirit: {
    titleKey: 'search.dimensionSpiritTitle',
    subtitleKey: 'search.dimensionSpiritSubtitle',
    icon: 'wine-outline',
    tone: { from: '#8A5A2B', to: '#3F1E19', ink: '#FBF1E4' },
  },
  style: {
    titleKey: 'search.dimensionStyleTitle',
    subtitleKey: 'search.dimensionStyleSubtitle',
    icon: 'sparkles-outline',
    tone: { from: '#3E5B49', to: '#20362A', ink: '#EFF3EE' },
  },
  taste: {
    titleKey: 'search.dimensionTasteTitle',
    subtitleKey: 'search.dimensionTasteSubtitle',
    icon: 'leaf-outline',
    tone: { from: '#6B2F3A', to: '#38181E', ink: '#F3E6E9' },
  },
  method: {
    titleKey: 'search.dimensionMethodTitle',
    subtitleKey: 'search.dimensionMethodSubtitle',
    icon: 'flask-outline',
    tone: { from: '#4E6478', to: '#293748', ink: '#EFF2F5' },
  },
} as const;

const FEATURED_COLLECTION_IDS = [
  'essential-classics',
  'under-5-minutes',
  'taste-sour',
  'strong-spirit-forward',
  'tiki-tropical',
  'low-abv-alcohol-free',
  'beginner-friendly',
  'date-night-classics',
  'party-favorites',
];

/**
 * "Search" (renamed from "Explore") is the library-browsing destination:
 * search, filter, and browse the built-in catalog and curated collections.
 * Distinct from "Discover" (see discover.tsx), which is community content —
 * what other people are making, not what the app ships with.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { t } = useTranslation();

  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);

  // Every resolver returns ALL known display-text variants (English + Turkish), not just the
  // active locale's — so search works the same regardless of which language the UI shows right
  // now (a Turkish-locale user typing "lemon" still finds "Limon Suyu", and vice versa).
  const resolveIngredientNames = useCallback((id: string) => getIngredientNameVariants(id), []);
  const resolveTagLabels = useCallback((id: string) => getVocabVariants(`taste.${id}`), []);
  const resolveCategoryLabels = useCallback((id: string) => getVocabVariants(`category.${id}`), []);
  const resolveDescriptionVariants = useCallback(
    (cocktail: (typeof cocktails)[number]) => [getCocktailContent(cocktail, 'en').description, getCocktailContent(cocktail, 'tr').description],
    [],
  );

  const isSearchingOrFiltering = query.trim().length > 0 || isFilterActive(filters);

  const results = useMemo(
    () => searchCatalog(cocktails, query, filters, resolveIngredientNames, resolveTagLabels, resolveCategoryLabels, resolveDescriptionVariants),
    [query, filters, resolveIngredientNames, resolveTagLabels, resolveCategoryLabels, resolveDescriptionVariants],
  );

  const featuredRows = useMemo(
    () =>
      FEATURED_COLLECTION_IDS.map((id) => discoveryCollectionsById.get(id))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .map((collection) => ({ collection, cocktails: getCollectionCocktails(collection, cocktails) }))
        .filter((entry) => entry.cocktails.length > 0),
    [],
  );

  const filterCount = activeFilterCount(filters);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text variant="title" style={styles.title}>
          {t('search.title')}
        </Text>
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder={t('search.searchPlaceholder')} />
          </View>
          <Pressable
            onPress={() => router.push('/filters')}
            accessibilityRole="button"
            accessibilityLabel={filterCount > 0 ? t('search.filtersWithCount', { count: filterCount }) : t('search.filters')}
            style={[styles.filterButton, { backgroundColor: theme.colors.surfaceAlt }]}
          >
            <Ionicons name="options-outline" size={20} color={theme.colors.textPrimary} />
            {filterCount > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.colors.accent }]}>
                <Text variant="label" color="onAccent">
                  {filterCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
        <Pressable
          onPress={() => setFilters({ ...filters, alcoholFreeOnly: !filters.alcoholFreeOnly })}
          accessibilityRole="button"
          accessibilityState={{ selected: filters.alcoholFreeOnly }}
          style={[
            styles.quickChip,
            {
              backgroundColor: filters.alcoholFreeOnly ? theme.colors.accent : theme.colors.surfaceAlt,
              borderColor: filters.alcoholFreeOnly ? theme.colors.accent : theme.colors.border,
            },
          ]}
        >
          <Text variant="captionStrong" color={filters.alcoholFreeOnly ? 'onAccent' : 'secondary'}>
            {t('search.alcoholFree')}
          </Text>
        </Pressable>
      </View>

      {isSearchingOrFiltering ? (
        <FlatList
          // Distinct `key` per branch is required, not cosmetic — this
          // FlatList is numColumns={2}, the discovery FlatList in the else
          // branch below has no numColumns, and both render at the same
          // conditional tree position. Without a key, clearing/starting a
          // search (an everyday action) swaps between them and hits React
          // Native's "Invariant Violation: Changing numColumns on the fly
          // is not supported" — the same class of bug found and confirmed
          // live in app/(tabs)/my-bar.tsx's segmented FlatLists. This is
          // the most likely real root cause of the search/filter-area
          // "Something went wrong" reports: a render-time invariant that
          // no amount of domain-level logic testing could ever catch.
          key="results"
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <DrinkCard
                source={{ kind: 'cocktail', item }}
                isFavorite={isFavorite('cocktail', item.id)}
                onToggleFavorite={() => toggleFavorite('cocktail', item.id)}
                onPress={() => router.push({ pathname: '/cocktail/[id]', params: { id: item.id, type: 'cocktail' } })}
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState icon="search" title={t('search.emptyTitle')} message={t('search.emptyMessage')} />
          }
        />
      ) : (
        <FlatList
          key="discovery"
          data={featuredRows}
          keyExtractor={(entry) => entry.collection.id}
          contentContainerStyle={styles.discoveryContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.discoveryHeader}>
              <View style={styles.bannerWrap}>
                <IngredientsBanner />
              </View>

              <View style={styles.dimensionSection}>
                <SectionLabel style={styles.dimensionLabel}>{t('search.discoverTitle')}</SectionLabel>
                <FlatList
                  horizontal
                  data={discoveryDimensions}
                  keyExtractor={(id) => id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dimensionRow}
                  renderItem={({ item: dimension }) => {
                    const meta = dimensionMeta[dimension];
                    return (
                      <DiscoveryDimensionCard
                        title={t(meta.titleKey as never)}
                        subtitle={t(meta.subtitleKey as never)}
                        icon={meta.icon}
                        tone={meta.tone}
                        onPress={() => router.push({ pathname: '/browse/[dimension]', params: { dimension } })}
                      />
                    );
                  }}
                />
              </View>

              <SectionLabel style={styles.dimensionLabel}>{t('search.moreCollections')}</SectionLabel>
            </View>
          }
          renderItem={({ item }) => (
            <DiscoveryCollectionRow
              collection={item.collection}
              cocktails={item.cocktails}
              isFavorite={(id) => isFavorite('cocktail', id)}
              onToggleFavorite={(id) => toggleFavorite('cocktail', id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 28 }} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  title: { marginBottom: 2 },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  bannerWrap: { paddingHorizontal: 20, marginBottom: 8 },
  row: { gap: 16 },
  cardWrap: { flex: 1 },
  discoveryContent: { paddingBottom: 32 },
  discoveryHeader: { gap: 20, marginBottom: 8 },
  dimensionSection: { gap: 12 },
  dimensionLabel: { paddingHorizontal: 20 },
  dimensionRow: { gap: 12, paddingHorizontal: 20 },
});
