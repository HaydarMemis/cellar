import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authBackend } from '../src/data/community';
import { useTranslation } from '../src/i18n/useTranslation';
import { Button } from '../src/ui/components/Button';
import { Screen } from '../src/ui/components/Screen';
import { SectionLabel } from '../src/ui/components/SectionLabel';
import { Text } from '../src/ui/components/Text';
import { useAuthStore } from '../src/state/authStore';
import { useTheme } from '../src/theme/useTheme';

export default function AccountSecurityScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const logOut = useAuthStore((s) => s.logOut);

  const [email, setEmail] = useState<string | null | 'loading'>('loading');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authBackend.getCurrentUserEmail().then(setEmail);
  }, []);

  if (!profile) {
    router.back();
    return null;
  }

  const canSave = newPassword.trim().length >= 6 && !saving;

  const handleChangePassword = async () => {
    if (!canSave) return;
    setSaving(true);
    const result = await updatePassword(newPassword.trim());
    setSaving(false);
    if (result.ok) {
      setNewPassword('');
      Alert.alert(t('accountSecurity.passwordChangedTitle'), t('accountSecurity.passwordChangedMessage'));
    } else {
      const messages: Partial<Record<typeof result.error, string>> = {
        'reauthentication-needed': t('accountSecurity.reauthenticationNeededMessage'),
        'same-password': t('accountSecurity.samePasswordMessage'),
        'weak-password': t('auth.errorWeakPassword'),
        'rate-limited': t('auth.errorRateLimited'),
        'network-error': t('auth.errorNetworkError'),
      };
      Alert.alert(t('accountSecurity.passwordChangeFailedTitle'), messages[result.error] ?? t('accountSecurity.passwordChangeFailedMessage'));
    }
  };

  const handleSignOut = () => {
    Alert.alert(t('profile.signOutConfirmTitle'), t('profile.signOutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: () => { logOut(); router.back(); } },
    ]);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
          </Pressable>
          <Text variant="title">{t('accountSecurity.title')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionLabel style={styles.label}>{t('accountSecurity.signedInAsLabel')}</SectionLabel>
          <View style={[styles.readonlyCard, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Text variant="bodyStrong">{profile.displayName}</Text>
            <Text variant="caption" color="secondary">
              {t('profile.handleFormat', { username: profile.username })}
            </Text>
            <Text variant="caption" color="secondary" style={styles.emailText}>
              {email === 'loading' ? t('common.loading') : (email ?? t('accountSecurity.emailUnavailable'))}
            </Text>
          </View>

          <SectionLabel style={styles.label}>{t('accountSecurity.changePasswordLabel')}</SectionLabel>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('accountSecurity.newPasswordPlaceholder')}
            placeholderTextColor={theme.colors.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleChangePassword}
            style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary }]}
          />
          <Button
            label={saving ? t('common.saving') : t('accountSecurity.changePasswordAction')}
            onPress={handleChangePassword}
            disabled={!canSave}
            variant="secondary"
            style={styles.changePasswordButton}
          />

          <Pressable onPress={handleSignOut} accessibilityRole="button" style={styles.signOutRow} hitSlop={8}>
            <Text variant="captionStrong" color="accent">
              {t('profile.signOut')}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  label: { marginTop: 24, marginBottom: 10 },
  readonlyCard: { borderRadius: 14, padding: 16, gap: 4 },
  emailText: { marginTop: 4 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 46 },
  changePasswordButton: { marginTop: 14 },
  signOutRow: { alignItems: 'center', marginTop: 32, minHeight: 32, justifyContent: 'center' },
});
