/**
 * Email + password flows against a mocked supabase-js client: sign-up
 * (confirmation required, anti-enumeration for existing addresses, locale
 * for localized emails), sign-in error mapping (wrong credentials never
 * reveal whether the address exists; unconfirmed accounts are told to
 * confirm), password-reset requests, and the deep links the confirmation /
 * recovery emails open (cellar://auth-callback, cellar://reset-password).
 */
import { AuthApiError } from '@supabase/supabase-js';
import { supabaseAuthBackend } from '../SupabaseAuthBackend';

const mockAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  resend: jest.fn(),
  setSession: jest.fn(),
};
let mockProfileRow: unknown = null;

jest.mock('../client', () => {
  const actual = jest.requireActual('../client');
  const mocked = { ...actual };
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
const row = { id: USER_ID, username: 'alice', display_name: 'Alice', bio: null, avatar_color_seed: 'a', created_at: '2026-01-01T00:00:00.000Z' };
const signUpInput = { username: 'alice', displayName: 'Alice', email: 'Alice@Example.com', password: 'secret12' };

beforeEach(() => {
  Object.values(mockAuth).forEach((fn) => fn.mockReset());
  mockAuth.signOut.mockResolvedValue({ error: null });
  mockProfileRow = null;
});

describe('sign-up', () => {
  it('asks for email confirmation and never fakes a signed-in state', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: { id: USER_ID, identities: [{ id: 'i' }] }, session: null }, error: null });
    expect(await supabaseAuthBackend.signUp(signUpInput)).toEqual({ ok: 'pending-confirmation', email: 'alice@example.com' });
  });

  it('an address that already has an account gets the SAME answer (no account enumeration)', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: { id: USER_ID, identities: [] }, session: null }, error: null });
    expect(await supabaseAuthBackend.signUp(signUpInput)).toEqual({ ok: 'pending-confirmation', email: 'alice@example.com' });
  });

  it('stores the app language on the account so confirmation / reset emails are localized', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: { id: USER_ID, identities: [{ id: 'i' }] }, session: null }, error: null });
    await supabaseAuthBackend.signUp({ ...signUpInput, locale: 'tr' });
    expect(mockAuth.signUp.mock.calls[0][0].options).toEqual({
      data: { username: 'alice', display_name: 'Alice', locale: 'tr' },
      emailRedirectTo: 'cellar://auth-callback',
    });
  });

  it('ignores an unsupported locale value', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: { id: USER_ID, identities: [{ id: 'i' }] }, session: null }, error: null });
    await supabaseAuthBackend.signUp({ ...signUpInput, locale: 'xx' });
    expect(mockAuth.signUp.mock.calls[0][0].options.data).toEqual({ username: 'alice', display_name: 'Alice' });
  });

  it('rejects a too-short password locally, before any request', async () => {
    expect(await supabaseAuthBackend.signUp({ ...signUpInput, password: '123' })).toEqual({ ok: false, error: 'invalid-password' });
    expect(mockAuth.signUp).not.toHaveBeenCalled();
  });
});

describe('confirmation email delivery', () => {
  it('a sign-up whose confirmation email could not be sent is reported as such (not as a connection problem)', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: new AuthApiError('Error sending confirmation email', 500, 'unexpected_failure') });
    expect(await supabaseAuthBackend.signUp(signUpInput)).toEqual({ ok: false, error: 'email-send-failed' });
  });

  it('resend: success, rate-limited (email already sent moments ago), network and other errors are distinguished', async () => {
    mockAuth.resend.mockResolvedValue({ data: {}, error: null });
    expect(await supabaseAuthBackend.resendConfirmationEmail('Alice@Example.com')).toEqual({ ok: true });
    expect(mockAuth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'alice@example.com', options: { emailRedirectTo: 'cellar://auth-callback' } });

    mockAuth.resend.mockResolvedValue({ data: null, error: new AuthApiError('For security purposes, you can only request this after 52 seconds.', 429, 'over_email_send_rate_limit') });
    expect(await supabaseAuthBackend.resendConfirmationEmail('a@example.com')).toEqual({ ok: false, error: 'rate-limited' });

    mockAuth.resend.mockResolvedValue({ data: null, error: new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit') });
    expect(await supabaseAuthBackend.resendConfirmationEmail('a@example.com')).toEqual({ ok: false, error: 'rate-limited' });

    mockAuth.resend.mockResolvedValue({ data: null, error: new AuthApiError('Something odd', 400, 'validation_failed') });
    expect(await supabaseAuthBackend.resendConfirmationEmail('a@example.com')).toEqual({ ok: false, error: 'unknown' });
  });
});

