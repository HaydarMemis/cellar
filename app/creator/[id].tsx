import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authBackend, DuplicateReportError, remoteRecipeBackend } from '../../src/data/community';
import { isSupabaseConfigured } from '../../src/data/supabase/client';
import { PersonalRecipe, UserProfile } from '../../src/domain/types';
import { useTranslation } from '../../src/i18n/useTranslation';
import { Avatar } from '../../src/ui/components/Avatar';
import { EmptyState } from '../../src/ui/components/EmptyState';
import { RecipeFeedRow } from '../../src/ui/components/RecipeFeedRow';
import { ReportModal } from '../../src/ui/components/ReportModal';
import { Screen } from '../../src/ui/components/Screen';
import { SectionLabel } from '../../src/ui/components/SectionLabel';
import { Text } from '../../src/ui/components/Text';
import { useAuthStore } from '../../src/state/authStore';
import { useCommunityStore } from '../../src/state/communityStore';
import { useDiscoverFeedStore } from '../../src/state/discoverFeedStore';
import { useModerationStore } from '../../src/state/moderationStore';
import { useRecipesStore } from '../../src/state/recipesStore';
import { useTheme } from '../../src/theme/useTheme';

export default function CreatorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const myUserId = useAuthStore((s) => s.profile?.id ?? null);
  const recipes = useRecipesStore((s) => s.recipes);
  const refreshFollowState = useCommunityStore((s) => s.refreshFollowState);
  const toggleFollow = useCommunityStore((s) => s.toggleFollow);
  const followCounts = useCommunityStore((s) => s.followCountsByUser[id]);
  const isFollowing = useCommunityStore((s) => s.followingByMe.has(id));
  const refreshBlocked = useModerationStore((s) => s.refreshBlocked);
  const toggleBlock = useModerationStore((s) => s.toggleBlock);
  const report = useModerationStore((s) => s.report);
  const isBlocked = useModerationStore((s) => s.blockedByMe.has(id));

  const [profile, setProfile] = useState<UserProfile | undefined | null>(null);
  const [reportVisible, setReportVisible] = useState(false);

  useEffect(() => {
    authBackend.getProfile(id).then((p) => setProfile(p ?? undefined));
  }, [id]);

  useEffect(() => {
    refreshFollowState(id, myUserId);
  }, [id, myUserId, refreshFollowState]);

  useEffect(() => {
    refreshBlocked(myUserId);
  }, [myUserId, refreshBlocked]);

  // With a real backend, a creator's published recipes live in the
  // `recipes` table — this device's store only has recipes created HERE, so
  // reading it (what this screen used to do unconditionally) showed an empty
  // profile for every other creator. First page only (50): enough for a
  // profile screen; a "load more" can come later without changing this shape.
  const rememberRemote = useDiscoverFeedStore((s) => s.remember);
  const [remoteRecipes, setRemoteRecipes] = useState<{ ownerId: string; recipes: PersonalRecipe[] } | null>(null);
  useEffect(() => {
    if (!remoteRecipeBackend || !id) return;
    let cancelled = false;
    remoteRecipeBackend
      .fetchRecipesByOwner(id, null, 50)
      .then((page) => {
        if (cancelled) return;
        rememberRemote(page.recipes);
        setRemoteRecipes({ ownerId: id, recipes: page.recipes });
      })
      .catch(() => {
        // Already reported by the backend; keep showing whatever we had.
      });
    return () => {
      cancelled = true;
    };
  }, [id, rememberRemote]);

  const publicRecipes = useMemo(() => {
    if (remoteRecipeBackend) return remoteRecipes?.ownerId === id ? remoteRecipes.recipes : [];
    return recipes.filter((r) => r.ownerId === id && r.visibility === 'public');
  }, [recipes, id, remoteRecipes]);

  const creatorsById = useMemo(() => (profile ? new Map([[profile.id, profile]]) : new Map()), [profile]);

  if (profile === undefined) {
    return (
      <Screen>
        <View style={[styles.notFound, { paddingTop: insets.top + 40 }]}>
          <Text variant="headline">{t('creatorProfile.notFound')}</Text>
        </View>
      </Screen>
    );
  }

  const isSelf = myUserId === id;

  const handleBlockToggle = () => {
    if (!myUserId || !profile) return;
    if (isBlocked) {
      toggleBlock(id, myUserId);
      Alert.alert('', t('creatorProfile.unblockedToast', { name: profile.displayName }));
      return;
    }
    Alert.alert(
      t('creatorProfile.blockConfirmTitle', { name: profile.displayName }),
      t('creatorProfile.blockConfirmMessage'),
      [
        { text: t('moderation.cancel'), style: 'cancel' },
        {
          text: t('creatorProfile.blockUser', { name: profile.displayName }),
          style: 'destructive',
          onPress: () => {
            toggleBlock(id, myUserId);
            Alert.alert('', t('creatorProfile.blockedToast', { name: profile.displayName }));
          },
        },
      ],
    );
  };

  const handleMoreActions = () => {
    if (!myUserId || !profile) return;
    Alert.alert(t('creatorProfile.moreActions'), undefined, [
      { text: t('moderation.cancel'), style: 'cancel' },
      { text: t('moderation.reportUser', { name: profile.displayName }), onPress: () => setReportVisible(true) },
      {
        text: isBlocked ? t('creatorProfile.unblockUser', { name: profile.displayName }) : t('creatorProfile.blockUser', { name: profile.displayName }),
        style: 'destructive',
        onPress: handleBlockToggle,
      },
    ]);
  };

  const handleSubmitReport = async (reason: Parameters<typeof report>[3], details: string | undefined) => {
    if (!myUserId) return;
    try {
      await report(myUserId, 'user', id, reason, details);
      Alert.alert(
        isSupabaseConfigured ? t('moderation.reportSubmittedRemoteTitle') : t('moderation.reportSubmittedLocalTitle'),
        isSupabaseConfigured ? t('moderation.reportSubmittedRemoteMessage') : t('moderation.reportSubmittedLocalMessage'),
      );
    } catch (e) {
      if (e instanceof DuplicateReportError) {
        Alert.alert(t('moderation.reportAlreadyOpenTitle'), t('moderation.reportAlreadyOpenMessage'));
      } else {
        Alert.alert(t('moderation.reportFailedTitle'), t('moderation.reportFailedMessage'));
      }
    }
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        {isSelf ? (
          <Pressable
            onPress={() => router.push('/edit-profile')}
            accessibilityRole="button"
            accessibilityLabel={t('creatorProfile.editProfile')}
            hitSlop={8}
          >
            <Ionicons name="pencil-outline" size={22} color={theme.colors.textPrimary} />
          </Pressable>
        ) : myUserId ? (
          <Pressable
            onPress={handleMoreActions}
            accessibilityRole="button"
            accessibilityLabel={t('creatorProfile.moreActions')}
            hitSlop={8}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>

      {profile ? (
        <ReportModal
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          targetLabel={t('moderation.reportUser', { name: profile.displayName })}
          onSubmit={handleSubmitReport}
        />
      ) : null}

      <FlatList
        data={publicRecipes.length > 0 ? [{ key: 'recipes' }] : []}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          profile ? (
            <View style={styles.profileHeader}>
              <Avatar seed={profile.id} label={profile.displayName} size={72} />
              <Text variant="title" style={{ marginTop: 12 }}>
                {profile.displayName}
              </Text>
              <Text variant="body" color="secondary">
                {t('profile.handleFormat', { username: profile.username })}
              </Text>
              {profile.bio ? (
                <Text variant="body" color="secondary" style={styles.bio}>
                  {profile.bio}
                </Text>
              ) : null}
              <View style={styles.countsRow}>
                <Text variant="captionStrong" color="secondary">
                  {t('creatorProfile.followersCount', { count: followCounts?.followers ?? 0 })}
                </Text>
                <Text variant="captionStrong" color="secondary">
                  {t('creatorProfile.followingCount', { count: followCounts?.following ?? 0 })}
                </Text>
              </View>
              {!isSelf && myUserId ? (
                <Pressable
                  onPress={() => toggleFollow(id, myUserId)}
                  style={[
                    styles.followButton,
                    { backgroundColor: isFollowing ? theme.colors.surfaceAlt : theme.colors.accent },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isFollowing }}
                >
                  <Text variant="captionStrong" color={isFollowing ? 'primary' : 'onAccent'}>
                    {isFollowing ? t('creatorProfile.unfollow') : t('creatorProfile.follow')}
                  </Text>
                </Pressable>
              ) : null}
              <SectionLabel style={styles.sectionLabel}>{t('creatorProfile.publicRecipesSection')}</SectionLabel>
            </View>
          ) : null
        }
        renderItem={() => <RecipeFeedRow recipes={publicRecipes} creatorsById={creatorsById} />}
        ListEmptyComponent={
          profile ? (
            <EmptyState
              icon="wine-outline"
              title={t('creatorProfile.emptyPublicRecipesTitle')}
              message={t('creatorProfile.emptyPublicRecipesMessage', { name: profile.displayName })}
            />
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  content: { paddingBottom: 40 },
  profileHeader: { paddingHorizontal: 20, alignItems: 'center', gap: 4, marginBottom: 8 },
  bio: { textAlign: 'center', marginTop: 8, lineHeight: 20 },
  countsRow: { flexDirection: 'row', gap: 20, marginTop: 14 },
  followButton: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, minWidth: 120, alignItems: 'center' },
  sectionLabel: { alignSelf: 'flex-start', marginTop: 28, marginBottom: 4 },
  notFound: { paddingHorizontal: 20 },
});
