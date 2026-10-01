import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { reportError } from '../../lib/crashReporting';
import { recordCrash } from '../../lib/deviceDiagnostics';
import { uiDictionaries } from '../../i18n/dictionaries';
import { translateFrom } from '../../i18n/translate';
import { useLocaleStore } from '../../state/localeStore';

/**
 * Reads the current locale via the store's plain `getState()` (not the
 * `useTranslation()` hook — hooks don't work inside a class component's
 * render, which an error boundary must be) and resolves through the same
 * defensive `translateFrom` the rest of the app uses, which returns the raw
 * key rather than throwing if anything is ever missing. Wrapped in a
 * try/catch anyway: this fallback must render something reasonable even if
 * the store itself is somehow implicated in the crash it's catching.
 */
function safeT(key: string): string {
  try {
    const locale = useLocaleStore.getState().locale;
    return translateFrom(uiDictionaries[locale], key);
  } catch {
    return translateFrom(uiDictionaries.en, key);
  }
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** A short label identifying which part of the tree this boundary guards, shown only in __DEV__ for faster triage. */
  boundaryName?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * A React error boundary catches render-phase exceptions in its subtree and
 * shows a recoverable screen instead of letting the whole app crash — in
 * React Native, an uncaught render error otherwise tears down the entire JS
 * tree (a "tap something, the app closes" crash). This is deliberately a
 * plain class component with hardcoded colors, not `useTheme()` — the
 * fallback UI must never depend on the same providers/state that might have
 * caused the crash it's catching.
 *
 * One instance wraps the whole app (see app/_layout.tsx); screens that
 * render risky per-item content (e.g. a list of cards, each doing its own
 * data lookups) can wrap an additional boundary around just that section so
 * one bad item degrades gracefully instead of blanking the whole screen.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    recordCrash(error, false, 'boundary'); // TEMPORARY device diagnostics
    reportError(error, { boundary: this.props.boundaryName ?? 'unnamed', componentStack: info.componentStack ?? undefined });
  }

  handleReset = () => {
    // Navigate home first — clearing the error alone would just re-render the
    // same crashed route with the same bad state/params and likely crash again.
    try {
      router.replace('/');
    } catch {
      // Navigation itself can't throw in practice, but this boundary must never crash while recovering from a crash.
    }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <Ionicons name="alert-circle-outline" size={32} color="#8A5A2B" />
          </View>
          <Text style={styles.title}>{safeT('errorBoundary.title')}</Text>
          <Text style={styles.message}>{safeT('errorBoundary.message')}</Text>
          <Pressable
            onPress={this.handleReset}
            style={styles.button}
            accessibilityRole="button"
            accessibilityLabel={safeT('errorBoundary.tryAgain')}
          >
            <Text style={styles.buttonText}>{safeT('errorBoundary.tryAgain')}</Text>
          </Pressable>
          {__DEV__ ? <Text style={styles.devDetail}>{this.state.error.message}</Text> : null}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    backgroundColor: '#FAF6F0',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0E6D8',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#2A2420', textAlign: 'center', marginBottom: 6 },
  message: { fontSize: 14, color: '#5C5650', textAlign: 'center', lineHeight: 20 },
  button: { marginTop: 20, backgroundColor: '#8A5A2B', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14 },
  buttonText: { color: '#FBF1E4', fontSize: 15, fontWeight: '600' },
  devDetail: { marginTop: 16, fontSize: 11, color: '#8A5A2B', textAlign: 'center' },
});
