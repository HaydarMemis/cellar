import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../src/i18n/useTranslation';
import { Avatar } from '../src/ui/components/Avatar';
import { Button } from '../src/ui/components/Button';
import { Screen } from '../src/ui/components/Screen';
import { SectionLabel } from '../src/ui/components/SectionLabel';
import { Text } from '../src/ui/components/Text';
import { useAuthStore } from '../src/state/authStore';
import { useTheme } from '../src/theme/useTheme';

const BIO_MAX_LENGTH = 160;

export default function EditProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);

  if (!profile) {
    router.back();
    return null;
  }

  const trimmedName = displayName.trim();
  const canSave = trimmedName.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await updateProfile({ displayName: trimmedName, bio: bio.trim() || undefined });
    setSaving(false);
    router.back();
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </Pressable>
          <Text variant="title">{t('editProfile.title')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarRow}>
            <Avatar seed={profile.id} label={trimmedName || profile.displayName} size={72} />
          </View>

          <SectionLabel style={styles.label}>{t('editProfile.displayNameLabel')}</SectionLabel>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('editProfile.displayNamePlaceholder')}
            placeholderTextColor={theme.colors.textTertiary}
            maxLength={40}
            returnKeyType="next"
            style={[styles.input, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary }]}
          />

          <SectionLabel style={styles.label}>{t('editProfile.bioLabel')}</SectionLabel>
          <TextInput
            value={bio}
            onChangeText={(text) => setBio(text.slice(0, BIO_MAX_LENGTH))}
            placeholder={t('editProfile.bioPlaceholder')}
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            maxLength={BIO_MAX_LENGTH}
            style={[styles.input, styles.bioInput, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary }]}
          />
          <Text variant="caption" color="tertiary" style={styles.charCount}>
            {t('editProfile.charCount', { count: bio.length, max: BIO_MAX_LENGTH })}
          </Text>

          <Button
            label={saving ? t('common.saving') : t('editProfile.save')}
            onPress={handleSave}
            disabled={!canSave}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  avatarRow: { alignItems: 'center', marginBottom: 28 },
  label: { marginTop: 20, marginBottom: 10 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 46 },
  bioInput: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { textAlign: 'right', marginTop: 6 },
  saveButton: { marginTop: 32 },
});
