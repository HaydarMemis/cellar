/**
 * Dynamic layer over app.json (Expo passes app.json in as `config`).
 * Only adds native config plugins whose values are account-specific and come
 * from the build environment (EAS environment variables) — nothing secret is
 * hardcoded here.
 *
 * - Google Sign-In (iOS): the native SDK needs the REVERSED iOS client id as
 *   a URL scheme in Info.plist — if it is missing or different, GIDSignIn
 *   raises an Objective-C exception on signIn() and the whole app dies. The
 *   scheme is therefore DERIVED from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
 *   (1234-abcd.apps.googleusercontent.com → com.googleusercontent.apps.1234-abcd)
 *   so it can never drift from the client id the app configures at runtime.
 *   EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME is no longer needed; if it is still set
 *   and differs, it is ignored with a warning (values are never printed).
 * - Sentry: source-map upload during EAS builds when SENTRY_ORG and
 *   SENTRY_PROJECT are set (plus the SENTRY_AUTH_TOKEN secret). Crash
 *   reporting itself only needs EXPO_PUBLIC_SENTRY_DSN at runtime.
 * - Sign in with Apple (iOS): the native capability is controlled separately
 *   from the in-app feature flag. EXPO_PUBLIC_APPLE_NATIVE_CAPABILITY_ENABLED
 *   =false drops the `com.apple.developer.applesignin` entitlement from the
 *   generated project (no expo-apple-authentication config plugin, no
 *   ios.usesAppleSignIn) — for building on a team that can't provision it
 *   (a personal team outside the Apple Developer Program). Unset or any
 *   other value keeps today's behavior: the entitlement is requested.
 *   The app hides the Apple button whenever the capability is off, even if
 *   EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true (see SupabaseSocialAuthProvider).
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

const APPLE_AUTH_PLUGIN = 'expo-apple-authentication';
const APPLE_SIGN_IN_ENTITLEMENT = 'com.apple.developer.applesignin';

/**
 * Removes the Sign in with Apple entitlement from the generated
 * Cellar.entitlements. Needed in addition to dropping the plugin from
 * `plugins`: expo prebuild auto-applies expo-apple-authentication's config
 * plugin whenever the package is installed (@expo/prebuild-config's
 * versioned SDK plugins), and that plugin adds the entitlement
 * unconditionally.
 */
const withoutAppleSignInEntitlement = (config) =>
  withEntitlementsPlist(config, (c) => {
    delete c.modResults[APPLE_SIGN_IN_ENTITLEMENT];
    return c;
  });

function isAppleNativeCapabilityEnabled(env = process.env) {
  return env.EXPO_PUBLIC_APPLE_NATIVE_CAPABILITY_ENABLED !== 'false';
}

const GOOGLE_CLIENT_SUFFIX = '.apps.googleusercontent.com';

/** "<id>.apps.googleusercontent.com" → "com.googleusercontent.apps.<id>"; null if it isn't an iOS OAuth client id. */
function googleIosUrlSchemeFromClientId(clientId) {
  const id = (clientId ?? '').trim();
  if (!id.endsWith(GOOGLE_CLIENT_SUFFIX)) return null;
  const prefix = id.slice(0, -GOOGLE_CLIENT_SUFFIX.length);
  if (!/^[A-Za-z0-9-]+$/.test(prefix)) return null;
  return `com.googleusercontent.apps.${prefix}`;
}

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

module.exports = ({ config }) => {
  let plugins = [...(config.plugins ?? [])];
  let ios = config.ios;

  if (!isAppleNativeCapabilityEnabled()) {
    plugins = plugins.filter((plugin) => pluginName(plugin) !== APPLE_AUTH_PLUGIN);
    const entitlements = { ...(ios?.entitlements ?? {}) };
    delete entitlements[APPLE_SIGN_IN_ENTITLEMENT];
    ios = { ...ios, usesAppleSignIn: false, entitlements };
    plugins.push(withoutAppleSignInEntitlement);
  }

  const googleIosUrlScheme = googleIosUrlSchemeFromClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  if (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID && !googleIosUrlScheme) {
    console.warn('[Cellar] EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is not an iOS OAuth client id (…apps.googleusercontent.com) — Google Sign-In is not configured for iOS.');
  }
  const legacyScheme = (process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ?? '').trim();
  if (googleIosUrlScheme && legacyScheme && legacyScheme !== googleIosUrlScheme) {
    console.warn('[Cellar] EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME does not match the reversed EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID — ignoring it and using the scheme derived from the client id.');
  }
  if (googleIosUrlScheme) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }]);
  }

  if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
    plugins.push(['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }]);
  }

  return { ...config, ios, plugins };
};

module.exports.isAppleNativeCapabilityEnabled = isAppleNativeCapabilityEnabled;
module.exports.withoutAppleSignInEntitlement = withoutAppleSignInEntitlement;
module.exports.googleIosUrlSchemeFromClientId = googleIosUrlSchemeFromClientId;
