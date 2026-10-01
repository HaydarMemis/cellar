import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ingredients } from '../../src/data/catalog';
import { authBackend, remoteRecipeBackend } from '../../src/data/community';
import { supabaseKeyKind } from '../../src/data/supabase/client';
import { INVALID_SUPABASE_KEY_REFERENCE } from '../../src/lib/authDiagnostics';
import { getSpiritGroup, SpiritGroup, spiritGroupIds } from '../../src/domain/spiritGroups';
import { UserProfile } from '../../src/domain/types';
import { useTranslation } from '../../src/i18n/useTranslation';
import { AdSlot } from '../../src/ui/components/AdSlot';
import { EmptyState } from '../../src/ui/components/EmptyState';
import { RecipeFeedRow } from '../../src/ui/components/RecipeFeedRow';
import { Screen } from '../../src/ui/components/Screen';
import { SectionHeader } from '../../src/ui/components/SectionHeader';
import { Text } from '../../src/ui/components/Text';
import { useAuthStore } from '../../src/state/authStore';
import { useCommunityStore } from '../../src/state/communityStore';
import { useDiscoverFeedStore } from '../../src/state/discoverFeedStore';
import { useModerationStore } from '../../src/state/moderationStore';
import { useRecipesStore } from '../../src/state/recipesStore';
import { useTheme } from '../../src/theme/useTheme';

const homemadeIngredients = ingredients.filter((i) => i.isHomemade);

/**
 * "Discover" — the social/community destination, distinct from "Search"
 * (the catalog-browsing tab). Shows real published recipes only: no
 * fabricated trending/popularity, honest empty states for a fresh
 * community. Sections that would almost always be empty in a small
 * community (per-taste, seasonal, etc.) were deliberately left out in favor
 * of a smaller set that stays meaningful at any community size — see the
 * phase report for the full reasoning.
 */
