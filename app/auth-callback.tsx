import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from '../src/i18n/useTranslation';
import { Button } from '../src/ui/components/Button';
import { Screen } from '../src/ui/components/Screen';
import { Text } from '../src/ui/components/Text';
import { useAuthStore } from '../src/state/authStore';
import { useTheme } from '../src/theme/useTheme';

type CallbackState = 'checking' | 'signed-in' | 'needs-sign-in';

/**
 * Where the sign-up confirmation email's link lands
 * (cellar://auth-callback#access_token=…&refresh_token=…&type=signup — see
 * SupabaseAuthBackend.emailConfirmationRedirectUrl). The account is already
 * confirmed server-side by the time the app opens; this screen turns the
 * link's tokens into a session so the person lands signed in, with their
 * profile created from the username they chose at sign-up.
 *
 * If the link carries no usable tokens (expired, opened on another device,
 * or the redirect URL isn't allow-listed so Supabase fell back to the Site
 * URL), nothing is faked: the person is told their email may already be
 * confirmed and offered the normal sign-in.
 */
export default function AuthCallbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const establishSessionFromUrl = useAuthStore((s) => s.confirmPasswordResetSession);
  const load = useAuthStore((s) => s.load);

  const liveUrl = Linking.useLinkingURL();
  const [coldStartUrl, setColdStartUrl] = useState<string | null>(null);
  const incomingUrl = liveUrl ?? coldStartUrl;
  const [state, setState] = useState<CallbackState>('checking');

  useEffect(() => {
    if (liveUrl) return;
    Linking.getInitialURL().then((initial) => {
      if (initial) setColdStartUrl(initial);
    });
  }, [liveUrl]);

  useEffect(() => {
    if (!incomingUrl) return;
    let cancelled = false;
    establishSessionFromUrl(incomingUrl)
      .then(async (ok) => {
        if (ok) await load();
        return ok && !!useAuthStore.getState().profile;
      })
      .catch(() => false)
      .then((signedIn) => {
        if (!cancelled) setState(signedIn ? 'signed-in' : 'needs-sign-in');
      });
    return () => {
      cancelled = true;
    };
  }, [incomingUrl, establishSessionFromUrl, load]);

  // Never trap the user on a spinner if no URL ever arrives.
  useEffect(() => {
    const timeout = setTimeout(() => setState((current) => (current === 'checking' ? 'needs-sign-in' : current)), 8000);
    return () => clearTimeout(timeout);
  }, []);

  if (state === 'checking') {
    return (
      <Screen>
        <View style={styles.centerWrap}>
          <ActivityIndicator color={theme.colors.textSecondary} />
        </View>
      </Screen>
    );
  }

  const signedIn = state === 'signed-in';
  return (
    <Screen>
      <View style={styles.centerWrap}>
        <Ionicons name={signedIn ? 'checkmark-circle-outline' : 'mail-open-outline'} size={32} color={theme.colors.accent} />
        <Text variant="title" style={styles.centerTitle}>
          {t(signedIn ? 'auth.confirmedTitle' : 'auth.confirmLinkUnusableTitle')}
        </Text>
        <Text variant="body" color="secondary" style={styles.centerMessage}>
          {t(signedIn ? 'auth.confirmedMessage' : 'auth.confirmLinkUnusableMessage')}
        </Text>
        <Button
          label={t(signedIn ? 'common.done' : 'auth.signInAction')}
          // dismissTo, not replace: the link usually arrives while the
          // sign-up "check your email" modal is still open underneath —
          // replace would leave that stale screen in the stack behind the app.
          onPress={() => (signedIn ? router.dismissTo('/(tabs)') : router.replace('/auth'))}
          style={{ marginTop: 24 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  centerTitle: { marginTop: 16, textAlign: 'center' },
  centerMessage: { marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
