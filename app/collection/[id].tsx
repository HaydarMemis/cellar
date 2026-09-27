import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cocktails } from '../../src/data/catalog';
import { discoveryCollectionsById, getCollectionCocktails } from '../../src/domain/discovery';
import { matchesQuery } from '../../src/domain/search';
import { sortCocktails, sortKeys, SortKey } from '../../src/domain/sortCocktails';
import { getCollectionDescription, getCollectionTitle, isCuratedCollection } from '../../src/i18n/collectionLabels';
import { getIngredientNameVariants, getVocabVariants } from '../../src/i18n/searchResolvers';
import { useTranslation } from '../../src/i18n/useTranslation';
import { Chip } from '../../src/ui/components/Chip';
import { DrinkCard } from '../../src/ui/components/DrinkCard';
import { EmptyState } from '../../src/ui/components/EmptyState';
import { Screen } from '../../src/ui/components/Screen';
import { SearchBar } from '../../src/ui/components/SearchBar';
import { Text } from '../../src/ui/components/Text';
import { useFavoritesStore } from '../../src/state/favoritesStore';
import { useTheme } from '../../src/theme/useTheme';

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, tVocab } = useTranslation();
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);

  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recommended');

  const collection = discoveryCollectionsById.get(id);
  const baseCocktails = useMemo(() => (collection ? getCollectionCocktails(collection, cocktails) : []), [collection]);

  const filtered = useMemo(() => {
    if (!query.trim()) return baseCocktails;
    return baseCocktails.filter((c) =>
      matchesQuery(c, query, getIngredientNameVariants, (tagId) => getVocabVariants(`taste.${tagId}`), (catId) => getVocabVariants(`category.${catId}`)),
    );
  }, [baseCocktails, query]);

  const sorted = useMemo(() => sortCocktails(filtered, sortKey), [filtered, sortKey]);

  if (!collection) {
    return (
      <Screen>
        <View style={[styles.notFound, { paddingTop: insets.top + 40 }]}>
          <Text variant="headline">{t('cocktailDetail.notFound')}</Text>
        </View>
      </Screen>
    );
  }

  const title = getCollectionTitle(collection, t, tVocab);
  const description = getCollectionDescription(collection, t, tVocab);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <View style={styles.titleLine}>
          <Text variant="title">{title}</Text>
          {isCuratedCollection(collection) && (
            <View style={[styles.badge, { backgroundColor: theme.colors.accentSoft }]}>
              <Text variant="label" color="accent">
                {t('collections.curatedBadge')}
              </Text>
            </View>
          )}
        </View>
        {description ? (
          <Text variant="body" color="secondary" style={styles.description}>
            {description}
          </Text>
        ) : null}
        <Text variant="caption" color="tertiary" style={styles.count}>
          {t('collections.count', { count: baseCocktails.length })}
        </Text>
      </View>

      <View style={styles.toolsBlock}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t('search.searchPlaceholder')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {sortKeys.map((key) => (
            <Chip key={key} label={t(`collections.sort.${key}`)} selected={sortKey === key} onPress={() => setSortKey(key)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 4 },
  titleBlock: { paddingHorizontal: 20, gap: 6, marginBottom: 16 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  description: { lineHeight: 20 },
  count: { marginTop: 2 },
  toolsBlock: { paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  sortRow: { gap: 8 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  row: { gap: 16 },
  cardWrap: { flex: 1 },
  notFound: { paddingHorizontal: 20 },
});
