import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cocktails } from '../src/data/catalog';
import { buildShoppingList } from '../src/domain/shoppingList';
import { RecipeIngredient, ShoppingListEntry } from '../src/domain/types';
import { useTranslation } from '../src/i18n/useTranslation';
import { Button } from '../src/ui/components/Button';
import { EmptyState } from '../src/ui/components/EmptyState';
import { Screen } from '../src/ui/components/Screen';
import { Text } from '../src/ui/components/Text';
import { useEntitlementStore } from '../src/state/entitlementStore';
import { useInventoryStore } from '../src/state/inventoryStore';
import { useRecipesStore } from '../src/state/recipesStore';
import { useDiscoverFeedStore } from '../src/state/discoverFeedStore';
import { matchesRecipeId } from '../src/domain/uuid';
import { useShoppingListStore } from '../src/state/shoppingListStore';
import { useTheme } from '../src/theme/useTheme';

/**
 * The real, persistent shopping list — one list you build up over time
 * (from My Bar or from any recipe's "Shopping list" action), not a
 * throwaway single-recipe projection. See useShoppingListStore /
 * ShoppingListRepository for the persisted entity; buildShoppingList (a
 * *pure derivation*, no identity) is only used here to compute which of
 * one recipe's ingredients are still missing at the moment it's added.
 *
 * `ids`/`kind` route params (set when arriving from a cocktail's
 * "Shopping list" button) are a one-time merge instruction, not the
 * screen's data source — the effect below folds them into the persisted
 * list once, then the store is the only source of truth for everything
 * rendered.
 */