export default function DiscoverScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, tVocab, tIngredient } = useTranslation();
  const myUserId = useAuthStore((s) => s.profile?.id ?? null);
  const recipes = useRecipesStore((s) => s.recipes);
  const refreshLikes = useCommunityStore((s) => s.refreshLikes);
  const blockedByMe = useModerationStore((s) => s.blockedByMe);
  const refreshBlocked = useModerationStore((s) => s.refreshBlocked);

  const [creatorsById, setCreatorsById] = useState<Map<string, UserProfile>>(new Map());
  const remoteFeed = useDiscoverFeedStore((s) => s.recipes);
  const loadRemoteFeed = useDiscoverFeedStore((s) => s.load);

  useEffect(() => {
    refreshBlocked(myUserId);
  }, [myUserId, refreshBlocked]);

  // With a real backend, the community feed comes from the `recipes` table —
  // this device's own store only ever holds recipes created HERE, so it can
  // never show anyone else's work. Without a backend, the local store stays
  // the source, exactly as before (see discoverFeedStore).
  // Refreshed on every focus (not just first mount), so a recipe you just
  // published — or unpublished — is reflected when you come back here.
  useFocusEffect(
    useCallback(() => {
      loadRemoteFeed();
    }, [loadRemoteFeed]),
  );
  const feedIsLoading = useDiscoverFeedStore((s) => s.isLoading);
  const feedHasError = useDiscoverFeedStore((s) => s.hasError);
  const feedErrorReference = useDiscoverFeedStore((s) => s.errorReference);

  // Blocking is client-side content filtering layered on top of whichever
  // source is active (the database also enforces it for *interactions* — see
  // migration 20260925120000) — a blocked creator's recipes are hidden from
  // every section below.
  const publicRecipes = useMemo(() => {
    const source = remoteRecipeBackend ? remoteFeed : recipes.filter((r) => r.visibility === 'public');
    return source.filter((r) => !blockedByMe.has(r.ownerId));
  }, [remoteFeed, recipes, blockedByMe]);

  useEffect(() => {
    // Fetch only the authors this feed actually needs, not every profile
    // in the community (getAllProfiles is bounded to 200 rows, but that
    // still doesn't scale — a feed of a handful of recipes has no reason
    // to pull hundreds of unrelated profiles once this is backed by a
    // real, growing user base).
    const ownerIds = Array.from(new Set(publicRecipes.map((r) => r.ownerId)));
    // getProfilesByIds([]) resolves to [] (see AuthBackend.ts) — no need
    // to special-case the empty-owner-ids branch with a synchronous
    // setState here, which the lint rule (rightly) flags as a cascading-
    // render risk; letting it go through the same async path keeps this
    // effect to one clear responsibility.
    authBackend
      .getProfilesByIds(ownerIds)
      .then((profiles) => setCreatorsById(new Map(profiles.map((p) => [p.id, p]))))
      .catch(() => undefined); // creator names are optional decoration; the feed still renders
  }, [publicRecipes]);

  useEffect(() => {
    if (publicRecipes.length > 0) refreshLikes(publicRecipes.map((r) => r.id), myUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicRecipes.length, myUserId]);

  const likeCounts = useCommunityStore((s) => s.likeCounts);

  const newRecipes = useMemo(
    () => [...publicRecipes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 12),
    [publicRecipes],
  );

  const communityPicks = useMemo(
    () =>
      publicRecipes
        .filter((r) => (likeCounts[r.id] ?? 0) > 0)
        .sort((a, b) => (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0))
        .slice(0, 12),
    [publicRecipes, likeCounts],
  );

  const easyToMake = useMemo(() => publicRecipes.filter((r) => r.difficulty === 'easy').slice(0, 12), [publicRecipes]);
  const alcoholFree = useMemo(() => publicRecipes.filter((r) => r.baseSpirit === 'alcohol-free').slice(0, 12), [publicRecipes]);

  const bySpiritGroup = useMemo(() => {
    const groups = new Map<SpiritGroup, typeof publicRecipes>();
    for (const group of spiritGroupIds) {
      if (group === 'alcohol-free') continue;
      const inGroup = publicRecipes.filter((r) => getSpiritGroup(r.baseSpirit) === group);
      if (inGroup.length > 0) groups.set(group, inGroup);
    }
    return groups;
  }, [publicRecipes]);

  const isEmpty = publicRecipes.length === 0;
  // An empty feed has three honest meanings with a backend: still loading,
  // the request failed, or the community genuinely has nothing yet — only
  // the last one may say "be the first to publish".
  const showInitialSpinner = !!remoteRecipeBackend && isEmpty && feedIsLoading;
  const showLoadError = !!remoteRecipeBackend && isEmpty && feedHasError && !feedIsLoading;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text variant="title">{t('discover.title')}</Text>
        <Text variant="body" color="secondary">
          {t('discover.subtitle')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          remoteRecipeBackend ? (
            <RefreshControl refreshing={feedIsLoading && !isEmpty} onRefresh={loadRemoteFeed} tintColor={theme.colors.textSecondary} />
          ) : undefined
        }
      >
        {showInitialSpinner ? (
          <View style={styles.spinnerWrap}>
            <ActivityIndicator color={theme.colors.textSecondary} />
          </View>
        ) : showLoadError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title={t('discover.loadFailedTitle')}
            message={[
              t('discover.loadFailedMessage'),
              t('common.errorReference', { code: supabaseKeyKind === 'invalid' ? INVALID_SUPABASE_KEY_REFERENCE : (feedErrorReference ?? 'discover') }),
            ].join('\n\n')}
            actionLabel={t('common.tryAgain')}
            onAction={loadRemoteFeed}
          />
        ) : isEmpty ? (
          <EmptyState
            icon="people-outline"
            title={t('discover.emptyFeedTitle')}
            message={t('discover.emptyFeedMessage')}
            actionLabel={t('discover.publishFirstAction')}
            onAction={() => router.push('/my-bar')}
          />
        ) : (
          <View style={{ gap: 28 }}>
            <Section
              title={t('discover.sectionNewRecipes')}
              actionLabel={remoteRecipeBackend ? t('discover.seeAll') : undefined}
              onAction={remoteRecipeBackend ? () => router.push('/community') : undefined}
            >
              <RecipeFeedRow recipes={newRecipes} creatorsById={creatorsById} />
            </Section>

            {communityPicks.length > 0 && (
              <Section title={t('discover.sectionCommunityPicks')}>
                <RecipeFeedRow recipes={communityPicks} creatorsById={creatorsById} />
              </Section>
            )}

            {easyToMake.length > 0 && (
              <Section title={t('discover.sectionEasyToMake')}>
                <RecipeFeedRow recipes={easyToMake} creatorsById={creatorsById} />
              </Section>
            )}

            {alcoholFree.length > 0 && (
              <Section title={t('discover.sectionAlcoholFree')}>
                <RecipeFeedRow recipes={alcoholFree} creatorsById={creatorsById} />
              </Section>
            )}

            {Array.from(bySpiritGroup.entries()).map(([group, groupRecipes]) => (
              <Section key={group} title={t('discover.sectionBySpirit', { spirit: tVocab(`spiritGroup.${group}`) })}>
                <RecipeFeedRow recipes={groupRecipes} creatorsById={creatorsById} />
              </Section>
            ))}

            <View style={{ paddingHorizontal: 20 }}>
              <Text variant="caption" color="tertiary">
                {t('discover.curatedNote')}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.homemadeSection}>
          <SectionHeader title={t('discover.sectionHomemadeIngredients')} />
          <Text variant="caption" color="secondary" style={styles.homemadeSubtitle}>
            {t('discover.homemadeIngredientsSubtitle')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.homemadeRow}>
            {homemadeIngredients.map((ingredient) => (
              <Pressable
                key={ingredient.id}
                onPress={() => router.push({ pathname: '/ingredient/[id]', params: { id: ingredient.id } })}
                accessibilityRole="button"
                accessibilityLabel={tIngredient(ingredient.id)}
                style={[styles.homemadeCard, { backgroundColor: theme.colors.surfaceAlt }]}
              >
                <Text variant="bodyStrong" numberOfLines={2}>
                  {tIngredient(ingredient.id)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.adWrap}>
          <AdSlot placement="discoverFeed" />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children, actionLabel, onAction }: { title: string; children: React.ReactNode; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={{ gap: 12 }}>
      <SectionHeader title={title} actionLabel={actionLabel} onAction={onAction} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 4 },
  content: { paddingBottom: 40, gap: 28 },
  homemadeSection: { gap: 10, marginTop: 4 },
  homemadeSubtitle: { paddingHorizontal: 20, marginTop: -6 },
  homemadeRow: { gap: 12, paddingHorizontal: 20 },
  homemadeCard: { width: 140, height: 72, borderRadius: 14, padding: 12, justifyContent: 'center' },
  adWrap: { paddingHorizontal: 20, marginTop: 8 },
  spinnerWrap: { paddingVertical: 48, alignItems: 'center' },
});
