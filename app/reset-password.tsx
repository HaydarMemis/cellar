import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../src/i18n/useTranslation';
import { Button } from '../src/ui/components/Button';
import { FormField } from '../src/ui/components/FormField';
import { Screen } from '../src/ui/components/Screen';
import { Text } from '../src/ui/components/Text';
import { useAuthStore } from '../src/state/authStore';
import { useTheme } from '../src/theme/useTheme';

type SessionState = 'checking' | 'valid' | 'invalid';

/**
 * Where a Supabase password-recovery email link lands
 * (cellar://reset-password?access_token=...&refresh_token=..., built by
 * SupabaseAuthBackend.requestPasswordReset's redirectTo). Handles both a
 * cold start (the app wasn't running — Linking.getInitialURL()) and the
 * app already being open (Linking.useLinkingURL()), since either is
 * possible depending on whether the user tapped the link from their mail
 * app with Cellar already backgrounded or not.
 */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const confirmPasswordResetSession = useAuthStore((s) => s.confirmPasswordResetSession);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const load = useAuthStore((s) => s.load);

  const liveUrl = Linking.useLinkingURL();
  // Only ever set from the async getInitialURL() branch below — when
  // liveUrl is already present, it's used directly (see incomingUrl),
  // never mirrored into a second piece of state just to unify them
  // synchronously in an effect.
  const [coldStartUrl, setColdStartUrl] = useState<string | null>(null);
  const incomingUrl = liveUrl ?? coldStartUrl;

  const [sessionState, setSessionState] = useState<SessionState>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (liveUrl) return; // already have a URL reactively — nothing to fetch
    Linking.getInitialURL().then((initial) => {
      if (initial) setColdStartUrl(initial);
    });
  }, [liveUrl]);

  useEffect(() => {
    if (!incomingUrl) return;
    let cancelled = false;
    confirmPasswordResetSession(incomingUrl)
      .then(async (ok) => {
        // A valid recovery link REPLACES whatever session this device had
        // (possibly a different account). Sync the app's signed-in identity
        // to it right away, so abandoning this screen can never leave the
        // UI showing account A while the backend session is account B.
        if (ok) await load();
        return ok;
      })
      .then((ok) => {
        if (!cancelled) setSessionState(ok ? 'valid' : 'invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [incomingUrl, confirmPasswordResetSession, load]);

  // A real, if generous, fallback: if no URL ever arrives (e.g. this
  // screen is somehow reached without one), stop showing "checking"
  // forever — see the auth-lifecycle audit's splash/loading-state
  // guidance: never trap the user on a loading state indefinitely.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSessionState((current) => (current === 'checking' ? 'invalid' : current));
    }, 8000);
    return () => clearTimeout(timeout);
  }, []);

  const canSubmit = password.length >= 6 && password === confirmPassword && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (!result.ok) {
      setError(t(`auth.${result.error === 'weak-password' ? 'errorWeakPassword' : result.error === 'rate-limited' ? 'errorRateLimited' : result.error === 'network-error' ? 'errorNetworkError' : 'errorUnknown'}` as never));
      return;
    }
    await load(); // picks up the now-authenticated profile from the session updatePassword just confirmed
    setSuccess(true);
  };

  if (success) {
    return (
      <Screen>
        <View style={styles.centerWrap}>
          <Ionicons name="checkmark-circle-outline" size={32} color={theme.colors.accent} />
          <Text variant="title" style={styles.centerTitle}>
            {t('auth.resetPasswordSuccessTitle')}
          </Text>
          <Text variant="body" color="secondary" style={styles.centerMessage}>
            {t('auth.resetPasswordSuccessMessage')}
          </Text>
          <Button label={t('common.done')} onPress={() => router.dismissTo('/(tabs)')} style={{ marginTop: 24 }} />
        </View>
      </Screen>
    );
  }

  if (sessionState === 'checking') {
    return (
      <Screen>
        <View style={styles.centerWrap}>
          <Text variant="body" color="secondary">
            {t('common.loading')}
          </Text>
        </View>
      </Screen>
    );
  }

  if (sessionState === 'invalid') {
    return (
      <Screen>
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={32} color={theme.colors.danger} />
          <Text variant="title" style={styles.centerTitle}>
            {t('auth.resetPasswordLinkInvalidTitle')}
          </Text>
          <Text variant="body" color="secondary" style={styles.centerMessage}>
            {t('auth.resetPasswordLinkInvalidMessage')}
          </Text>
          <Button label={t('auth.forgotPasswordTitle')} onPress={() => router.replace('/forgot-password')} style={{ marginTop: 24 }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]} keyboardShouldPersistTaps="handled">
          <Text variant="title">{t('auth.resetPasswordTitle')}</Text>
          <Text variant="body" color="secondary" style={styles.intro}>
            {t('auth.resetPasswordIntro')}
          </Text>

          <FormField
            label={t('auth.passwordLabel')}
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.passwordPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="next"
          />
          <FormField
            label={t('auth.passwordLabel')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('auth.passwordPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {error ? (
            <Text variant="caption" color="secondary" style={{ color: theme.colors.danger }}>
              {error}
            </Text>
          ) : null}

          <Button
            label={submitting ? t('common.saving') : t('auth.resetPasswordAction')}
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16, flexGrow: 1 },
  intro: { lineHeight: 20 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  centerTitle: { marginTop: 16, textAlign: 'center' },
  centerMessage: { marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