export default function ShoppingListScreen() {
  const { ids, kind } = useLocalSearchParams<{ ids: string; kind?: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, tIngredient } = useTranslation();
  const isPremium = useEntitlementStore((s) => s.isPremium);

  // Select the stable `entries` array and derive the Set with useMemo,
  // never `(s) => s.asIdSet()` — that method allocates a brand-new Set on
  // every call, so using it directly as a Zustand selector makes every
  // render's snapshot fail an Object.is check against the previous one,
  // which (via useSyncExternalStore) re-triggers a render forever. This
  // was the actual root cause of this screen's "Maximum update depth
  // exceeded" crash — see ingredients-i-have.tsx / index.tsx for the same
  // safe pattern used correctly elsewhere.
  const inventoryEntries = useInventoryStore((s) => s.entries);
  const inventoryIds = useMemo(() => new Set(inventoryEntries.map((e) => e.ingredientId)), [inventoryEntries]);
  const recipes = useRecipesStore((s) => s.recipes);

  const shoppingEntries = useShoppingListStore((s) => s.entries);
  const addIngredients = useShoppingListStore((s) => s.addIngredients);
  const toggleCompleted = useShoppingListStore((s) => s.toggleCompleted);
  const removeEntry = useShoppingListStore((s) => s.remove);
  const clearCompleted = useShoppingListStore((s) => s.clearCompleted);
  const clearAll = useShoppingListStore((s) => s.clearAll);

  const idList = useMemo(() => (ids ?? '').split(',').filter(Boolean), [ids]);
  const mergeKey = `${idList.join(',')}|${kind ?? ''}`;
  const mergedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isPremium) return;
    if (idList.length === 0) return;
    if (mergedKeyRef.current === mergeKey) return;
    mergedKeyRef.current = mergeKey;

    const ingredientLists: RecipeIngredient[][] =
      kind === 'recipe'
        ? idList.map((id) => (recipes.find((r) => matchesRecipeId(r.id, id)) ?? useDiscoverFeedStore.getState().byId[id])?.ingredients ?? [])
        : idList.map((id) => cocktails.find((c) => c.id === id)?.ingredients ?? []);
    const missing = buildShoppingList(ingredientLists, inventoryIds).map((i) => i.ingredientId);
    if (missing.length > 0) addIngredients(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, mergeKey]);

  const activeItems = useMemo(() => shoppingEntries.filter((e) => !e.completed), [shoppingEntries]);
  const completedItems = useMemo(() => shoppingEntries.filter((e) => e.completed), [shoppingEntries]);

  const handleRemove = (entry: ShoppingListEntry) => {
    Alert.alert(t('shoppingList.removeConfirmTitle', { name: tIngredient(entry.ingredientId) }), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('cocktailDetail.delete'), style: 'destructive', onPress: () => removeEntry(entry.id) },
    ]);
  };

  const handleClearAll = () => {
    if (shoppingEntries.length === 0) return;
    Alert.alert(t('shoppingList.clearAllConfirmTitle'), t('shoppingList.clearAllConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('shoppingList.clearAllAction'), style: 'destructive', onPress: () => clearAll() },
    ]);
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
        <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
      </Pressable>
      <Text variant="headline">{t('shoppingList.title')}</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  if (!isPremium) {
    return (
      <Screen>
        {header}
        <View style={styles.upsell}>
          <Ionicons name="lock-closed-outline" size={28} color={theme.colors.textSecondary} />
          <Text variant="headline" style={{ marginTop: 12, textAlign: 'center' }}>
            {t('shoppingList.premiumRequiredTitle')}
          </Text>
          <Text variant="body" color="secondary" style={{ marginTop: 8, textAlign: 'center' }}>
            {t('shoppingList.premiumRequiredMessage')}
          </Text>
          <Button label={t('premium.title')} onPress={() => router.push('/premium')} style={{ marginTop: 20 }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {header}

      {shoppingEntries.length === 0 ? (
        <EmptyState icon="cart-outline" title={t('shoppingList.emptyTitle')} message={t('shoppingList.emptyMessage')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.countRow}>
            <Text variant="body" color="secondary">
              {t('shoppingList.itemsCount', { count: activeItems.length })}
            </Text>
            <Pressable onPress={handleClearAll} accessibilityRole="button" hitSlop={8}>
              <Text variant="captionStrong" color="accent">
                {t('shoppingList.clearAllAction')}
              </Text>
            </Pressable>
          </View>

          {activeItems.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => {
                toggleCompleted(entry.id);
                Haptics.selectionAsync().catch(() => undefined);
              }}
              onLongPress={() => handleRemove(entry)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: false }}
              accessibilityLabel={tIngredient(entry.ingredientId)}
              style={[styles.row, { borderBottomColor: theme.colors.border }]}
            >
              <Ionicons name="ellipse-outline" size={22} color={theme.colors.textTertiary} />
              <Text variant="body" style={styles.rowLabel}>
                {tIngredient(entry.ingredientId)}
              </Text>
            </Pressable>
          ))}

          {completedItems.length > 0 && (
            <View style={styles.completedSection}>
              <View style={styles.countRow}>
                <Text variant="captionStrong" color="tertiary">
                  {t('shoppingList.completedSection', { count: completedItems.length })}
                </Text>
                <Pressable onPress={() => clearCompleted()} accessibilityRole="button" hitSlop={8}>
                  <Text variant="captionStrong" color="accent">
                    {t('shoppingList.clearCompletedAction')}
                  </Text>
                </Pressable>
              </View>
              {completedItems.map((entry) => (
                <Pressable
                  key={entry.id}
                  onPress={() => {
                    toggleCompleted(entry.id);
                    Haptics.selectionAsync().catch(() => undefined);
                  }}
                  onLongPress={() => handleRemove(entry)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: true }}
                  accessibilityLabel={tIngredient(entry.ingredientId)}
                  style={[styles.row, { borderBottomColor: theme.colors.border }]}
                >
                  <Ionicons name="checkmark-circle" size={22} color={theme.colors.accent} />
                  <Text variant="body" color="tertiary" style={[styles.rowLabel, styles.rowLabelDone]}>
                    {tIngredient(entry.ingredientId)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text variant="caption" color="tertiary" style={styles.hint}>
            {t('shoppingList.longPressHint')}
          </Text>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, minHeight: 24 },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { flex: 1 },
  rowLabelDone: { textDecorationLine: 'line-through' },
  completedSection: { marginTop: 24 },
  hint: { marginTop: 20, textAlign: 'center' },
  upsell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 80 },
});
