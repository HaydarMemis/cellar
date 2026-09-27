import { supabaseAuthBackend } from '../SupabaseAuthBackend';

/**
 * Sign-up against a project with email confirmation ON (the live Cellar
 * project's setting). Verified against the real migrations in an embedded
 * Postgres: inserting the profile while the client is still anonymous is
 * rejected by RLS (42501) — which the old code reported as "username taken".
 */
const mockSignUp = jest.fn();
const mockSignOut = jest.fn(() => Promise.resolve({ error: null }));
const mockUpserts: unknown[] = [];
let mockUpsertError: unknown = null;
let mockExistingUsername: unknown = null;

jest.mock('../client', () => ({
  get supabase() {
    return {
      auth: { signUp: (...a: unknown[]) => mockSignUp(...a), signOut: (...a: unknown[]) => (mockSignOut as jest.Mock)(...a) },
      from: () => {
        const q: Record<string, unknown> = {};
        q.select = () => q;
        q.eq = () => q;
        q.maybeSingle = () => Promise.resolve({ data: mockExistingUsername, error: null });
        q.upsert = (row: unknown) => {
          mockUpserts.push(row);
          return Promise.resolve({ error: mockUpsertError });
        };
        return q;
      },
    };
  },
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: ({ path }: { path: string }) => `cellar://${path}` }));

const input = { username: 'Alice_1', displayName: 'Alice', email: 'Alice@Example.com', password: 'secret12' };

beforeEach(() => {
  mockSignUp.mockReset();
  mockSignOut.mockClear();
  mockUpserts.length = 0;
  mockUpsertError = null;
  mockExistingUsername = null;
});

it('pending confirmation: returns pending-confirmation and does NOT attempt the (RLS-rejected) profile insert', async () => {
  mockSignUp.mockResolvedValue({ data: { user: { id: 'u1', identities: [{ id: 'i' }] }, session: null }, error: null });
  const result = await supabaseAuthBackend.signUp(input);
  expect(result).toEqual({ ok: 'pending-confirmation', email: 'alice@example.com' });
  expect(mockUpserts).toHaveLength(0);
});

it('stores the chosen username/display name on the auth user and sets the confirmation redirect', async () => {
  mockSignUp.mockResolvedValue({ data: { user: { id: 'u1', identities: [{ id: 'i' }] }, session: null }, error: null });
  await supabaseAuthBackend.signUp(input);
  const arg = mockSignUp.mock.calls[0][0];
  expect(arg.options.data).toEqual({ username: 'alice_1', display_name: 'Alice' });
  expect(arg.options.emailRedirectTo).toBe('cellar://auth-callback');
});

// Behavior change (authentication phase): this used to report 'email-taken',
// which let anyone probe which addresses have Cellar accounts — exactly
// what Supabase's obfuscated no-identities response is designed to
// prevent. It now answers like any sign-up; the "check your email" screen
// tells existing users to sign in or reset their password instead.
it('an already-registered email (no identities, Supabase anti-enumeration response) answers like a new sign-up', async () => {
  mockSignUp.mockResolvedValue({ data: { user: { id: 'u1', identities: [] }, session: null }, error: null });
  expect(await supabaseAuthBackend.signUp(input)).toEqual({ ok: 'pending-confirmation', email: 'alice@example.com' });
  expect(mockUpserts).toHaveLength(0);
});

it('with a session (confirmation off), creates the profile', async () => {
  mockSignUp.mockResolvedValue({ data: { user: { id: 'u1', identities: [{ id: 'i' }] }, session: { access_token: 'x' } }, error: null });
  const result = await supabaseAuthBackend.signUp(input);
  expect(result.ok).toBe(true);
  expect(mockUpserts).toHaveLength(1);
});

it('a non-unique-violation profile error is not misreported as username-taken', async () => {
  mockSignUp.mockResolvedValue({ data: { user: { id: 'u1', identities: [{ id: 'i' }] }, session: { access_token: 'x' } }, error: null });
  mockUpsertError = { code: '42501', message: 'rls' };
  expect(await supabaseAuthBackend.signUp(input)).toEqual({ ok: false, error: 'network-error' });
  // The session sign-up created must not stay live behind a reported failure.
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  mockUpsertError = { code: '23505', message: 'duplicate' };
  expect(await supabaseAuthBackend.signUp(input)).toEqual({ ok: false, error: 'username-taken' });
});

it('still rejects a username that is already taken before creating an auth user', async () => {
  mockExistingUsername = { id: 'someone-else' };
  expect(await supabaseAuthBackend.signUp(input)).toEqual({ ok: false, error: 'username-taken' });
  expect(mockSignUp).not.toHaveBeenCalled();
});
