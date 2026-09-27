import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../src/i18n/useTranslation';
import { Button } from '../src/ui/components/Button';
import { FormField } from '../src/ui/components/FormField';
import { Screen } from '../src/ui/components/Screen';
import { Text } from '../src/ui/components/Text';
import { useAuthStore } from '../src/state/authStore';
import { useTheme } from '../src/theme/useTheme';

/**
 * "Forgot password" — email in, reset link out. Always shows the SAME
 * "check your email" outcome regardless of whether the address is
 * actually registered (Supabase's resetPasswordForEmail itself never
 * reveals that — see SupabaseAuthBackend.requestPasswordReset), except
 * for the one genuinely different, honest case: the local dev backend has
 * no email capability at all, so it says so plainly instead of pretending
 * to have sent something.
 */
export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [notAvailable, setNotAvailable] = useState(false);

  const canSubmit = email.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const result = await requestPasswordReset(email.trim());
    setSubmitting(false);
    if (!result.ok && result.error === 'not-supported-offline') {
      setNotAvailable(true);
      return;
    }
    // Every other outcome — including a real failure like a rate limit —
    // still shows the same "check your email" state. A user who mistyped
    // their email, or whose email isn't registered, gets no signal that
    // distinguishes their case from a real send; that's deliberate
    // anti-enumeration behavior, not a bug swallowing the error.
    setSent(true);
  };

  if (sent) {
    return (
      <Screen>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.centerWrap}>
          <Ionicons name="mail-outline" size={32} color={theme.colors.accent} />
          <Text variant="title" style={styles.centerTitle}>
            {t('auth.forgotPasswordSentTitle')}
          </Text>
          <Text variant="body" color="secondary" style={styles.centerMessage}>
            {t('auth.forgotPasswordSentMessage', { email: email.trim() })}
          </Text>
          <Button label={t('auth.backToSignIn')} onPress={() => router.back()} style={{ marginTop: 24 }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
          <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="title">{t('auth.forgotPasswordTitle')}</Text>
          <Text variant="body" color="secondary" style={styles.intro}>
            {t('auth.forgotPasswordIntro')}
          </Text>

          <FormField
            label={t('auth.emailLabel')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.emailPlaceholder')}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
          />

          {notAvailable ? (
            <Text variant="caption" color="secondary" style={{ color: theme.colors.danger }}>
              {t('auth.forgotPasswordNotAvailableOffline')}
            </Text>
          ) : null}

          <Button label={t('auth.forgotPasswordAction')} onPress={handleSubmit} disabled={!canSubmit} style={{ marginTop: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  content: { paddingHorizontal: 20, gap: 16, flexGrow: 1 },
  intro: { lineHeight: 20 },
  centerWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  centerTitle: { marginTop: 16, textAlign: 'center' },
  centerMessage: { marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
