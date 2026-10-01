/**
 * app.config.js — what `npx expo prebuild` generates for Sign in with Apple
 * and Google Sign-In, driven by environment variables.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const appConfig = require('../../../app.config.js') as ((ctx: { config: ExpoConfig }) => ExpoConfig) & {
  isAppleNativeCapabilityEnabled: (env?: Record<string, string | undefined>) => boolean;
  withoutAppleSignInEntitlement: (config: Record<string, unknown>) => { mods: { ios: { entitlements: (c: unknown) => Promise<{ modResults: Record<string, unknown> }> } } };
  googleIosUrlSchemeFromClientId: (clientId: string | undefined) => string | null;
};
const baseConfig = require('../../../app.json').expo as ExpoConfig;

type Plugin = string | [string, unknown] | ((config: unknown) => unknown);
type ExpoConfig = { plugins?: Plugin[]; ios?: { usesAppleSignIn?: boolean; entitlements?: Record<string, unknown>; bundleIdentifier?: string } };

const KEYS = ['EXPO_PUBLIC_APPLE_NATIVE_CAPABILITY_ENABLED', 'EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED', 'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'SENTRY_ORG', 'SENTRY_PROJECT'];
const saved: Record<string, string | undefined> = {};
beforeAll(() => KEYS.forEach((k) => (saved[k] = process.env[k])));
afterAll(() => KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));
beforeEach(() => KEYS.forEach((k) => delete process.env[k]));

const names = (c: ExpoConfig) => (c.plugins ?? []).filter((p) => typeof p !== 'function').map((p) => (Array.isArray(p) ? p[0] : (p as string)));
const build = () => appConfig({ config: JSON.parse(JSON.stringify(baseConfig)) });

describe('Sign in with Apple native capability', () => {
  it('default (flag unset): the entitlement is requested, as in production', () => {
    const c = build();
    expect(c.ios?.usesAppleSignIn).toBe(true);
    expect(names(c)).toContain('expo-apple-authentication');
  });

  it('EXPO_PUBLIC_APPLE_NATIVE_CAPABILITY_ENABLED=false: no plugin and no usesAppleSignIn, so prebuild adds no applesignin entitlement', () => {
    process.env.EXPO_PUBLIC_APPLE_NATIVE_CAPABILITY_ENABLED = 'false';
    process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED = 'true'; // the app-level flag doesn't bring it back
    const c = build();
    expect(c.ios?.usesAppleSignIn).toBe(false);
    expect(names(c)).not.toContain('expo-apple-authentication');
    expect(c.ios?.entitlements?.['com.apple.developer.applesignin']).toBeUndefined();
    // Nothing else about the iOS app changes.
    expect(c.ios?.bundleIdentifier).toBe('com.ecclesia.coctail');
    expect(names(c)).toEqual(names(baseConfig).filter((n) => n !== 'expo-apple-authentication'));
  });

  it('capability off also strips the entitlement that prebuild’s auto-applied expo-apple-authentication plugin adds', async () => {
    process.env.EXPO_PUBLIC_APPLE_NATIVE_CAPABILITY_ENABLED = 'false';
    expect(build().plugins).toContain(appConfig.withoutAppleSignInEntitlement);
    const withMod = appConfig.withoutAppleSignInEntitlement({ name: 'Cellar', slug: 'cellar', mods: {} });
    const result = await withMod.mods.ios.entitlements({
      name: 'Cellar',
      slug: 'cellar',
      modResults: { 'com.apple.developer.applesignin': ['Default'], 'keychain-access-groups': ['x'] },
      modRequest: { platform: 'ios', modName: 'entitlements' },
      modRawConfig: {},
    });
    expect(result.modResults).toEqual({ 'keychain-access-groups': ['x'] });
  });

  it('capability on (default) adds no entitlement-stripping plugin', () => {
    expect(build().plugins).not.toContain(appConfig.withoutAppleSignInEntitlement);
  });

  it('only the exact value "false" turns it off', () => {
    expect(appConfig.isAppleNativeCapabilityEnabled({})).toBe(true);
    expect(appConfig.isAppleNativeCapabilityEnabled({ EXPO_PUBLIC_APPLE_NATIVE_CAPABILITY_ENABLED: 'true' })).toBe(true);
    expect(appConfig.isAppleNativeCapabilityEnabled({ EXPO_PUBLIC_APPLE_NATIVE_CAPABILITY_ENABLED: 'false' })).toBe(false);
  });
});

describe('Google Sign-In native configuration (independent of Apple)', () => {
  const GOOGLE = '@react-native-google-signin/google-signin';
  const googlePlugin = () => build().plugins?.find((p) => Array.isArray(p) && p[0] === GOOGLE);

  it('derives the URL scheme from the iOS client id (reversed), with Apple capability on or off', () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = '1234-abcd.apps.googleusercontent.com';
    for (const apple of [undefined, 'false']) {
      if (apple) process.env.EXPO_PUBLIC_APPLE_NATIVE_CAPABILITY_ENABLED = apple;
      expect(googlePlugin()).toEqual([GOOGLE, { iosUrlScheme: 'com.googleusercontent.apps.1234-abcd' }]);
    }
  });

  it('a mismatched EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME is ignored (it would crash GIDSignIn) — with a warning that prints no values', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = '1234-abcd.apps.googleusercontent.com';
    process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME = 'com.googleusercontent.apps.1234-abcX';
    expect(googlePlugin()).toEqual([GOOGLE, { iosUrlScheme: 'com.googleusercontent.apps.1234-abcd' }]);
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('1234');
    warn.mockRestore();
  });

  it('no iOS client id → no Google plugin, even if a URL scheme is set', () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME = 'com.googleusercontent.apps.test-client';
    expect(names(build())).not.toContain(GOOGLE);
  });

  it('a malformed iOS client id → no Google plugin', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'not-a-client-id';
    expect(names(build())).not.toContain(GOOGLE);
    warn.mockRestore();
  });

  it('googleIosUrlSchemeFromClientId', () => {
    expect(appConfig.googleIosUrlSchemeFromClientId(' 99-x.apps.googleusercontent.com ')).toBe('com.googleusercontent.apps.99-x');
    expect(appConfig.googleIosUrlSchemeFromClientId(undefined)).toBeNull();
    expect(appConfig.googleIosUrlSchemeFromClientId('a b.apps.googleusercontent.com')).toBeNull();
  });
});
