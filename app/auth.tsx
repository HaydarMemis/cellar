import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isSupabaseConfigured, supabaseKeyKind } from '../src/data/supabase/client';
import { AUTH_DIAGNOSTICS_ENABLED, INVALID_SUPABASE_KEY_REFERENCE, takeAuthDiagnostic, takeErrorDetailLine } from '../src/lib/authDiagnostics';
import { accountsAvailable, AuthErrorCode, socialAuthProvider } from '../src/data/community';
import { useTranslation } from '../src/i18n/useTranslation';
import { RESEND_COOLDOWN_MS, resendFeedback, resendSecondsLeft } from '../src/ui/auth/resendConfirmation';
import { Button } from '../src/ui/components/Button';
import { FormField } from '../src/ui/components/FormField';
import { Screen } from '../src/ui/components/Screen';
import { Text } from '../src/ui/components/Text';
import { useAuthStore } from '../src/state/authStore';
import { useTheme } from '../src/theme/useTheme';

const errorKeys: Record<AuthErrorCode, string> = {
  'username-taken': 'errorUsernameTaken',
  'email-taken': 'errorEmailTaken',
  'invalid-username': 'errorInvalidUsername',
  'invalid-email': 'errorInvalidEmail',
  'invalid-password': 'errorInvalidPassword',
  'weak-password': 'errorWeakPassword',
  'not-found': 'errorNotFound',
  'wrong-password': 'errorWrongPassword',
  'email-not-confirmed': 'errorEmailNotConfirmed',
  'rate-limited': 'errorRateLimited',
  'network-error': 'errorNetworkError',
  'email-send-failed': 'errorEmailSendFailed',
  unknown: 'errorUnknown',
};

type Mode = 'signIn' | 'signUp' | 'pendingConfirmation';

/**
 * Appends the failure's error reference (every build) or, in a TEMPORARY
 * diagnostics build (src/lib/authDiagnostics.ts), the full sanitized
 * provider error to a user-facing message.
 */
function withDiagnostic(message: string, t: (key: 'common.errorReference', options: { code: string }) => string): string {
  // Shown in EVERY build: with a malformed key every Supabase request is a 401 "Invalid API key".
  const config =
    supabaseKeyKind !== 'invalid'
      ? null
      : AUTH_DIAGNOSTICS_ENABLED
        ? '[diag] config · EXPO_PUBLIC_SUPABASE_ANON_KEY is not a valid Supabase key format'
        : t('common.errorReference', { code: INVALID_SUPABASE_KEY_REFERENCE });
  const detail = takeErrorDetailLine((code) => t('common.errorReference', { code }));
  return [message, config, detail].filter(Boolean).join('\n\n');
}

