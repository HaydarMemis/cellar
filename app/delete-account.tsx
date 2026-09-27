import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authBackend, socialAuthProvider } from '../src/data/community';
import { useTranslation } from '../src/i18n/useTranslation';
import { Button } from '../src/ui/components/Button';
import { Screen } from '../src/ui/components/Screen';
import { Text } from '../src/ui/components/Text';
import { useAuthStore } from '../src/state/authStore';
import { useFavoritesStore } from '../src/state/favoritesStore';
import { useInventoryStore } from '../src/state/inventoryStore';
import { useJournalStore } from '../src/state/journalStore';
import { useRecipesStore } from '../src/state/recipesStore';
import { useShoppingListStore } from '../src/state/shoppingListStore';
import { useTheme } from '../src/theme/useTheme';

export default function DeleteAccountScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const reassignRecipes = useRecipesStore((s) => s.reassignOwnerToGuestAndPrivatize);
  const reassignFavorites = useFavoritesStore((s) => s.reassignOwnerToGuest);
  const reassignInventory = useInventoryStore((s) => s.reassignOwnerToGuest);
  const reassignJournal = useJournalStore((s) => s.reassignOwnerToGuest);
  const reassignShoppingList = useShoppingListStore((s) => s.reassignOwnerToGuest);

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!profile) {
    router.back();
    return null;
  }

  const canConfirm = confirmText.trim().toLowerCase() === profile.username.toLowerCase();

  const handleDelete = async () => {
    if (!canConfirm || deleting) return;
    setDeleting(true);
    try {
      // Apple requires Sign in with Apple tokens to be revoked when an
      // account is deleted: accounts linked to Apple re-confirm with Apple
      // here so the Edge Function can revoke the grant.
      let appleAuthorizationCode: string | null = null;
      const providers = (await authBackend.getSignInProviders?.().catch(() => [])) ?? [];
      if (providers.includes('apple') && socialAuthProvider.getAppleAuthorizationCode) {
        appleAuthorizationCode = await socialAuthProvider.getAppleAuthorizationCode();
        if (!appleAuthorizationCode) {
          Alert.alert(t('deleteAccount.appleConfirmTitle'), t('deleteAccount.appleConfirmMessage'));
          return;
        }
      }
      // The backend deletion runs first and must succeed before anything on
      // this device is touched; only then is local, account-scoped data
      // re-homed to the guest identity (see useAuthStore.deleteAccount).
      await deleteAccount(async (deletedUserId) => {
        await Promise.all([
          reassignRecipes(deletedUserId),
          reassignFavorites(deletedUserId),
          reassignInventory(deletedUserId),
          reassignJournal(deletedUserId),
          reassignShoppingList(deletedUserId),
        ]);
      }, { appleAuthorizationCode });
      // No explicit router.back() here: `profile` is now null, and the
      // `if (!profile)` guard at the top of this component already closes
      // the screen on that re-render — navigating here too popped twice.
    } catch {
      // Nothing local was changed — the account and its on-device data are
      // exactly as they were. Say so, and let the user retry.
      Alert.alert(t('deleteAccount.failedTitle'), t('deleteAccount.failedMessage'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
          <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Ionicons name="warning-outline" size={26} color={theme.colors.danger} />
        </View>
        <Text variant="title">{t('deleteAccount.title')}</Text>
        <Text variant="body" color="secondary" style={styles.intro}>
          {t('deleteAccount.intro')}
        </Text>

        <InfoBlock title={t('deleteAccount.whatDeletesTitle')} body={t('deleteAccount.whatDeletesBody')} />
        <InfoBlock title={t('deleteAccount.publicRecipesTitle')} body={t('deleteAccount.publicRecipesBody')} />
        <InfoBlock title={t('deleteAccount.localDataTitle')} body={t('deleteAccount.localDataBody')} />

        <Text variant="captionStrong" color="secondary" style={styles.confirmLabel}>
          {t('deleteAccount.confirmInstruction', { username: profile.username })}
        </Text>
        <TextInput
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={t('deleteAccount.confirmPlaceholder')}
          placeholderTextColor={theme.colors.textTertiary}
          autoCapitalize="none"
          style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary }]}
        />

        <Button
          label={deleting ? t('common.saving') : t('deleteAccount.confirmButton')}
          onPress={handleDelete}
          disabled={!canConfirm || deleting}
          style={{ ...styles.deleteButton, backgroundColor: theme.colors.danger }}
        />
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('deleteAccount.cancelButton')}
          style={styles.cancelRow}
          hitSlop={8}
        >
          <Text variant="captionStrong" color="accent">
            {t('deleteAccount.cancelButton')}
          </Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text variant="bodyStrong">{title}</Text>
      <Text variant="caption" color="secondary" style={styles.infoBody}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  intro: { marginTop: 8, lineHeight: 20 },
  infoBlock: { marginTop: 22 },
  infoBody: { marginTop: 4, lineHeight: 19 },
  confirmLabel: { marginTop: 28, marginBottom: 10 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 46 },
  deleteButton: { marginTop: 24 },
  cancelRow: { alignItems: 'center', marginTop: 16, minHeight: 32, justifyContent: 'center' },
});