describe('sign-in', () => {
  it('wrong password and unknown address produce the same generic error', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    });
    expect(await supabaseAuthBackend.logIn({ email: 'nobody@example.com', password: 'x' })).toEqual({ ok: false, error: 'wrong-password' });
  });

  it('an unconfirmed account is told to confirm its email', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'),
    });
    expect(await supabaseAuthBackend.logIn({ email: 'alice@example.com', password: 'secret12' })).toEqual({ ok: false, error: 'email-not-confirmed' });
  });

  it('a successful sign-in returns the profile (email normalized)', async () => {
    mockProfileRow = row;
    mockAuth.signInWithPassword.mockResolvedValue({ data: { user: { id: USER_ID, user_metadata: {} }, session: { access_token: 'a' } }, error: null });
    const result = await supabaseAuthBackend.logIn({ email: ' Alice@Example.com ', password: 'secret12' });
    expect(result).toMatchObject({ ok: true, profile: { id: USER_ID, username: 'alice' } });
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'secret12' });
  });
});

describe('password reset request', () => {
  it('sends the reset email with the app’s reset-password deep link', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    expect(await supabaseAuthBackend.requestPasswordReset('Alice@Example.com')).toEqual({ ok: true });
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('alice@example.com', { redirectTo: 'cellar://reset-password' });
  });

  it('passes through only failures about the request itself (rate limit / network)', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ data: null, error: new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit') });
    expect(await supabaseAuthBackend.requestPasswordReset('a@example.com')).toEqual({ ok: false, error: 'rate-limited' });
    mockAuth.resetPasswordForEmail.mockResolvedValue({ data: null, error: new AuthApiError('User not found', 400, 'user_not_found') });
    expect(await supabaseAuthBackend.requestPasswordReset('a@example.com')).toEqual({ ok: false, error: 'unknown' });
  });
});

describe('email deep links (confirmation → cellar://auth-callback, recovery → cellar://reset-password)', () => {
  it('establishes the session from the link’s URL fragment (implicit flow)', async () => {
    mockAuth.setSession.mockResolvedValue({ data: {}, error: null });
    const ok = await supabaseAuthBackend.confirmPasswordResetSession?.('cellar://auth-callback#access_token=AT&refresh_token=RT&expires_in=3600&token_type=bearer&type=signup');
    expect(ok).toBe(true);
    expect(mockAuth.setSession).toHaveBeenCalledWith({ access_token: 'AT', refresh_token: 'RT' });
  });

  it('also accepts tokens in the query string', async () => {
    mockAuth.setSession.mockResolvedValue({ data: {}, error: null });
    expect(await supabaseAuthBackend.confirmPasswordResetSession?.('cellar://reset-password?access_token=AT&refresh_token=RT&type=recovery')).toBe(true);
  });

  it('an expired / already-used link establishes nothing', async () => {
    const ok = await supabaseAuthBackend.confirmPasswordResetSession?.(
      'cellar://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
    );
    expect(ok).toBe(false);
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('a link without tokens (e.g. plain cellar://) establishes nothing', async () => {
    expect(await supabaseAuthBackend.confirmPasswordResetSession?.('cellar://auth-callback')).toBe(false);
    expect(mockAuth.setSession).not.toHaveBeenCalled();
  });

  it('tokens the server rejects are not treated as a session', async () => {
    mockAuth.setSession.mockResolvedValue({ data: {}, error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found') });
    expect(await supabaseAuthBackend.confirmPasswordResetSession?.('cellar://auth-callback#access_token=AT&refresh_token=RT')).toBe(false);
  });
});
