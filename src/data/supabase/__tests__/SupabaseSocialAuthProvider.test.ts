/**
 * Sign in with Apple / Google against mocked native SDKs and supabase-js:
 * button availability follows the build's configuration, the Apple nonce is
 * hashed for Apple and raw for Supabase, cancellations are silent, failures
 * never leave a half-signed-in session, Apple's one-time name is kept, and
 * signing out clears Google's cached account (so "Continue with Google"
 * shows the account picker again).
 */
import { supabaseSocialAuthProvider } from '../SupabaseSocialAuthProvider';

const mockAuth = {
  signInWithIdToken: jest.fn(),
  updateUser: jest.fn(),
  signOut: jest.fn(),
};
jest.mock('../client', () => ({
  get supabase() {
    return { auth: mockAuth };
  },
}));

const mockCreateProfile = jest.fn();
jest.mock('../SupabaseAuthBackend', () => ({
  createProfileOnFirstSignIn: (...args: unknown[]) => mockCreateProfile(...args),
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(async () => new Uint8Array([1, 2, 3, 4])),
  digestStringAsync: jest.fn(async (_alg: string, value: string) => `sha256(${value})`),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

const mockApple = {
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
};
jest.mock('expo-apple-authentication', () => mockApple);

const mockGoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
};
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: mockGoogleSignin,
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE' },
  isErrorWithCode: (e: unknown) => !!e && typeof e === 'object' && 'code' in e,
}));

const USER_ID = '22222222-2222-4222-8222-222222222222';
const profile = { id: USER_ID, username: 'alice', displayName: 'Alice', avatarColorSeed: 'alice', createdAt: '2026-01-01T00:00:00.000Z' };
const ENV_KEYS = ['EXPO_PUBLIC_APPLE_NATIVE_CAPABILITY_ENABLED', 'EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME'];
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => ENV_KEYS.forEach((k) => (savedEnv[k] = process.env[k])));
afterAll(() => ENV_KEYS.forEach((k) => (savedEnv[k] === undefined ? delete process.env[k] : (process.env[k] = savedEnv[k]))));

beforeEach(() => {
  jest.clearAllMocks();
  ENV_KEYS.forEach((k) => delete process.env[k]);
  mockAuth.signOut.mockResolvedValue({ error: null });
  mockAuth.updateUser.mockResolvedValue({ data: {}, error: null });
  mockApple.isAvailableAsync.mockResolvedValue(true);
  mockCreateProfile.mockResolvedValue(profile);
  mockGoogleSignin.signOut.mockResolvedValue(null);
});

function enableApple() {
  process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED = 'true';
}
function enableGoogle() {
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client.apps.googleusercontent.com';
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-client.apps.googleusercontent.com';
  // No EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME: app.config.js derives the Info.plist scheme from the iOS client id.
}

describe('availability (which buttons the auth screen shows)', () => {
  it('Apple: only when enabled for the build AND the device supports it', async () => {
    expect(await supabaseSocialAuthProvider.isAvailable('apple')).toBe(false);
    enableApple();
    expect(await supabaseSocialAuthProvider.isAvailable('apple')).toBe(true);
    mockApple.isAvailableAsync.mockResolvedValue(false);
    expect(await supabaseSocialAuthProvider.isAvailable('apple')).toBe(false);
  });

  it('Apple: hidden when the build was generated without the native capability, even with the app flag on', async () => {
    enableApple();
    process.env.EXPO_PUBLIC_APPLE_NATIVE_CAPABILITY_ENABLED = 'false';
    expect(await supabaseSocialAuthProvider.isAvailable('apple')).toBe(false);
    expect(await supabaseSocialAuthProvider.signIn('apple')).toEqual({ ok: false, error: 'not-configured' });
    expect(mockApple.signInAsync).not.toHaveBeenCalled();
    expect(await supabaseSocialAuthProvider.getAppleAuthorizationCode?.()).toBeNull();
  });

  it('Google (iOS): only with the web client id, the iOS client id and the iOS URL scheme', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web';
    expect(await supabaseSocialAuthProvider.isAvailable('google')).toBe(false);
    enableGoogle();
    expect(await supabaseSocialAuthProvider.isAvailable('google')).toBe(true);
    // Configured once per app run, with the WEB client id as the token audience Supabase verifies.
    expect(mockGoogleSignin.configure).toHaveBeenCalledTimes(1);
    expect(mockGoogleSignin.configure).toHaveBeenCalledWith(
      expect.objectContaining({ webClientId: 'web-client.apps.googleusercontent.com', iosClientId: 'ios-client.apps.googleusercontent.com' }),
    );
  });

  it('Google stays available when the Apple native capability is off', async () => {
    enableGoogle();
    process.env.EXPO_PUBLIC_APPLE_NATIVE_CAPABILITY_ENABLED = 'false';
    expect(await supabaseSocialAuthProvider.isAvailable('google')).toBe(true);
  });
});

