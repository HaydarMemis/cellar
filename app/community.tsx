import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authBackend } from '../src/data/community';
import { UserProfile } from '../src/domain/types';
import { useTranslation } from '../src/i18n/useTranslation';
import { EmptyState } from '../src/ui/components/EmptyState';
import { RecipeFeedRow } from '../src/ui/components/RecipeFeedRow';
import { Screen } from '../src/ui/components/Screen';
import { Text } from '../src/ui/components/Text';
import { useAuthStore } from '../src/state/authStore';
import { useCommunityStore } from '../src/state/communityStore';
import { useDiscoverFeedStore } from '../src/state/discoverFeedStore';
import { useModerationStore } from '../src/state/moderationStore';
import { useTheme } from '../src/theme/useTheme';

/**
 * Every published community recipe, newest first, paginated from the
 * backend (Discover itself shows only the latest page, split into sections).
 * Blocked creators are filtered out here as everywhere else.
 */
export default function CommunityFeedScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const myUserId = useAuthStore((s) => s.profile?.id ?? null);
  const recipes = useDiscoverFeedStore((s) => s.recipes);
  const isLoading = useDiscoverFeedStore((s) => s.isLoading);
  const hasError = useDiscoverFeedStore((s) => s.hasError);
  const nextCursor = useDiscoverFeedStore((s) => s.nextCursor);
  const load = useDiscoverFeedStore((s) => s.load);
  const loadMore = useDiscoverFeedStore((s) => s.loadMore);
  const blockedByMe = useModerationStore((s) => s.blockedByMe);
  const refreshLikes = useCommunityStore((s) => s.refreshLikes);
  const [creatorsById, setCreatorsById] = useState<Map<string, UserProfile>>(new Map());

  const visible = useMemo(() => recipes.filter((r) => !blockedByMe.has(r.ownerId)), [recipes, blockedByMe]);

  useEffect(() => {
    if (recipes.length === 0) load();
  }, [recipes.length, load]);

  // Owners already asked for — a profile the backend doesn't return (deleted
  // account, network error answered with []) must not be re-requested on every
  // render: each response creates a new Map, which re-ran this effect forever.
  const requestedCreatorIds = useRef(new Set<string>());
  useEffect(() => {
    const missing = Array.from(new Set(visible.map((r) => r.ownerId))).filter(
      (id) => !creatorsById.has(id) && !requestedCreatorIds.current.has(id),
    );
    if (missing.length === 0) return;
    missing.forEach((id) => requestedCreatorIds.current.add(id));
    authBackend
      .getProfilesByIds(missing)
      .then((profiles) =>
        setCreatorsById((prev) => {
          const next = new Map(prev);
          for (const p of profiles) next.set(p.id, p);
          return next;
        }),
      )
      .catch(() => undefined);
  }, [visible, creatorsById]);

  useEffect(() => {
    if (visible.length > 0) refreshLikes(visible.map((r) => r.id), myUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length, myUserId]);

  const footer =
    isLoading && recipes.length > 0 ? (
      <View style={styles.footer}>
        <ActivityIndicator color={theme.colors.textSecondary} />
      </View>
    ) : hasError && recipes.length > 0 ? (
      <Pressable onPress={nextCursor ? loadMore : load} style={styles.footer} accessibilityRole="button">
        <Text variant="captionStrong" color="accent">
          {t('common.tryAgain')}
        </Text>
      </Pressable>
    ) : null;

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text variant="headline">{t('discover.communityTitle')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {visible.length === 0 ? (
        isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.textSecondary} />
          </View>
        ) : hasError ? (
          <EmptyState icon="cloud-offline-outline" title={t('discover.loadFailedTitle')} message={t('discover.loadFailedMessage')} actionLabel={t('common.tryAgain')} onAction={load} />
        ) : (
          <EmptyState icon="people-outline" title={t('discover.emptyFeedTitle')} message={t('discover.emptyFeedMessage')} />
        )
      ) : (
        <RecipeFeedRow
          layout="grid"
          recipes={visible}
          creatorsById={creatorsById}
          onEndReached={() => {
            if (nextCursor && !isLoading && !hasError) loadMore();
          }}
          ListFooterComponent={footer}
          refreshControl={<RefreshControl refreshing={isLoading && recipes.length > 0 && !nextCursor} onRefresh={load} tintColor={theme.colors.textSecondary} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingVertical: 24, alignItems: 'center' },
});
