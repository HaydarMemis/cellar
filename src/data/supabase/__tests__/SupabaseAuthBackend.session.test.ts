/**
 * Session lifecycle against a mocked supabase-js client: offline cold start
 * (no 25–30 s hang, identity kept), account deleted elsewhere (signed out,
 * not shown from cache), no hidden live session after a failed sign-in,
 * sign-out that really removes the local session, resend redirect, password
 * change error codes, and the per-request fetch timeout.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js';
import { SessionInvalidError } from '../../community/AuthBackend';
import { createTimeoutFetch, requestTimeoutFor, SUPABASE_REQUEST_TIMEOUT_MS } from '../client';
import { GET_SESSION_TIMEOUT_MS, isSessionRejectedError, supabaseAuthBackend } from '../SupabaseAuthBackend';

const STORAGE_KEY = 'sb-testproject-auth-token';

const mockAuth = {
  getSession: jest.fn(),
  getUser: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  resend: jest.fn(),
  updateUser: jest.fn(),
  onAuthStateChange: jest.fn(),
};
let mockProfileRow: unknown = null;

jest.mock('../client', () => {
  const actual = jest.requireActual('../client');
  const mocked = { ...actual, supabaseAuthStorageKey: () => 'sb-testproject-auth-token' };
  // defineProperty, not an object-literal getter: a spread would evaluate
  // the getter right here, before mockAuth is initialized.
  Object.defineProperty(mocked, 'supabase', {
    get: () => ({
      auth: mockAuth,
      from: () => {
        const q: Record<string, unknown> = {};
        q.select = () => q;
        q.eq = () => q;
        q.upsert = () => q;
        q.maybeSingle = () => Promise.resolve({ data: mockProfileRow, error: null });
        return q;
      },
    }),
  });
  return mocked;
});
jest.mock('expo-auth-session', () => ({ makeRedirectUri: ({ path }: { path: string }) => `cellar://${path}` }));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const storedSession = { access_token: 'a', refresh_token: 'r', expires_at: 1, user: { id: USER_ID, created_at: '2025-01-02T03:04:05.000Z' } };
const row = { id: USER_ID, username: 'alice', display_name: 'Alice', bio: null, avatar_color_seed: 'a', created_at: 'x' };

beforeEach(async () => {
  Object.values(mockAuth).forEach((fn) => fn.mockReset());
  mockAuth.signOut.mockResolvedValue({ error: null });
  mockProfileRow = null;
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getSession — offline cold start', () => {
  it('returns the live session normally', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: storedSession.user } }, error: null });
    expect(await supabaseAuthBackend.getSession()).toEqual({ userId: USER_ID, createdAt: '2025-01-02T03:04:05.000Z' });
  });

  it('does not wait out supabase-js’s ~30 s refresh retry: after the timeout it keeps the stored identity', async () => {
    jest.useFakeTimers();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession));
    mockAuth.getSession.mockReturnValue(new Promise(() => undefined)); // refresh retrying on a dead network
    const pending = supabaseAuthBackend.getSession();
    await jest.advanceTimersByTimeAsync(GET_SESSION_TIMEOUT_MS + 10);
    expect(await pending).toEqual({ userId: USER_ID, createdAt: '2025-01-02T03:04:05.000Z' });
  });

  it('a retryable fetch error with session null keeps the stored identity (supabase-js keeps the stored session too)', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession));
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError('Network request failed', 0) });
    expect((await supabaseAuthBackend.getSession())?.userId).toBe(USER_ID);
  });

  it('a genuinely signed-out device stays signed out (no error, or a non-retryable one)', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession));
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await supabaseAuthBackend.getSession()).toBeNull();
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found') });
    expect(await supabaseAuthBackend.getSession()).toBeNull();
  });

  it('offline with nothing stored is signed out', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError('offline', 0) });
    expect(await supabaseAuthBackend.getSession()).toBeNull();
  });
});

describe('ensureProfileForCurrentSession — auth errors vs network errors', () => {
  it('classifies errors', () => {
    expect(isSessionRejectedError(new AuthApiError('User from sub claim in JWT does not exist', 403, 'user_not_found'))).toBe(true);
    expect(isSessionRejectedError(new AuthApiError('invalid JWT', 401, 'bad_jwt'))).toBe(true);
    expect(isSessionRejectedError(new AuthApiError('not found', 404, undefined))).toBe(true);
    expect(isSessionRejectedError(new AuthSessionMissingError())).toBe(true);
    expect(isSessionRejectedError(new AuthRetryableFetchError('Network request failed', 0))).toBe(false);
    expect(isSessionRejectedError(new AuthRetryableFetchError('Bad gateway', 502))).toBe(false);
    expect(isSessionRejectedError(new Error('random'))).toBe(false);
  });

  it('account deleted on another device → SessionInvalidError (never the cached profile)', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('User from sub claim in JWT does not exist', 403, 'user_not_found') });
    await expect(supabaseAuthBackend.ensureProfileForCurrentSession!()).rejects.toBeInstanceOf(SessionInvalidError);
  });

  it('a network failure resolves undefined so the caller may use its cache', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError('Network request failed', 0) });
    await expect(supabaseAuthBackend.ensureProfileForCurrentSession!()).resolves.toBeUndefined();
  });
});

describe('sign-in never leaves a hidden live session', () => {
  it('password sign-in whose profile cannot be created signs this device out before reporting the error', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: { user: { id: USER_ID, user_metadata: {}, email: 'a@x.com' } }, error: null });
    mockProfileRow = null; // fetch + create both come back empty
    expect(await supabaseAuthBackend.logIn({ email: 'a@x.com', password: 'secret1' })).toEqual({ ok: false, error: 'unknown' });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('a successful sign-in does not sign out', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: { user: { id: USER_ID, user_metadata: {}, email: 'a@x.com' } }, error: null });
    mockProfileRow = row;
    expect((await supabaseAuthBackend.logIn({ email: 'a@x.com', password: 'secret1' })).ok).toBe(true);
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });
});

describe('logOut', () => {
  it('removes the stored session even when supabase-js could not (offline, expired access token)', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession));
    // supabase-js returns the refresh error WITHOUT removing the session in this case.
    mockAuth.signOut.mockResolvedValue({ error: new AuthRetryableFetchError('offline', 0) });
    await supabaseAuthBackend.logOut();
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('is bounded when the network stalls', async () => {
    jest.useFakeTimers();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession));
    mockAuth.signOut.mockReturnValue(new Promise(() => undefined));
    const pending = supabaseAuthBackend.logOut();
    await jest.advanceTimersByTimeAsync(6000);
    await pending;
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('onSessionActive', () => {
  it('reports SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED with the session user, deferred; ignores other events', async () => {
    let handler: (event: string, session: unknown) => void = () => undefined;
    mockAuth.onAuthStateChange.mockImplementation((cb: typeof handler) => {
      handler = cb;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    const seen: string[] = [];
    supabaseAuthBackend.onSessionActive!((id) => seen.push(id));
    handler('SIGNED_IN', { user: { id: 'a' } });
    handler('TOKEN_REFRESHED', { user: { id: 'b' } });
    handler('USER_UPDATED', { user: { id: 'c' } });
    handler('SIGNED_OUT', null);
    handler('INITIAL_SESSION', { user: { id: 'd' } });
    expect(seen).toEqual([]); // deferred out of supabase-js's auth lock
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual(['a', 'b', 'c']);
  });
});

describe('email + password flows', () => {
  it('resending the confirmation email uses the same redirect as sign-up', async () => {
    mockAuth.resend.mockResolvedValue({ error: null });
    await supabaseAuthBackend.resendConfirmationEmail('A@x.com');
    expect(mockAuth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@x.com', options: { emailRedirectTo: 'cellar://auth-callback' } });
  });

  it('password change maps reauthentication / same-password / weak-password', async () => {
    mockAuth.updateUser.mockResolvedValue({ error: new AuthApiError('Password update requires reauthentication', 400, 'reauthentication_needed') });
    expect(await supabaseAuthBackend.updatePassword('newpass1')).toEqual({ ok: false, error: 'reauthentication-needed' });
    mockAuth.updateUser.mockResolvedValue({ error: new AuthApiError('Invalid nonce', 400, 'reauthentication_not_valid') });
    expect(await supabaseAuthBackend.updatePassword('newpass1')).toEqual({ ok: false, error: 'reauthentication-needed' });
    mockAuth.updateUser.mockResolvedValue({ error: new AuthApiError('New password should be different', 422, 'same_password') });
    expect(await supabaseAuthBackend.updatePassword('newpass1')).toEqual({ ok: false, error: 'same-password' });
    mockAuth.updateUser.mockResolvedValue({ error: new AuthApiError('Password is known to be weak', 422, 'weak_password') });
    expect(await supabaseAuthBackend.updatePassword('newpass1')).toEqual({ ok: false, error: 'weak-password' });
    mockAuth.updateUser.mockResolvedValue({ error: null });
    expect(await supabaseAuthBackend.updatePassword('newpass1')).toEqual({ ok: true });
  });
});

describe('per-request timeout (stalled Android networks)', () => {
  it('caps auth and database requests, leaves storage uploads alone', () => {
    expect(requestTimeoutFor('https://x.supabase.co/auth/v1/token?grant_type=refresh_token')).toBe(SUPABASE_REQUEST_TIMEOUT_MS);
    expect(requestTimeoutFor('https://x.supabase.co/rest/v1/profiles?select=*')).toBe(SUPABASE_REQUEST_TIMEOUT_MS);
    expect(requestTimeoutFor('https://x.supabase.co/functions/v1/delete-account')).toBeGreaterThan(SUPABASE_REQUEST_TIMEOUT_MS);
    expect(requestTimeoutFor('https://x.supabase.co/storage/v1/object/recipe-media/a.jpg')).toBeNull();
  });

  it('aborts a request that never answers', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    const base = jest.fn((_input: RequestInfo, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('Aborted'))));
    });
    const timed = createTimeoutFetch(base, () => 1000);
    const pending = timed('https://x.supabase.co/auth/v1/user');
    const assertion = expect(pending).rejects.toThrow('Aborted');
    await jest.advanceTimersByTimeAsync(1001);
    await assertion;
    expect(signal?.aborted).toBe(true);
  });

  it('keeps honoring the caller’s own abort signal', async () => {
    const base = jest.fn((_input: RequestInfo, init?: RequestInit) => {
      const s = init?.signal;
      return new Promise<Response>((_resolve, reject) => s?.addEventListener('abort', () => reject(new Error('Aborted'))));
    });
    const caller = new AbortController();
    const pending = createTimeoutFetch(base, () => 60_000)('https://x.supabase.co/rest/v1/x', { signal: caller.signal });
    caller.abort();
    await expect(pending).rejects.toThrow('Aborted');
  });
});
