import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, FlatList, RefreshControlProps, StyleSheet, useWindowDimensions } from 'react-native';
import { DuplicateReportError } from '../../data/community';
import { ReportRateLimitedError, ReportTargetUnavailableError } from '../../data/supabase/SupabaseModerationBackend';
import { isSupabaseConfigured } from '../../data/supabase/client';
import { PersonalRecipe, UserProfile } from '../../domain/types';
import { useTranslation } from '../../i18n/useTranslation';
import { useAuthStore } from '../../state/authStore';
import { useCommunityStore } from '../../state/communityStore';
import { useFavoritesStore } from '../../state/favoritesStore';
import { useModerationStore } from '../../state/moderationStore';
import { RecipeFeedCard } from './RecipeFeedCard';
import { ReportModal } from './ReportModal';

export interface RecipeFeedRowProps {
  recipes: PersonalRecipe[];
  creatorsById: Map<string, UserProfile>;
  /** 'row' (default): a horizontal carousel. 'grid': a vertical two-column list for full-screen feeds (see app/community.tsx). */
  layout?: 'row' | 'grid';
  onEndReached?: () => void;
  ListFooterComponent?: React.ReactElement | null;
  ListHeaderComponent?: React.ReactElement | null;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function RecipeFeedRow({ recipes, creatorsById, layout = 'row', onEndReached, ListFooterComponent, ListHeaderComponent, refreshControl }: RecipeFeedRowProps) {
  const { width: screenWidth } = useWindowDimensions();
  const gridCardWidth = Math.floor((screenWidth - 20 * 2 - 14) / 2);
  const router = useRouter();
  const { t } = useTranslation();
  const myUserId = useAuthStore((s) => s.profile?.id ?? null);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const likeCounts = useCommunityStore((s) => s.likeCounts);
  const likedByMe = useCommunityStore((s) => s.likedByMe);
  const toggleLike = useCommunityStore((s) => s.toggleLike);
  const report = useModerationStore((s) => s.report);

  const [reportTarget, setReportTarget] = useState<PersonalRecipe | null>(null);

  const requireSignIn = () => {
    Alert.alert(t('publish.signInRequiredTitle'), t('publish.signInRequiredMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('publish.signInAction'), onPress: () => router.push('/auth') },
    ]);
  };

  const handleToggleLike = (recipeId: string) => {
    if (!myUserId) {
      requireSignIn();
      return;
    }
    toggleLike(recipeId, myUserId);
  };

  const handleReportPress = (recipe: PersonalRecipe) => {
    if (!myUserId) {
      requireSignIn();
      return;
    }
    setReportTarget(recipe);
  };

  const handleSubmitReport = async (reason: Parameters<typeof report>[3], details: string | undefined) => {
    if (!myUserId || !reportTarget) return;
    try {
      await report(myUserId, 'recipe', reportTarget.id, reason, details);
      Alert.alert(
        isSupabaseConfigured ? t('moderation.reportSubmittedRemoteTitle') : t('moderation.reportSubmittedLocalTitle'),
        isSupabaseConfigured ? t('moderation.reportSubmittedRemoteMessage') : t('moderation.reportSubmittedLocalMessage'),
      );
    } catch (e) {
      if (e instanceof DuplicateReportError) {
        Alert.alert(t('moderation.reportAlreadyOpenTitle'), t('moderation.reportAlreadyOpenMessage'));
      } else if (e instanceof ReportTargetUnavailableError) {
        Alert.alert(t('moderation.reportTargetUnavailableTitle'), t('moderation.reportTargetUnavailableMessage'));
      } else if (e instanceof ReportRateLimitedError) {
        Alert.alert(t('moderation.reportRateLimitedTitle'), t('moderation.reportRateLimitedMessage'));
      } else {
        Alert.alert(t('moderation.reportFailedTitle'), t('moderation.reportFailedMessage'));
      }
    }
  };

  return (
    <>
      <FlatList
        key={layout}
        horizontal={layout === 'row'}
        numColumns={layout === 'grid' ? 2 : undefined}
        columnWrapperStyle={layout === 'grid' ? styles.gridRow : undefined}
        data={recipes}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={layout === 'grid' ? styles.gridContent : styles.content}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        ListFooterComponent={ListFooterComponent}
        ListHeaderComponent={ListHeaderComponent}
        refreshControl={refreshControl}
        renderItem={({ item }) => (
          <RecipeFeedCard
            width={layout === 'grid' ? gridCardWidth : undefined}
            recipe={item}
            author={creatorsById.get(item.ownerId)}
            likeCount={likeCounts[item.id] ?? 0}
            isLiked={likedByMe.has(item.id)}
            onToggleLike={() => handleToggleLike(item.id)}
            isFavorite={isFavorite('recipe', item.id)}
            onToggleFavorite={() => toggleFavorite('recipe', item.id)}
            onPress={() => router.push({ pathname: '/cocktail/[id]', params: { id: item.id, type: 'recipe' } })}
            onOpenCreator={() => router.push({ pathname: '/creator/[id]', params: { id: item.ownerId } })}
            onReport={() => handleReportPress(item)}
          />
        )}
      />
      <ReportModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetLabel={reportTarget ? t('moderation.reportRecipe') + ': ' + reportTarget.name : ''}
        onSubmit={handleSubmitReport}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingHorizontal: 20 },
  gridContent: { gap: 14, paddingHorizontal: 20, paddingBottom: 40 },
  gridRow: { gap: 14 },
});
