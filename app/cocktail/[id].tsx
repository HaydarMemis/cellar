import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cocktails } from '../../src/data/catalog';
import { getRelatedCocktails } from '../../src/domain/related';
import { scaleIngredients } from '../../src/domain/scaling';
import { getSubstitutesFor, getSubstitutionNoteKey } from '../../src/domain/substitutions';
import { DrinkSource, PersonalRecipe } from '../../src/domain/types';
import { matchesRecipeId, remoteRecipeId } from '../../src/domain/uuid';
import { useTranslation } from '../../src/i18n/useTranslation';
import { DrinkVisual } from '../../src/ui/components/DrinkVisual';
import { FavoriteButton } from '../../src/ui/components/FavoriteButton';
import { HorizontalDrinkRow } from '../../src/ui/components/HorizontalDrinkRow';
import { JournalLogModal } from '../../src/ui/components/JournalLogModal';
import { ScaleModal } from '../../src/ui/components/ScaleModal';
import { Screen } from '../../src/ui/components/Screen';
import { SectionLabel } from '../../src/ui/components/SectionLabel';
import { Text } from '../../src/ui/components/Text';
import { currentOwnerId } from '../../src/state/authStore';
import { useDiscoverFeedStore } from '../../src/state/discoverFeedStore';
import { useFavoritesStore } from '../../src/state/favoritesStore';
import { useRecipesStore } from '../../src/state/recipesStore';
import { useSettingsStore } from '../../src/state/settingsStore';
import { useTheme } from '../../src/theme/useTheme';

const HERO_MAX = 320;
const HERO_MIN = 110;
const HERO_RANGE = HERO_MAX - HERO_MIN;

