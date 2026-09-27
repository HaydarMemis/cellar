import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { reportError } from '../../lib/crashReporting';
import { SocialAuthMethod, SocialAuthProvider, SocialAuthResult } from '../community/SocialAuthProvider';
import { supabase } from './client';
import { createProfileOnFirstSignIn } from './SupabaseAuthBackend';

/**
 * "Continue with Apple" / "Continue with Google" against Supabase Auth's
 * native `signInWithIdToken`. Supabase verifies the provider's signed
 * identity token server-side — the client never asserts identity itself.
 *
 * A button is only shown when its provider is actually configured for this
 * build (see isAvailable) — never a button that can only fail.
 *
 * Apple (iOS only): expo-apple-authentication → identity token (with a
 * SHA-256 nonce) → Supabase. Needs `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true`
 * once the Apple provider is enabled in Supabase (the client can't detect
 * dashboard configuration). Apple only returns the user's name on the FIRST
 * authorization, so it's used then to seed the profile.
 *
 * Google (iOS + Android): the native Google Sign-In SDK
 * (@react-native-google-signin/google-signin) → ID token whose audience is
 * the WEB client id → Supabase. Google no longer allows custom-scheme
 * redirects for new OAuth clients, which is why this uses the native SDK
 * rather than a browser redirect. Needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
 * and on iOS EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID + EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME
 * (the reversed iOS client id, wired into Info.plist by app.config.js).
 *
 * Account linking: Supabase links an Apple/Google identity to an existing
 * account automatically when the provider's verified email matches. An
 * Apple "Hide My Email" relay address never matches, so that sign-in is a
 * separate account — documented for users in the FAQ/support copy.
 */

function client() {
  if (!supabase) throw new Error('SupabaseSocialAuthProvider used without a configured Supabase client');
  return supabase;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function makeNoncePair(): Promise<{ raw: string; hashed: string }> {
  const raw = bytesToHex(await Crypto.getRandomBytesAsync(16));
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, hashed };
}

export function isAppleSignInEnabled(): boolean {
  return Platform.OS === 'ios' && process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED === 'true';
}

export function googleClientConfig(): { webClientId: string; iosClientId?: string } | null {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) return null;
  if (Platform.OS === 'ios') {
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    // Without the URL scheme in Info.plist the native SDK crashes on sign-in.
    if (!iosClientId || !process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME) return null;
    return { webClientId, iosClientId };
  }
  if (Platform.OS === 'android') return { webClientId };
  return null;
}

type AppleModule = typeof import('expo-apple-authentication');
type GoogleModule = typeof import('@react-native-google-signin/google-signin');

function loadApple(): AppleModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-apple-authentication') as AppleModule;
  } catch {
    return null; // Expo Go / a build without the native module
  }
}

let googleConfigured = false;
function loadGoogle(): GoogleModule | null {
  const config = googleClientConfig();
  if (!config) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-google-signin/google-signin') as GoogleModule;
    if (!googleConfigured) {
      mod.GoogleSignin.configure({ webClientId: config.webClientId, iosClientId: config.iosClientId, scopes: ['profile', 'email'] });
      googleConfigured = true;
    }
    return mod;
  } catch {
    return null;
  }
}

async function finishSignIn(
  userId: string,
  metadata: unknown,
  email: string | undefined,
  fullName: string | undefined,
  action: string,
): Promise<SocialAuthResult> {
  try {
    const profile = await createProfileOnFirstSignIn(userId, metadata, email, { fullName });
    if (!profile) throw new Error('Profile could not be created or read');
    return { ok: true, profile };
  } catch (e) {
    reportError(e, { module: 'SupabaseSocialAuthProvider', action });
    // Don't leave a half-signed-in session behind with no profile.
    await client().auth.signOut().catch(() => undefined);
    return { ok: false, error: 'failed' };
  }
}

