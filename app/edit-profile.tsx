import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, AlertButton, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { takeAuthDiagnostic, takeErrorDetailLine } from '../src/lib/authDiagnostics';
import { AvatarError, AvatarErrorCode, isAvatarUploadAvailable } from '../src/data/supabase/avatarUpload';
import { UiKey, useTranslation } from '../src/i18n/useTranslation';
import { Avatar } from '../src/ui/components/Avatar';
import { Button } from '../src/ui/components/Button';
import { Screen } from '../src/ui/components/Screen';
import { SectionLabel } from '../src/ui/components/SectionLabel';
import { Text } from '../src/ui/components/Text';
import { useAuthStore } from '../src/state/authStore';
import { useTheme } from '../src/theme/useTheme';

const BIO_MAX_LENGTH = 160;
const AVATAR_SIZE = 72;

const PHOTO_ERROR_MESSAGE_KEYS: Record<AvatarErrorCode, UiKey> = {
  offline: 'editProfile.photoErrorOffline',
  'too-large': 'editProfile.photoErrorTooLarge',
  'processing-failed': 'editProfile.photoErrorProcessing',
  'upload-failed': 'editProfile.photoErrorUpload',
  'not-available': 'editProfile.photoErrorUnavailable',
};

export default function EditProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const setAvatarPhoto = useAuthStore((s) => s.setAvatarPhoto);
  const removeAvatarPhoto = useAuthStore((s) => s.removeAvatarPhoto);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  if (!profile) {
    router.back();
    return null;
  }

  // Profile photos are shown to OTHER people, so they need the real backend
  // (public Storage). The on-device dev backend has no honest equivalent —
  // the avatar simply isn't tappable there (monogram only).
  const photoAvailable = isAvatarUploadAvailable();

  const trimmedName = displayName.trim();
  const canSave = trimmedName.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await updateProfile({ displayName: trimmedName, bio: bio.trim() || undefined });
    setSaving(false);
    router.back();
  };

  const showPhotoError = (titleKey: UiKey, error: unknown) => {
    const code: AvatarErrorCode = error instanceof AvatarError ? error.code : 'upload-failed';
    // Error reference (step-status-code, no sensitive detail) so a failure on
    // a device can be traced in Supabase → Logs; full detail in diagnostics builds.
    const detail = takeErrorDetailLine((ref) => t('common.errorReference', { code: ref }));
    Alert.alert(t(titleKey), [t(PHOTO_ERROR_MESSAGE_KEYS[code]), detail].filter(Boolean).join('\n\n'));
  };

  const choosePhoto = async () => {
    // Same as the recipe editor: the system photo picker (PHPicker on iOS,
    // the Android Photo Picker) runs out of process and only hands back the
    // chosen photo — no photo-library permission, and no camera (blocked in
    // app.json).
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: true,
        aspect: [1, 1],
      });
    } catch {
      Alert.alert(t('editProfile.photoPickerFailedTitle'), t('editProfile.photoPickerFailedMessage'));
      return;
    }
    const asset = !result.canceled ? result.assets[0] : undefined;
    if (!asset) return;
    takeAuthDiagnostic(); // start clean: only this attempt's failure may be shown
    setPhotoBusy(true);
    try {
      await setAvatarPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
    } catch (e) {
      showPhotoError('editProfile.photoErrorTitle', e);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await removeAvatarPhoto();
    } catch (e) {
      showPhotoError('editProfile.removePhotoErrorTitle', e);
    } finally {
      setPhotoBusy(false);
    }
  };

  const openPhotoOptions = () => {
    if (photoBusy) return;
    const buttons: AlertButton[] = [{ text: t('editProfile.choosePhoto'), onPress: () => void choosePhoto() }];
    if (profile.avatarUrl) buttons.push({ text: t('editProfile.removePhoto'), style: 'destructive', onPress: () => void removePhoto() });
    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(t('editProfile.photoOptionsTitle'), t('editProfile.photoOptionsMessage'), buttons);
  };

  const avatar = <Avatar seed={profile.id} label={trimmedName || profile.displayName} size={AVATAR_SIZE} uri={profile.avatarUrl} />;

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
            {photoAvailable ? (
              <Pressable
                onPress={openPhotoOptions}
                disabled={photoBusy}
                accessibilityRole="button"
                accessibilityLabel={t('editProfile.changePhoto')}
                accessibilityState={{ busy: photoBusy, disabled: photoBusy }}
                hitSlop={8}
              >
                {avatar}
                {photoBusy ? (
                  <View style={[styles.busyOverlay, { borderRadius: AVATAR_SIZE / 2 }]} accessibilityLabel={t('editProfile.photoUploading')}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={[styles.cameraBadge, { backgroundColor: theme.colors.accent, borderColor: theme.colors.background }]}>
                    <Ionicons name="camera" size={13} color={theme.colors.onAccent} />
                  </View>
                )}
              </Pressable>
            ) : (
              avatar
            )}
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
  busyOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: 20, marginBottom: 10 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 46 },
  bioInput: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { textAlign: 'right', marginTop: 6 },
  saveButton: { marginTop: 32 },
});