export default function CocktailDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const kind = type === 'recipe' ? 'recipe' : 'cocktail';
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const units = useSettingsStore((s) => s.units);
  const { t, tVocab, tIngredient, tAmount, tApprox, tNumber, tCocktail, tNote } = useTranslation();

  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const recipes = useRecipesStore((s) => s.recipes);
  const removeRecipe = useRecipesStore((s) => s.remove);

  const [servings, setServings] = useState(1);
  const [scaleModalVisible, setScaleModalVisible] = useState(false);
  const [journalModalVisible, setJournalModalVisible] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const heroAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, HERO_RANGE], [HERO_MAX, HERO_MIN], Extrapolation.CLAMP),
  }));
  const stickyBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_RANGE * 0.5, HERO_RANGE], [0, 1], Extrapolation.CLAMP),
  }));

  // A recipe route id can be (a) a recipe stored on this device — matched
  // by its local id OR its remote id, since Discover rows carry the remote
  // one (see src/domain/uuid.ts) — or (b) someone else's published recipe,
  // which only exists on the backend. The local copy always wins so the
  // owner edits/deletes the real local record, never a read-only mirror.
  const localRecipe = useMemo(
    () => (kind === 'recipe' && id ? recipes.find((r) => matchesRecipeId(r.id, id)) : undefined),
    [kind, id, recipes],
  );
  const cachedRemote = useDiscoverFeedStore((s) => (kind === 'recipe' && id ? s.byId[id] : undefined));
  const fetchRemoteById = useDiscoverFeedStore((s) => s.fetchById);
  const [remoteLookup, setRemoteLookup] = useState<{ id: string; status: 'loading' | 'found' | 'missing' | 'error'; recipe?: PersonalRecipe } | null>(null);

  const needsRemoteLookup = kind === 'recipe' && !!id && !localRecipe && !cachedRemote;
  useEffect(() => {
    if (!needsRemoteLookup || !id) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setRemoteLookup({ id, status: 'loading' });
        return fetchRemoteById(id);
      })
      .then((recipe) => {
        if (!cancelled) setRemoteLookup(recipe ? { id, status: 'found', recipe } : { id, status: 'missing' });
      })
      .catch(() => {
        if (!cancelled) setRemoteLookup({ id, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [needsRemoteLookup, id, fetchRemoteById]);

  const item = useMemo(() => {
    if (kind === 'recipe') return localRecipe ?? cachedRemote ?? (remoteLookup?.id === id ? remoteLookup?.recipe : undefined);
    return cocktails.find((c) => c.id === id);
  }, [kind, id, localRecipe, cachedRemote, remoteLookup]);
  const isResolvingRemote = needsRemoteLookup && !item && (remoteLookup?.id !== id || remoteLookup.status === 'loading');
  const remoteLookupFailed = needsRemoteLookup && !item && remoteLookup?.id === id && remoteLookup.status === 'error';

  const related = useMemo(() => {
    if (kind !== 'cocktail' || !item) return [];
    return getRelatedCocktails(item as (typeof cocktails)[number], cocktails);
  }, [kind, item]);

  const scaledIngredients = useMemo(() => {
    if (!item) return [];
    return scaleIngredients(item.ingredients, servings);
  }, [item, servings]);

  if (!item) {
    return (
      <Screen>
        <View style={[styles.notFound, { paddingTop: insets.top + 40 }]}>
          {isResolvingRemote ? (
            <ActivityIndicator color={theme.colors.textSecondary} />
          ) : (
            <Text variant="headline">{t(remoteLookupFailed ? 'cocktailDetail.loadFailed' : 'cocktailDetail.notFound')}</Text>
          )}
        </View>
      </Screen>
    );
  }

  const source: DrinkSource =
    kind === 'recipe' ? { kind: 'recipe', item: item as never } : { kind: 'cocktail', item: item as never };

  const favorited = isFavorite(kind, item.id);
  const isOwnPublicRecipe = kind === 'recipe' && (item as { visibility?: string }).visibility === 'public';
  // Edit/delete must never show for a recipe this signed-in identity
  // doesn't own — recipesStore holds every locally-stored recipe
  // regardless of owner (private recipes never leave the device, so this
  // is the only place that data lives), and this screen can be reached
  // for someone else's recipe via a favorite reference or a direct deep
  // link. Real gap found in the auth-lifecycle audit: this previously
  // showed Edit/Delete for ANY kind === 'recipe' with no ownership check.
  // Only a recipe that actually exists in this device's store can be edited
  // or deleted from here — a backend copy of your own recipe (e.g. published
  // from another device) has no local record for the editor to update.
  const isOwnRecipe = kind === 'recipe' && !!localRecipe && localRecipe.ownerId === currentOwnerId();

  // Catalog cocktails resolve prose through the Turkish overlay; a personal
  // recipe is the user's own words and is never machine-translated.
  const content =
    kind === 'cocktail'
      ? tCocktail(item as (typeof cocktails)[number])
      : { description: item.description, steps: item.steps, garnish: item.garnish };

  // Catalog cocktails and published recipes can be shared: a readable text
  // version (useful even without the app) plus a cellar:// link that opens
  // this screen for anyone who has Cellar. Private recipes are never shared.
  const shareRecipeId = kind === 'recipe' ? remoteRecipeId(item.id) : item.id;
  const canShare = kind === 'cocktail' || ((item as { visibility?: string }).visibility === 'public' && !localRecipe?.pendingSync);
  const handleShare = () => {
    const lines = [
      item.name,
      '',
      ...item.ingredients.map((ri) => `• ${ri.amount ? `${tAmount(ri.amount, units)} ` : ''}${tIngredient(ri.ingredientId)}`),
      '',
      Linking.createURL(`cocktail/${shareRecipeId}`, { queryParams: kind === 'recipe' ? { type: 'recipe' } : undefined }),
    ];
    Share.share({ message: lines.join('\n') }).catch(() => undefined);
  };

  const confirmDelete = () => {
    Alert.alert(t('cocktailDetail.deleteConfirmTitle'), t('cocktailDetail.deleteConfirmMessage', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('cocktailDetail.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeRecipe(item.id);
          } catch {
            // Unpublishing failed, so nothing was deleted (see
            // recipesStore.remove) — the recipe is still here and still yours.
            Alert.alert(t('cocktailDetail.deleteFailedTitle'), t('cocktailDetail.deleteFailedMessage'));
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Animated.View style={[styles.heroClip, heroAnimatedStyle]}>
          <DrinkVisual source={source} height={HERO_MAX} />
        </Animated.View>

        <View style={styles.body}>
          <Text variant="display">{item.name}</Text>
          <Text variant="body" color="secondary" style={styles.tagsLine}>
            {item.category.map((c) => tVocab(`category.${c}` as never)).join(' · ')}
          </Text>

          <View style={styles.metaRow}>
            <MetaPill label={tVocab(`difficulty.${item.difficulty}`)} />
            <MetaPill label={t('common.min', { count: item.prepTimeMinutes })} />
            {item.abv && <MetaPill label={t('cocktailDetail.abvApprox', { value: tNumber(item.abv.approx, 0) })} />}
            {isOwnPublicRecipe && !localRecipe?.pendingSync && <MetaPill label={t('myBar.publicBadge')} />}
            {isOwnRecipe && localRecipe?.pendingSync && (
              <MetaPill label={t(localRecipe.pendingSync === 'publish' ? 'publish.pendingPublishBadge' : 'publish.pendingUnpublishBadge')} />
            )}
          </View>

          {content.description ? (
            <Text variant="body" color="secondary" style={styles.description}>
              {content.description}
            </Text>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipeActionsScroll} contentContainerStyle={styles.recipeActions}>
            <Pressable
              onPress={() => setScaleModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={servings === 1 ? t('cocktailDetail.scaleAction') : t('scaling.servings', { count: servings })}
              style={[styles.recipeActionButton, { backgroundColor: theme.colors.surfaceAlt }]}
            >
              <Ionicons name="resize-outline" size={16} color={theme.colors.textPrimary} />
              <Text variant="captionStrong">{servings === 1 ? t('cocktailDetail.scaleAction') : t('scaling.servings', { count: servings })}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/shopping-list', params: { ids: item.id, kind } })}
              accessibilityRole="button"
              accessibilityLabel={t('cocktailDetail.shoppingListAction')}
              style={[styles.recipeActionButton, { backgroundColor: theme.colors.surfaceAlt }]}
            >
              <Ionicons name="cart-outline" size={16} color={theme.colors.textPrimary} />
              <Text variant="captionStrong">{t('cocktailDetail.shoppingListAction')}</Text>
            </Pressable>
            {canShare && (
              <Pressable
                onPress={handleShare}
                accessibilityRole="button"
                accessibilityLabel={t('cocktailDetail.shareAction')}
                style={[styles.recipeActionButton, { backgroundColor: theme.colors.surfaceAlt }]}
              >
                <Ionicons name="share-outline" size={16} color={theme.colors.textPrimary} />
                <Text variant="captionStrong">{t('cocktailDetail.shareAction')}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => setJournalModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('cocktailDetail.logToJournalAction')}
              style={[styles.recipeActionButton, { backgroundColor: theme.colors.surfaceAlt }]}
            >
              <Ionicons name="book-outline" size={16} color={theme.colors.textPrimary} />
              <Text variant="captionStrong">{t('cocktailDetail.logToJournalAction')}</Text>
            </Pressable>
          </ScrollView>

          {isOwnRecipe && (
            <View style={[styles.recipeActions, { marginTop: 12 }]}>
              <Pressable
                onPress={() => router.push({ pathname: '/recipe-editor', params: { id: item.id } })}
                accessibilityRole="button"
                accessibilityLabel={t('cocktailDetail.edit')}
                style={[styles.recipeActionButton, { backgroundColor: theme.colors.surfaceAlt }]}
              >
                <Ionicons name="pencil-outline" size={16} color={theme.colors.textPrimary} />
                <Text variant="captionStrong">{t('cocktailDetail.edit')}</Text>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                accessibilityRole="button"
                accessibilityLabel={t('cocktailDetail.delete')}
                style={[styles.recipeActionButton, { backgroundColor: theme.colors.surfaceAlt }]}
              >
                <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                <Text variant="captionStrong" color="secondary">
                  {t('cocktailDetail.delete')}
                </Text>
              </Pressable>
            </View>
          )}

          <SectionLabel style={styles.sectionLabel}>{t('cocktailDetail.ingredients')}</SectionLabel>
          <View style={styles.ingredientList}>
            {scaledIngredients.map((ri, index) => {
              const approx = ri.amount ? tApprox(ri.amount, units) : null;
              const [substituteId] = getSubstitutesFor(ri.ingredientId);
              const noteKey = substituteId ? getSubstitutionNoteKey(ri.ingredientId, substituteId) : undefined;

              return (
                <View key={`${ri.ingredientId}-${index}`}>
                  <Pressable
                    onPress={() => router.push({ pathname: '/ingredient/[id]', params: { id: ri.ingredientId } })}
                    accessibilityRole="button"
                    accessibilityLabel={tIngredient(ri.ingredientId)}
                    style={({ pressed }) => [styles.ingredientRow, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <View style={styles.ingredientAmount}>
                      <Text variant="bodyStrong">{ri.amount ? tAmount(ri.amount, units) : t('cocktailDetail.toTop')}</Text>
                      {approx ? (
                        <Text variant="caption" color="tertiary">
                          {approx}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="body">
                        {tIngredient(ri.ingredientId)}
                        {ri.isOptional ? (
                          <Text variant="caption" color="tertiary">
                            {`  (${t('cocktailDetail.optionalTag')})`}
                          </Text>
                        ) : null}
                      </Text>
                      {ri.note ? (
                        <Text variant="caption" color="secondary">
                          {kind === 'cocktail' ? tNote(ri.note) : ri.note}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
                  </Pressable>
                  {substituteId ? (
                    <View style={styles.substituteHint}>
                      <Text variant="caption" color="secondary">
                        {t('cocktailDetail.dontHave', { name: tIngredient(ri.ingredientId) })}{' '}
                        {t('cocktailDetail.useInstead', { name: tIngredient(substituteId) })}
                        {noteKey ? ` ${t(`substitutions.notes.${noteKey}` as never)}` : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          <SectionLabel style={styles.sectionLabel}>{t('cocktailDetail.howToMake')}</SectionLabel>
          <View style={styles.stepList}>
            {content.steps.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <View style={[styles.stepNumber, { backgroundColor: theme.colors.accentSoft }]}>
                  <Text variant="captionStrong" color="accent">
                    {index + 1}
                  </Text>
                </View>
                <Text variant="body" style={{ flex: 1 }}>
                  {step}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.glassGarnishRow}>
            <View style={styles.glassGarnishItem}>
              <SectionLabel style={styles.sectionLabel}>{t('cocktailDetail.glass')}</SectionLabel>
              <Text variant="body" color="secondary">
                {item.glass.map((g) => tVocab(`glass.${g}`)).join(` ${t('common.or')} `)}
              </Text>
            </View>
            {content.garnish ? (
              <View style={styles.glassGarnishItem}>
                <SectionLabel style={styles.sectionLabel}>{t('cocktailDetail.garnish')}</SectionLabel>
                <Text variant="body" color="secondary">
                  {content.garnish}
                </Text>
              </View>
            ) : null}
          </View>

          {kind === 'recipe' && (item as { notes?: string }).notes ? (
            <>
              <SectionLabel style={styles.sectionLabel}>{t('cocktailDetail.notes')}</SectionLabel>
              <Text variant="body" color="secondary">
                {(item as { notes?: string }).notes}
              </Text>
            </>
          ) : null}
        </View>

        {related.length > 0 && (
          <View style={styles.relatedSection}>
            <Text variant="headline" style={styles.relatedTitle}>
              {t('cocktailDetail.youMayAlsoLike')}
            </Text>
            <HorizontalDrinkRow
              items={related}
              isFavorite={(relatedId) => isFavorite('cocktail', relatedId)}
              onToggleFavorite={(relatedId) => toggleFavorite('cocktail', relatedId)}
              onPress={(relatedId) => router.push({ pathname: '/cocktail/[id]', params: { id: relatedId, type: 'cocktail' } })}
            />
          </View>
        )}
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.stickyBar,
          { paddingTop: insets.top, backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border },
          stickyBarStyle,
        ]}
      >
        <Text variant="bodyStrong" numberOfLines={1} style={styles.stickyTitle}>
          {item.name}
        </Text>
      </Animated.View>

      <View style={[styles.topControls, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('cocktailDetail.close')}
          hitSlop={8}
          style={styles.circleButton}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.circleButton}>
          <FavoriteButton isFavorite={favorited} onToggle={() => toggleFavorite(kind, item.id)} onLightSurface={false} size={24} />
        </View>
      </View>

      <ScaleModal visible={scaleModalVisible} onClose={() => setScaleModalVisible(false)} servings={servings} onChange={setServings} />
      <JournalLogModal
        visible={journalModalVisible}
        onClose={() => setJournalModalVisible(false)}
        drinkKind={kind}
        drinkId={item.id}
        drinkName={item.name}
      />
    </Screen>
  );
}

function MetaPill({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.metaPill, { backgroundColor: theme.colors.surfaceAlt }]}>
      <Text variant="captionStrong" color="secondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },
  heroClip: { overflow: 'hidden' },
  stickyBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  stickyTitle: { paddingHorizontal: 64 },
  topControls: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  tagsLine: { marginTop: 4 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  metaPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  description: { marginTop: 16, lineHeight: 22 },
  recipeActionsScroll: { marginTop: 18 },
  recipeActions: { flexDirection: 'row', gap: 10 },
  recipeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  sectionLabel: { marginTop: 28, marginBottom: 12 },
  ingredientList: { gap: 4 },
  ingredientRow: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 8 },
  ingredientAmount: { width: 76 },
  substituteHint: { paddingLeft: 90, paddingBottom: 8, paddingRight: 24 },
  stepList: { gap: 14 },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  glassGarnishRow: { flexDirection: 'row', gap: 32, marginTop: 4 },
  glassGarnishItem: { flex: 1 },
  relatedSection: { marginTop: 32, gap: 12 },
  relatedTitle: { paddingHorizontal: 20 },
  notFound: { paddingHorizontal: 20 },
});