async function signInWithApple(): Promise<SocialAuthResult> {
  if (!isAppleSignInEnabled()) return { ok: false, error: 'not-configured' };
  const AppleAuthentication = loadApple();
  if (!AppleAuthentication || !(await AppleAuthentication.isAvailableAsync().catch(() => false))) {
    return { ok: false, error: 'not-configured' };
  }

  const { raw: rawNonce, hashed: hashedNonce } = await makeNoncePair();
  let credential: Awaited<ReturnType<AppleModule['signInAsync']>>;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (e) {
    const code = (e as { code?: string } | undefined)?.code;
    if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') return { ok: false, error: 'cancelled' };
    reportError(e, { module: 'SupabaseSocialAuthProvider', action: 'appleSignInAsync' });
    return { ok: false, error: 'failed' };
  }
  if (!credential.identityToken) return { ok: false, error: 'failed' };

  const { data, error } = await client().auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
  if (error || !data.user) {
    reportError(error ?? new Error('signInWithIdToken returned no user'), { module: 'SupabaseSocialAuthProvider', action: 'appleIdTokenExchange' });
    return { ok: false, error: error && (error.status ?? 0) >= 500 ? 'network' : 'failed' };
  }

  const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ') || undefined;
  if (fullName) {
    // Apple sends the name only once — keep it on the auth user too.
    await client().auth.updateUser({ data: { full_name: fullName } }).catch(() => undefined);
  }
  return finishSignIn(data.user.id, data.user.user_metadata, credential.email ?? data.user.email ?? undefined, fullName, 'appleEnsureProfile');
}

async function signInWithGoogle(): Promise<SocialAuthResult> {
  const mod = loadGoogle();
  if (!mod) return { ok: false, error: 'not-configured' };
  const { GoogleSignin, isErrorWithCode, statusCodes } = mod;

  let idToken: string | null = null;
  let fullName: string | undefined;
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') return { ok: false, error: 'cancelled' };
    idToken = response.data.idToken;
    fullName = response.data.user.name ?? undefined;
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return { ok: false, error: 'cancelled' };
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { ok: false, error: 'not-configured' };
    }
    reportError(e, { module: 'SupabaseSocialAuthProvider', action: 'googleSignIn' });
    return { ok: false, error: 'failed' };
  }
  if (!idToken) return { ok: false, error: 'failed' };

  const { data, error } = await client().auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error || !data.user) {
    reportError(error ?? new Error('signInWithIdToken returned no user'), { module: 'SupabaseSocialAuthProvider', action: 'googleIdTokenExchange' });
    await GoogleSignin.signOut().catch(() => undefined);
    return { ok: false, error: error && (error.status ?? 0) >= 500 ? 'network' : 'failed' };
  }
  return finishSignIn(data.user.id, data.user.user_metadata, data.user.email ?? undefined, fullName, 'googleEnsureProfile');
}

export const supabaseSocialAuthProvider: SocialAuthProvider = {
  async isAvailable(method: SocialAuthMethod) {
    if (!supabase) return false;
    if (method === 'apple') {
      if (!isAppleSignInEnabled()) return false;
      const apple = loadApple();
      return !!apple && (await apple.isAvailableAsync().catch(() => false));
    }
    return !!loadGoogle();
  },

  async signIn(method: SocialAuthMethod) {
    if (!supabase) return { ok: false, error: 'not-configured' };
    return method === 'apple' ? signInWithApple() : signInWithGoogle();
  },

  async signOut() {
    // Clears the Google SDK's cached account so the next "Continue with
    // Google" shows the account picker (account switching). Apple has no
    // client-side session to clear.
    const mod = googleClientConfig() ? loadGoogle() : null;
    if (mod) await mod.GoogleSignin.signOut().catch(() => undefined);
  },

  async getAppleAuthorizationCode() {
    if (!isAppleSignInEnabled()) return null;
    const AppleAuthentication = loadApple();
    if (!AppleAuthentication) return null;
    try {
      const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
      return credential.authorizationCode ?? null;
    } catch (e) {
      const code = (e as { code?: string } | undefined)?.code;
      if (code !== 'ERR_REQUEST_CANCELED' && code !== 'ERR_CANCELED') reportError(e, { module: 'SupabaseSocialAuthProvider', action: 'appleReauthorize' });
      return null;
    }
  },
};
