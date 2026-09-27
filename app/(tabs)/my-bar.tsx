import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cocktails } from '../../src/data/catalog';
import { DrinkSource, JournalEntry, LOCAL_GUEST_OWNER_ID } from '../../src/domain/types';
import { useTranslation } from '../../src/i18n/useTranslation';
import { DrinkCard } from '../../src/ui/components/DrinkCard';
import { EmptyState } from '../../src/ui/components/EmptyState';
import { JournalLogModal } from '../../src/ui/components/JournalLogModal';
import { Screen } from '../../src/ui/components/Screen';
import { SegmentedControl } from '../../src/ui/components/SegmentedControl';
import { Text } from '../../src/ui/components/Text';
import { useAuthStore } from '../../src/state/authStore';
import { useDiscoverFeedStore } from '../../src/state/discoverFeedStore';
import { matchesRecipeId } from '../../src/domain/uuid';
import { useFavoritesStore } from '../../src/state/favoritesStore';
import { useJournalStore } from '../../src/state/journalStore';
import { useRecipesStore } from '../../src/state/recipesStore';
import { useTheme } from '../../src/theme/useTheme';

type Segment = 'recipes' | 'favorites' | 'journal';

export default function MyBarScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [segment, setSegment] = useState<Segment>('recipes');

  const recipes = useRecipesStore((s) => s.recipes);
  // "My recipes" must only ever be MY recipes — recipesStore holds every
  // locally-stored recipe regardless of who created it (private recipes
  // never leave the device, so this is the only place that data lives),
  // which is fine for looking a specific recipe up by id (any favorited
  // public recipe, not just your own, must still resolve — see
  // favoriteSources below), but showing this unfiltered list on the "My
  // recipes" tab meant a different signed-in account on the same device
  // would see the previous account's private recipes too. Real,
  // confirmed data-isolation bug found in the auth-lifecycle audit.
  // Depends on the signed-in id explicitly — reading currentOwnerId() inside
  // the memo made this list stale after signing in/out until some recipe
  // changed.
  const ownerId = useAuthStore((s) => s.profile?.id ?? LOCAL_GUEST_OWNER_ID);
  const myRecipes = useMemo(() => recipes.filter((r) => r.ownerId === ownerId), [recipes, ownerId]);
  const remoteById = useDiscoverFeedStore((s) => s.byId);
  const fetchRemoteById = useDiscoverFeedStore((s) => s.fetchById);
  const favorites = useFavoritesStore((s) => s.favorites);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const journalEntries = useJournalStore((s) => s.entries);
  const removeJournalEntry = useJournalStore((s) => s.remove);
  const [editingJournalEntry, setEditingJournalEntry] = useState<JournalEntry | null>(null);

  const favoriteSources: DrinkSource[] = useMemo(() => {
    return favorites
      .map((f): DrinkSource | undefined => {
        if (f.targetType === 'cocktail') {
          const item = cocktails.find((c) => c.id === f.targetId);
          return item ? { kind: 'cocktail', item } : undefined;
        }
        // A favorited recipe is either one on this device or someone else's
        // published recipe (resolved from the backend below).
        const item = recipes.find((r) => matchesRecipeId(r.id, f.targetId)) ?? remoteById[f.targetId];
        return item ? { kind: 'recipe', item } : undefined;
      })
      .filter((s): s is DrinkSource => !!s);
  }, [favorites, recipes, remoteById]);

  // Resolve favorited community recipes that aren't cached yet. A recipe
  // that no longer exists (unpublished) simply stays hidden — the favorite
  // itself is kept, never deleted behind the user's back.
  useEffect(() => {
    const missing = favorites.filter(
      (f) => f.targetType === 'recipe' && !recipes.some((r) => matchesRecipeId(r.id, f.targetId)) && !remoteById[f.targetId],
    );
    for (const f of missing) fetchRemoteById(f.targetId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites, recipes]);

  const openDrink = (kind: 'cocktail' | 'recipe', id: string) =>
    router.push({ pathname: '/cocktail/[id]', params: { id, type: kind } });

  const handleJournalRowAction = (entry: JournalEntry) => {
    Alert.alert(entry.drinkName, undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('journal.editAction'), onPress: () => setEditingJournalEntry(entry) },
      {
        text: t('cocktailDetail.delete'),
        style: 'destructive',
        onPress: () => removeJournalEntry(entry.id),
      },
    ]);
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text variant="title">{t('myBar.title')}</Text>
        <SegmentedControl
          options={[
            { id: 'recipes', label: t('myBar.tabRecipes') },
            { id: 'favorites', label: t('myBar.tabFavorites') },
            { id: 'journal', label: t('journal.tabLabel') },
          ]}
          value={segment}
          onChange={setSegment}
        />
      </View>

      {segment === 'journal' ? (
        <FlatList
          // Distinct `key` per segment is required, not cosmetic: this
          // list has no `numColumns` while the other two segments' lists
          // below are numColumns={2}. Three FlatLists conditionally
          // rendered at the same tree position, switched by tapping the
          // segmented control, previously shared React's reconciliation
          // identity across that switch — React Native explicitly forbids
          // changing numColumns on an existing FlatList instance and
          // throws "Invariant Violation: Changing numColumns on the fly
          // is not supported," which is exactly what reproduced here
          // (confirmed live). The `key` forces a fresh mount per segment
          // instead of a prop update on the same instance.
          key="journal"
          data={journalEntries}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.journalContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            journalEntries.length > 0 ? (
              <Text variant="caption" color="tertiary" style={styles.journalHint}>
                {t('journal.openDrinkHint')}
              </Text>
            ) : null
          }
          renderItem={({ item: entry }) => (
            <Pressable
              onPress={() => openDrink(entry.drinkKind, entry.drinkId)}
              onLongPress={() => handleJournalRowAction(entry)}
              accessibilityRole="button"
              accessibilityLabel={entry.drinkName}
              style={[styles.journalRow, { backgroundColor: theme.colors.surfaceAlt }]}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{entry.drinkName}</Text>
                {entry.note ? (
                  <Text variant="caption" color="secondary" numberOfLines={2} style={{ marginTop: 2 }}>
                    {entry.note}
                  </Text>
                ) : null}
              </View>
              <View style={styles.starRow}>
                {([1, 2, 3, 4, 5] as const).map((value) => (
                  <Ionicons
                    key={value}
                    name={value <= entry.rating ? 'star' : 'star-outline'}
                    size={13}
                    color={theme.colors.accent}
                  />
                ))}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="book-outline" title={t('journal.emptyTitle')} message={t('journal.emptyMessage')} />}
        />
      ) : segment === 'recipes' ? (
        <FlatList
          key="recipes"
          data={myRecipes}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={myRecipes.length > 0 ? styles.row : undefined}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <DrinkCard
                source={{ kind: 'recipe', item }}
                isFavorite={isFavorite('recipe', item.id)}
                onToggleFavorite={() => toggleFavorite('recipe', item.id)}
                onPress={() => openDrink('recipe', item.id)}
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="create-outline"
              title={t('myBar.emptyRecipesTitle')}
              message={t('myBar.emptyRecipesMessage')}
              actionLabel={t('myBar.newRecipe')}
              onAction={() => router.push('/recipe-editor')}
            />
          }
        />
      ) : (
        <FlatList
          key="favorites"
          data={favoriteSources}
          keyExtractor={(s) => `${s.kind}-${s.item.id}`}
          numColumns={2}
          columnWrapperStyle={favoriteSources.length > 0 ? styles.row : undefined}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: source }) => (
            <View style={styles.cardWrap}>
              <DrinkCard
                source={source}
                isFavorite
                onToggleFavorite={() => toggleFavorite(source.kind, source.item.id)}
                onPress={() => openDrink(source.kind, source.item.id)}
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState icon="heart-outline" title={t('myBar.emptyFavoritesTitle')} message={t('myBar.emptyFavoritesMessage')} />
          }
        />
      )}

      {segment === 'recipes' && myRecipes.length > 0 && (
        <Pressable
          onPress={() => router.push('/recipe-editor')}
          accessibilityRole="button"
          accessibilityLabel={t('myBar.newRecipe')}
          style={[styles.fab, { backgroundColor: theme.colors.accent, bottom: insets.bottom + 16 }]}
        >
          <Ionicons name="add" size={26} color={theme.colors.onAccent} />
        </Pressable>
      )}

      {editingJournalEntry && (
        <JournalLogModal
          visible={!!editingJournalEntry}
          onClose={() => setEditingJournalEntry(null)}
          drinkKind={editingJournalEntry.drinkKind}
          drinkId={editingJournalEntry.drinkId}
          drinkName={editingJournalEntry.drinkName}
          editingEntry={editingJournalEntry}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 14 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1, gap: 16 },
  row: { gap: 16 },
  cardWrap: { flex: 1 },
  journalContent: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1, gap: 10 },
  journalHint: { marginBottom: 2 },
  journalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14 },
  starRow: { flexDirection: 'row', gap: 2 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