export default function AuthScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const signUp = useAuthStore((s) => s.signUp);
  const logIn = useAuthStore((s) => s.logIn);
  const resendConfirmationEmail = useAuthStore((s) => s.resendConfirmationEmail);

  // `/auth?mode=signUp` opens straight on account creation (Profile's
  // "Create account"); everything else starts on sign-in.
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'signUp' ? 'signUp' : 'signIn');
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [resending, setResending] = useState(false);
  // When the next confirmation email may be requested (see resendConfirmation.ts).
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const resendWait = resendSecondsLeft(resendAvailableAt, now);
  useEffect(() => {
    if (resendWait <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendWait]);

  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    (mode === 'signIn' || (username.trim().length > 0 && displayName.trim().length > 0 && confirmPassword.length > 0)) &&
    !submitting;

  // Only providers that are actually configured for this build get a
  // button — never a "Continue with…" that can only fail.
  const [available, setAvailable] = useState<{ apple: boolean; google: boolean }>({ apple: false, google: false });
  useEffect(() => {
    let cancelled = false;
    Promise.all([socialAuthProvider.isAvailable('apple'), socialAuthProvider.isAvailable('google')])
      .then(([apple, google]) => {
        if (!cancelled) setAvailable({ apple, google });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const socialSignIn = useAuthStore((s) => s.socialSignIn);

  const handleSocialSignIn = async (method: 'apple' | 'google') => {
    if (submittingRef.current) return;
    takeAuthDiagnostic(); // only this attempt's failure may be referenced
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await socialSignIn(method);
      if (result.ok) {
        router.back();
        return;
      }
      if (result.error === 'cancelled') return; // the user changed their mind — not an error to surface
      if (result.error === 'not-configured') {
        Alert.alert(t('auth.socialNotConfiguredTitle'), t(method === 'apple' ? 'auth.socialNotConfiguredAppleMessage' : 'auth.socialNotConfiguredGoogleMessage'));
        return;
      }
      Alert.alert(t('auth.socialFailedTitle'), withDiagnostic(t(result.error === 'network' ? 'auth.errorNetworkError' : 'auth.socialFailedMessage'), t));
    } catch {
      Alert.alert(t('auth.socialFailedTitle'), t('auth.socialFailedMessage'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    // Ref, not just `submitting` state: two taps in one frame both see the
    // old state and would create/sign in twice.
    if (submittingRef.current) return;
    takeAuthDiagnostic(); // only this attempt's failure may be referenced
    if (mode === 'signUp' && password !== confirmPassword) {
      setError(t('auth.errorPasswordMismatch'));
      return;
    }
    submittingRef.current = true;
    setError(null);
    setSubmitting(true);
    let result: Awaited<ReturnType<typeof logIn>> | Awaited<ReturnType<typeof signUp>>;
    try {
      result =
        mode === 'signIn'
          ? await logIn({ email: email.trim(), password })
          : await signUp({ username: username.trim(), displayName: displayName.trim(), email: email.trim(), password });
    } catch {
      // An unexpected throw (not a mapped auth error) must never leave the
      // form stuck in its "submitting" state.
      result = { ok: false, error: 'network-error' };
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }

    if (result.ok === true) {
      router.back();
      return;
    }
    if (result.ok === 'pending-confirmation') {
      setPendingEmail(result.email);
      // Sign-up just sent the confirmation email: an immediate resend would
      // only be refused by Supabase's per-address window.
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
      setMode('pendingConfirmation');
      return;
    }
    if (result.error === 'email-not-confirmed') {
      // Take them straight to the "check your inbox" screen, which can resend the link.
      setPendingEmail(email.trim().toLowerCase());
      setMode('pendingConfirmation');
      return;
    }
    setError(withDiagnostic(t(`auth.${errorKeys[result.error]}` as never), t));
  };

  const handleResend = async () => {
    if (!pendingEmail || resending || resendSecondsLeft(resendAvailableAt, Date.now()) > 0) return;
    setResending(true);
    let result: Awaited<ReturnType<typeof resendConfirmationEmail>>;
    try {
      result = await resendConfirmationEmail(pendingEmail);
    } catch {
      result = { ok: false, error: 'network-error' };
    } finally {
      setResending(false);
    }
    const feedback = resendFeedback(result);
    if (feedback.startCooldown) {
      setResendAvailableAt(Date.now() + RESEND_COOLDOWN_MS);
      setNow(Date.now());
    }
    const message = t(feedback.messageKey);
    Alert.alert(t(feedback.titleKey), result.ok || feedback.startCooldown ? message : withDiagnostic(message, t));
  };

  if (!accountsAvailable) {
    return (
      <Screen>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.pendingWrap}>
          <Ionicons name="cloud-offline-outline" size={32} color={theme.colors.textSecondary} />
          <Text variant="title" style={styles.pendingTitle}>
            {t('auth.accountsUnavailableTitle')}
          </Text>
          <Text variant="body" color="secondary" style={styles.pendingMessage}>
            {t('auth.accountsUnavailableMessage')}
          </Text>
        </View>
      </Screen>
    );
  }

  if (mode === 'pendingConfirmation' && pendingEmail) {
    return (
      <Screen>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.pendingWrap}>
          <Ionicons name="mail-outline" size={32} color={theme.colors.accent} />
          <Text variant="title" style={styles.pendingTitle}>
            {t('auth.pendingConfirmationTitle')}
          </Text>
          <Text variant="body" color="secondary" style={styles.pendingMessage}>
            {t('auth.pendingConfirmationMessage', { email: pendingEmail })}
          </Text>
          <Text variant="caption" color="tertiary" style={styles.pendingMessage}>
            {t('auth.pendingConfirmationHint')}
          </Text>
          <Button
            label={
              resending
                ? t('common.saving')
                : resendWait > 0
                  ? t('auth.resendConfirmationWait', { seconds: resendWait })
                  : t('auth.resendConfirmationAction')
            }
            variant="secondary"
            onPress={handleResend}
            disabled={resending || resendWait > 0}
            style={{ marginTop: 24 }}
          />
          <Button label={t('auth.backToSignIn')} onPress={() => setMode('signIn')} style={{ marginTop: 12 }} />
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
        <Text variant="title">{mode === 'signIn' ? t('auth.signInTitle') : t('auth.signUpTitle')}</Text>

        {(available.apple || available.google) && (
          <>
        <View style={styles.socialColumn}>
          {available.apple && (
            // Apple's own button (App Store Review Guideline 4.8 / Human
            // Interface Guidelines): system-drawn label, logo and localization.
            <View pointerEvents={submitting ? 'none' : 'auto'} style={{ opacity: submitting ? 0.5 : 1 }}>
              <AppleAuthentication.AppleAuthenticationButton
                key={`${mode}-${theme.scheme}`}
                buttonType={
                  mode === 'signUp'
                    ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                    : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  theme.scheme === 'dark'
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={12}
                style={styles.appleButton}
                onPress={() => handleSocialSignIn('apple')}
              />
            </View>
          )}
          {available.google && (
          <Pressable
            onPress={() => handleSocialSignIn('google')}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={t('auth.continueWithGoogle')}
            style={[styles.socialButton, { opacity: submitting ? 0.5 : 1, backgroundColor: theme.colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border }]}
          >
            <Ionicons name="logo-google" size={18} color={theme.colors.textPrimary} />
            <Text variant="bodyStrong">{t('auth.continueWithGoogle')}</Text>
          </Pressable>
          )}
        </View>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          <Text variant="caption" color="tertiary">
            {t('auth.orDivider')}
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
        </View>
          </>
        )}

        {mode === 'signUp' && (
          <FormField
            label={t('auth.usernameLabel')}
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase())}
            placeholder={t('auth.usernamePlaceholder')}
            autoCapitalize="none"
          />
        )}

        {mode === 'signUp' && (
          <FormField label={t('auth.displayNameLabel')} value={displayName} onChangeText={setDisplayName} placeholder={t('auth.displayNamePlaceholder')} />
        )}

        <FormField
          label={t('auth.emailLabel')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('auth.emailPlaceholder')}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />

        <FormField
          label={t('auth.passwordLabel')}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
        />

        {mode === 'signUp' && (
          <FormField
            label={t('auth.confirmPasswordLabel')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
        )}

        {mode === 'signIn' && isSupabaseConfigured && (
          <Pressable
            onPress={() => router.push('/forgot-password')}
            accessibilityRole="button"
            style={styles.forgotPasswordRow}
            hitSlop={8}
          >
            <Text variant="captionStrong" color="accent">
              {t('auth.forgotPasswordLink')}
            </Text>
          </Pressable>
        )}

        {error ? (
          <Text variant="caption" color="secondary" style={{ color: theme.colors.danger }}>
            {error}
          </Text>
        ) : null}

        {mode === 'signUp' && (
          <View style={{ gap: 6 }}>
            <Text variant="caption" color="tertiary" style={styles.legalNote}>
              {t('auth.legalConsentNote')}
            </Text>
            <View style={styles.legalLinks}>
              <Pressable onPress={() => router.push('/legal/terms')} accessibilityRole="link" hitSlop={6}>
                <Text variant="captionStrong" color="accent">{t('premium.termsLink')}</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/legal/privacy')} accessibilityRole="link" hitSlop={6}>
                <Text variant="captionStrong" color="accent">{t('premium.privacyLink')}</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/legal/community-guidelines')} accessibilityRole="link" hitSlop={6}>
                <Text variant="captionStrong" color="accent">{t('profile.communityGuidelinesRow')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Button label={mode === 'signIn' ? t('auth.signInAction') : t('auth.signUpAction')} onPress={handleSubmit} disabled={!canSubmit} />

        <Pressable
          onPress={() => {
            setError(null);
            setConfirmPassword('');
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          }}
          accessibilityRole="button"
          accessibilityLabel={mode === 'signIn' ? t('auth.switchToSignUp') : t('auth.switchToSignIn')}
          style={styles.switchRow}
          hitSlop={8}
        >
          <Text variant="captionStrong" color="accent">
            {mode === 'signIn' ? t('auth.switchToSignUp') : t('auth.switchToSignIn')}
          </Text>
        </Pressable>

        {!isSupabaseConfigured && (
          <Text variant="caption" color="tertiary" style={styles.note}>
            {t('auth.localAccountNote')}
          </Text>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  switchRow: { alignItems: 'center', marginTop: 4, minHeight: 32, justifyContent: 'center' },
  forgotPasswordRow: { alignItems: 'flex-end', minHeight: 24, marginTop: -8 },
  note: { textAlign: 'center', marginTop: 12, lineHeight: 18 },
  legalNote: { textAlign: 'center', lineHeight: 16 },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 14 },
  socialColumn: { gap: 10 },
  appleButton: { width: '100%', height: 48 },
  socialButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 48, borderRadius: 12 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  pendingWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  pendingTitle: { marginTop: 16, textAlign: 'center' },
  pendingMessage: { marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
