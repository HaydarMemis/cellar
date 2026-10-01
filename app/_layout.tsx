import { Ionicons } from '@expo/vector-icons';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initCrashReporting, reportError } from '../src/lib/crashReporting';
import { formatCrash, installCrashRecorder, setDiagnosticsRoute, takeUnshownCrash } from '../src/lib/deviceDiagnostics';
import { ErrorBoundary } from '../src/ui/components/ErrorBoundary';
import { BackgroundSync } from '../src/ui/components/BackgroundSync';
import { LocalDataAdoptionPrompt } from '../src/ui/components/LocalDataAdoptionPrompt';
import { Screen } from '../src/ui/components/Screen';
import { hydrateStores } from '../src/state/hydrate';
import { useOnboardingStore } from '../src/state/onboardingStore';
import { useTheme } from '../src/theme/useTheme';

initCrashReporting();
// TEMPORARY device diagnostics (see src/lib/deviceDiagnostics.ts): records a
// crash's error + route to a local file before the app's normal crash handling.
installCrashRecorder();

function RootNavigator() {
  const theme = useTheme();
  const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);

  // TEMPORARY device diagnostics: route PATTERN only ("cocktail/[id]"), never params.
  const segments = useSegments();
  const routePattern = segments.join('/');
  useEffect(() => {
    setDiagnosticsRoute(`/${routePattern}`);
  }, [routePattern]);
  // TEMPORARY: show the previous session's crash once, so it can be reported.
  useEffect(() => {
    const crash = takeUnshownCrash();
    if (crash) Alert.alert('Cellar diagnostics — previous crash', formatCrash(crash));
  }, []);

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <ErrorBoundary boundaryName="root">
        {/*
          Onboarding is shown once, on a genuinely first launch — never an
          auth gate (the app underneath is never blocked; this just makes
          sure a brand-new install's very first screen is the onboarding
          Stack.Screen below, not straight into Home). The Stack itself
          always mounts with every route registered, including
          "onboarding" — Redirect just navigates within it, so completing
          onboarding (or an already-onboarded relaunch) resolves to the
          normal (tabs) tree with no separate branch to keep in sync.
        */}
        {!hasCompletedOnboarding && <Redirect href="/onboarding" />}
        <LocalDataAdoptionPrompt />
        <BackgroundSync />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="cocktail/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="ingredient/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="collection/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="browse/[dimension]" options={{ presentation: 'card' }} />
          <Stack.Screen name="creator/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="community" options={{ presentation: 'card' }} />
          <Stack.Screen name="recipe-editor" options={{ presentation: 'modal' }} />
          <Stack.Screen name="filters" options={{ presentation: 'modal' }} />
          <Stack.Screen name="ingredients-i-have" options={{ presentation: 'card' }} />
          <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
          <Stack.Screen name="forgot-password" options={{ presentation: 'modal' }} />
          <Stack.Screen name="reset-password" options={{ presentation: 'modal' }} />
          <Stack.Screen name="auth-callback" options={{ presentation: 'modal' }} />
          <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
          <Stack.Screen name="shopping-list" options={{ presentation: 'modal' }} />
          <Stack.Screen name="delete-account" options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="account-security" options={{ presentation: 'card' }} />
          <Stack.Screen name="blocked-users" options={{ presentation: 'card' }} />
          <Stack.Screen name="legal/privacy" options={{ presentation: 'card' }} />
          <Stack.Screen name="legal/terms" options={{ presentation: 'card' }} />
          <Stack.Screen name="legal/community-guidelines" options={{ presentation: 'card' }} />
        </Stack>
      </ErrorBoundary>
    </>
  );
}

/**
 * Store hydration from AsyncStorage is normally near-instant, so this isn't
 * a spinner (one would just flash) — it's a static brand mark that fills
 * the same space the app renders into a moment later, avoiding a stark
 * blank frame on a slower first launch.
 */
function BootFallback() {
  const theme = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="wine-outline" size={40} color={theme.colors.accentSoft} />
      </View>
    </Screen>
  );
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // hydrateStores never waits on the network indefinitely (see
    // bootTimeouts) — a signed-in user starts from their cached identity
    // and anything slower completes after the first render.
    hydrateStores()
      .catch((e) => reportError(e, { module: 'RootLayout', action: 'hydrateStores' }))
      .finally(() => setIsReady(true));
  }, []);

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <BootFallback />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