describe('Sign in with Apple', () => {
  beforeEach(enableApple);

  it('success: hashed nonce to Apple, raw nonce to Supabase, profile created', async () => {
    mockApple.signInAsync.mockResolvedValue({ identityToken: 'apple-id-token', fullName: { givenName: 'Ada', familyName: 'Lovelace' }, email: 'relay@privaterelay.appleid.com' });
    mockAuth.signInWithIdToken.mockResolvedValue({ data: { user: { id: USER_ID, user_metadata: {}, email: 'relay@privaterelay.appleid.com' } }, error: null });

    const result = await supabaseSocialAuthProvider.signIn('apple');

    expect(result).toEqual({ ok: true, profile });
    const raw = '01020304';
    expect(mockApple.signInAsync.mock.calls[0][0].nonce).toBe(`sha256(${raw})`);
    expect(mockAuth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'apple-id-token', nonce: raw });
    // Apple gives the name only on the first authorization — it's kept.
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Ada Lovelace' } });
    expect(mockCreateProfile).toHaveBeenCalledWith(USER_ID, {}, 'relay@privaterelay.appleid.com', { fullName: 'Ada Lovelace' });
  });

  it('a later sign-in without a name (Apple sends it only once) still works and does not overwrite the name', async () => {
    mockApple.signInAsync.mockResolvedValue({ identityToken: 't', fullName: null, email: null });
    mockAuth.signInWithIdToken.mockResolvedValue({ data: { user: { id: USER_ID, user_metadata: { full_name: 'Ada Lovelace' }, email: 'relay@privaterelay.appleid.com' } }, error: null });
    expect(await supabaseSocialAuthProvider.signIn('apple')).toEqual({ ok: true, profile });
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it('cancel is silent (no error shown, nothing sent to Supabase)', async () => {
    mockApple.signInAsync.mockRejectedValue(Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }));
    expect(await supabaseSocialAuthProvider.signIn('apple')).toEqual({ ok: false, error: 'cancelled' });
    expect(mockAuth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('an Apple error fails cleanly', async () => {
    mockApple.signInAsync.mockRejectedValue(Object.assign(new Error('boom'), { code: 'ERR_REQUEST_FAILED' }));
    expect(await supabaseSocialAuthProvider.signIn('apple')).toEqual({ ok: false, error: 'failed' });
  });

  it('Supabase rejecting the token (e.g. provider not enabled) fails cleanly', async () => {
    mockApple.signInAsync.mockResolvedValue({ identityToken: 't' });
    mockAuth.signInWithIdToken.mockResolvedValue({ data: { user: null }, error: { status: 400, message: 'Provider is not enabled' } });
    expect(await supabaseSocialAuthProvider.signIn('apple')).toEqual({ ok: false, error: 'failed' });
  });

  it('a profile failure never leaves a half-signed-in session', async () => {
    mockApple.signInAsync.mockResolvedValue({ identityToken: 't' });
    mockAuth.signInWithIdToken.mockResolvedValue({ data: { user: { id: USER_ID, user_metadata: {} } }, error: null });
    mockCreateProfile.mockResolvedValue(undefined);
    expect(await supabaseSocialAuthProvider.signIn('apple')).toEqual({ ok: false, error: 'failed' });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('not enabled for this build → not-configured, Apple sheet never shown', async () => {
    delete process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED;
    expect(await supabaseSocialAuthProvider.signIn('apple')).toEqual({ ok: false, error: 'not-configured' });
    expect(mockApple.signInAsync).not.toHaveBeenCalled();
  });
});

describe('Google Sign-In', () => {
  beforeEach(enableGoogle);

  it('success: Google ID token exchanged with Supabase, profile created', async () => {
    mockGoogleSignin.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token', user: { name: 'Ada Lovelace' } } });
    mockAuth.signInWithIdToken.mockResolvedValue({ data: { user: { id: USER_ID, user_metadata: {}, email: 'ada@gmail.com' } }, error: null });

    expect(await supabaseSocialAuthProvider.signIn('google')).toEqual({ ok: true, profile });
    expect(mockAuth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'google-id-token' });
    expect(mockCreateProfile).toHaveBeenCalledWith(USER_ID, {}, 'ada@gmail.com', { fullName: 'Ada Lovelace' });
  });

  it('cancel (dismissed picker) is silent', async () => {
    mockGoogleSignin.signIn.mockResolvedValue({ type: 'cancelled', data: null });
    expect(await supabaseSocialAuthProvider.signIn('google')).toEqual({ ok: false, error: 'cancelled' });
    mockGoogleSignin.signIn.mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });
    expect(await supabaseSocialAuthProvider.signIn('google')).toEqual({ ok: false, error: 'cancelled' });
    expect(mockAuth.signInWithIdToken).not.toHaveBeenCalled();
  });

  it('an SDK error fails cleanly', async () => {
    mockGoogleSignin.signIn.mockRejectedValue({ code: 'DEVELOPER_ERROR' });
    expect(await supabaseSocialAuthProvider.signIn('google')).toEqual({ ok: false, error: 'failed' });
  });

  it('Supabase rejecting the token signs Google out too, so the next try shows the account picker', async () => {
    mockGoogleSignin.signIn.mockResolvedValue({ type: 'success', data: { idToken: 't', user: { name: null } } });
    mockAuth.signInWithIdToken.mockResolvedValue({ data: { user: null }, error: { status: 400, message: 'nonce mismatch' } });
    expect(await supabaseSocialAuthProvider.signIn('google')).toEqual({ ok: false, error: 'failed' });
    expect(mockGoogleSignin.signOut).toHaveBeenCalled();
  });

  it('a server error is reported as a network problem', async () => {
    mockGoogleSignin.signIn.mockResolvedValue({ type: 'success', data: { idToken: 't', user: { name: null } } });
    mockAuth.signInWithIdToken.mockResolvedValue({ data: { user: null }, error: { status: 503, message: 'unavailable' } });
    expect(await supabaseSocialAuthProvider.signIn('google')).toEqual({ ok: false, error: 'network' });
  });

  it('app sign-out clears the Google SDK’s cached account', async () => {
    await supabaseSocialAuthProvider.signOut?.();
    expect(mockGoogleSignin.signOut).toHaveBeenCalled();
  });

  it('not configured (no iOS client id) → not-configured, SDK never called', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    expect(await supabaseSocialAuthProvider.signIn('google')).toEqual({ ok: false, error: 'not-configured' });
    expect(mockGoogleSignin.signIn).not.toHaveBeenCalled();
  });

  it('a malformed iOS client id → not-configured (its derived URL scheme would not exist), SDK never called', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'not-a-client-id';
    expect(await supabaseSocialAuthProvider.signIn('google')).toEqual({ ok: false, error: 'not-configured' });
    expect(mockGoogleSignin.signIn).not.toHaveBeenCalled();
  });

  it('a stale EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME is irrelevant at runtime (the scheme comes from the client id)', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME = 'com.googleusercontent.apps.something-else';
    expect(await supabaseSocialAuthProvider.isAvailable('google')).toBe(true);
  });
});

describe('account deletion compatibility (Apple token revocation)', () => {
  it('re-authorizes with Apple to get a fresh authorization code', async () => {
    enableApple();
    mockApple.signInAsync.mockResolvedValue({ authorizationCode: 'auth-code' });
    expect(await supabaseSocialAuthProvider.getAppleAuthorizationCode?.()).toBe('auth-code');
  });

  it('cancelling that re-authorization yields no code (deletion is not silently completed without it)', async () => {
    enableApple();
    mockApple.signInAsync.mockRejectedValue(Object.assign(new Error('c'), { code: 'ERR_REQUEST_CANCELED' }));
    expect(await supabaseSocialAuthProvider.getAppleAuthorizationCode?.()).toBeNull();
  });
});
