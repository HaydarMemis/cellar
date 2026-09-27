/**
 * Dynamic layer over app.json (Expo passes app.json in as `config`).
 * Only adds native config plugins whose values are account-specific and come
 * from the build environment (EAS environment variables) — nothing secret is
 * hardcoded here.
 *
 * - Google Sign-In (iOS): the native SDK needs the REVERSED iOS client id as
 *   a URL scheme in Info.plist. Set EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME
 *   (e.g. com.googleusercontent.apps.1234-abcd). Without it, the Google
 *   button is simply not shown on iOS (see SupabaseSocialAuthProvider).
 * - Sentry: source-map upload during EAS builds when SENTRY_ORG and
 *   SENTRY_PROJECT are set (plus the SENTRY_AUTH_TOKEN secret). Crash
 *   reporting itself only needs EXPO_PUBLIC_SENTRY_DSN at runtime.
 */
module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];

  const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  if (googleIosUrlScheme) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }]);
  }

  if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
    plugins.push(['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }]);
  }

  return { ...config, plugins };
};
