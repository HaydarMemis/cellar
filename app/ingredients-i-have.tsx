import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cocktails, ingredients } from '../src/data/catalog';
import { rankMatches } from '../src/domain/matching';
import { IngredientCategory } from '../src/domain/types';
import { useTranslation } from '../src/i18n/useTranslation';
import { DrinkCard } from '../src/ui/components/DrinkCard';
import { EmptyState } from '../src/ui/components/EmptyState';
import { MatchListRow } from '../src/ui/components/MatchListRow';
import { Screen } from '../src/ui/components/Screen';
import { SectionLabel } from '../src/ui/components/SectionLabel';
import { Text } from '../src/ui/components/Text';
import { useFavoritesStore } from '../src/state/favoritesStore';
import { useInventoryStore } from '../src/state/inventoryStore';
import { useTheme } from '../src/theme/useTheme';

const ingredientCategoryOrder: IngredientCategory[] = [
  'spirit',
  'liqueur',
  'vermouth',
  'wine',
  'mixer',
  'juice',
  'produce',
  'sweetener',
  'syrup',
  'bitters',
  'garnish',
  'other',
];

export default function IngredientsIHaveScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, tVocab, tIngredient } = useTranslation();
  const [showPicker, setShowPicker] = useState(true);

  const entries = useInventoryStore((s) => s.entries);
  const toggleIngredient = useInventoryStore((s) => s.toggle);
  const clearInventory = useInventoryStore((s) => s.clear);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);

  const inventoryIds = useMemo(() => new Set(entries.map((e) => e.ingredientId)), [entries]);

  const sections = useMemo(
    () =>
      ingredientCategoryOrder.map((category) => ({
        title: tVocab(`ingredientCategory.${category}`),
        data: ingredients.filter((i) => i.category === category),
      })),
    [tVocab],
  );

  const ranked = useMemo(() => {
    if (inventoryIds.size === 0) return [];
    return rankMatches(cocktails, inventoryIds);
  }, [inventoryIds]);

  const fullMatches = useMemo(() => ranked.filter((m) => m.tier === 'full'), [ranked]);
  // A "full" match reached only via a substitute must be disclosed, not shown as if every listed ingredient were on hand — see matching correctness audit.
  const exactFullMatches = useMemo(() => fullMatches.filter((m) => m.substitutions.length === 0), [fullMatches]);
  const substitutedFullMatches = useMemo(() => fullMatches.filter((m) => m.substitutions.length > 0), [fullMatches]);
  const highMatches = useMemo(() => ranked.filter((m) => m.tier === 'high'), [ranked]);
  const partialMatches = useMemo(() => ranked.filter((m) => m.tier === 'partial'), [ranked]);

  const openCocktail = (id: string) => router.push({ pathname: '/cocktail/[id]', params: { id, type: 'cocktail' } });

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text variant="headline">{t('ingredientsTool.title')}</Text>
        <Pressable
          onPress={() => setShowPicker((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showPicker ? t('ingredientsTool.results') : t('ingredientsTool.edit')}
          hitSlop={8}
        >
          <Text variant="bodyStrong" color="accent">
            {showPicker ? t('ingredientsTool.results') : t('ingredientsTool.edit')}
          </Text>
        </Pressable>
      </View>

      {inventoryIds.size > 0 && (
        <View style={styles.summaryRow}>
          <Text variant="body" color="secondary">
            {t('ingredientsTool.selectedCount', { count: inventoryIds.size })}
          </Text>
          <Pressable onPress={clearInventory} hitSlop={8}>
            <Text variant="captionStrong" color="accent">
              {t('ingredientsTool.clearAll')}
            </Text>
          </Pressable>
        </View>
      )}

      {showPicker ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <SectionLabel style={styles.sectionHeader}>{section.title}</SectionLabel>}
          renderItem={({ item }) => (
            <IngredientRow
              label={tIngredient(item.id)}
              selected={inventoryIds.has(item.id)}
              onToggle={() => toggleIngredient(item.id)}
            />
          )}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.resultsContent} showsVerticalScrollIndicator={false}>
          {ranked.length === 0 ? (
            <EmptyState
              icon="flask-outline"
              title={t('ingredientsTool.emptyResultsTitle')}
              message={t('ingredientsTool.emptyResultsMessage')}
              actionLabel={t('ingredientsTool.addIngredientsAction')}
              onAction={() => setShowPicker(true)}
            />
          ) : (
            <>
              <Text variant="title" style={styles.resultsTitle}>
                {t('ingredientsTool.youCanMake', { count: fullMatches.length })}
              </Text>

              {exactFullMatches.length > 0 && (
                <View style={styles.tierSection}>
                  <SectionLabel style={styles.tierLabel}>{t('ingredientsTool.sectionYouCanMakeNow')}</SectionLabel>
                  <View style={styles.grid}>
                    {exactFullMatches.map((m) => (
                      <View key={m.item.id} style={styles.gridItem}>
                        <DrinkCard
                          source={{ kind: 'cocktail', item: m.item }}
                          isFavorite={isFavorite('cocktail', m.item.id)}
                          onToggleFavorite={() => toggleFavorite('cocktail', m.item.id)}
                          onPress={() => openCocktail(m.item.id)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {substitutedFullMatches.length > 0 && (
                <View style={styles.tierSection}>
                  <SectionLabel style={styles.tierLabel}>{t('ingredientsTool.sectionUsingSubstitute')}</SectionLabel>
                  <View style={styles.list}>
                    {substitutedFullMatches.map((m) => (
                      <MatchListRow key={m.item.id} match={m} onPress={() => openCocktail(m.item.id)} />
                    ))}
                  </View>
                </View>
              )}

              {highMatches.length > 0 && (
                <View style={styles.tierSection}>
                  <SectionLabel style={styles.tierLabel}>{t('ingredientsTool.sectionAlmostThere')}</SectionLabel>
                  <View style={styles.list}>
                    {highMatches.map((m) => (
                      <MatchListRow key={m.item.id} match={m} onPress={() => openCocktail(m.item.id)} />
                    ))}
                  </View>
                </View>
              )}

              {partialMatches.length > 0 && (
                <View style={styles.tierSection}>
                  <SectionLabel style={styles.tierLabel}>{t('ingredientsTool.sectionMoreOptions')}</SectionLabel>
                  <View style={styles.list}>
                    {partialMatches.map((m) => (
                      <MatchListRow key={m.item.id} match={m} onPress={() => openCocktail(m.item.id)} />
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

function IngredientRow({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={styles.ingredientRow}
    >
      <Text variant="body">{label}</Text>
      <Ionicons
        name={selected ? 'checkbox' : 'square-outline'}
        size={22}
        color={selected ? theme.colors.accent : theme.colors.textTertiary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionHeader: { paddingTop: 16, paddingBottom: 8 },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#0002',
  },
  resultsContent: { paddingHorizontal: 20, paddingBottom: 40 },
  resultsTitle: { marginBottom: 20 },
  tierSection: { marginBottom: 28, gap: 12 },
  tierLabel: {},
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { width: '46%' },
  list: { gap: 10 },
});
