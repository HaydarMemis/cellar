import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authBackend } from '../src/data/community';
import { UserProfile } from '../src/domain/types';
import { useTranslation } from '../src/i18n/useTranslation';
import { Avatar } from '../src/ui/components/Avatar';
import { EmptyState } from '../src/ui/components/EmptyState';
import { Screen } from '../src/ui/components/Screen';
import { Text } from '../src/ui/components/Text';
import { useAuthStore } from '../src/state/authStore';
import { useModerationStore } from '../src/state/moderationStore';
import { useTheme } from '../src/theme/useTheme';

export default function BlockedUsersScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const myUserId = useAuthStore((s) => s.profile?.id ?? null);
  const blockedByMe = useModerationStore((s) => s.blockedByMe);
  const refreshBlocked = useModerationStore((s) => s.refreshBlocked);
  const toggleBlock = useModerationStore((s) => s.toggleBlock);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    refreshBlocked(myUserId);
  }, [myUserId, refreshBlocked]);

  useEffect(() => {
    // getProfilesByIds([]) already resolves to [] (see AuthBackend), so
    // there's no empty-array special case to short-circuit synchronously.
    authBackend.getProfilesByIds(Array.from(blockedByMe)).then(setProfiles);
  }, [blockedByMe]);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text variant="title">{t('blockedUsers.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={profiles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Avatar seed={item.id} label={item.displayName} size={40} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{item.displayName}</Text>
              <Text variant="caption" color="secondary">
                {t('profile.handleFormat', { username: item.username })}
              </Text>
            </View>
            <Pressable
              onPress={() => myUserId && toggleBlock(item.id, myUserId)}
              accessibilityRole="button"
              accessibilityLabel={t('creatorProfile.unblockUser', { name: item.displayName })}
              hitSlop={8}
            >
              <Text variant="captionStrong" color="accent">
                {t('blockedUsers.unblockAction')}
              </Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState icon="shield-checkmark-outline" title={t('blockedUsers.emptyTitle')} message={t('blockedUsers.emptyMessage')} />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  content: { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 14 },
});
