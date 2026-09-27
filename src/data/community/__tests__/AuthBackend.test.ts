import AsyncStorage from '@react-native-async-storage/async-storage';
import { localAuthBackend } from '../AuthBackend';

describe('localAuthBackend', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('creates an account and starts a session', async () => {
    const result = await localAuthBackend.signUp({ username: 'gin_fan', displayName: 'Gin Fan', email: 'gin_fan@example.com', password: 'secret1' });
    expect(result.ok).toBe(true);
    if (result.ok !== true) return;
    expect(result.profile.username).toBe('gin_fan');

    const session = await localAuthBackend.getSession();
    expect(session?.userId).toBe(result.profile.id);
  });

  it('getCurrentUserEmail resolves the signed-in account\'s own email, and null when signed out', async () => {
    expect(await localAuthBackend.getCurrentUserEmail()).toBeNull();

    await localAuthBackend.signUp({ username: 'email_check', displayName: 'Email Check', email: 'email_check@example.com', password: 'secret1' });
    expect(await localAuthBackend.getCurrentUserEmail()).toBe('email_check@example.com');

    await localAuthBackend.logOut();
    expect(await localAuthBackend.getCurrentUserEmail()).toBeNull();
  });

  it('rejects a duplicate username even with a different email', async () => {
    await localAuthBackend.signUp({ username: 'taken', displayName: 'First', email: 'first@example.com', password: 'secret1' });
    const second = await localAuthBackend.signUp({ username: 'taken', displayName: 'Second', email: 'second@example.com', password: 'secret2' });
    expect(second).toEqual({ ok: false, error: 'username-taken' });
  });

  it('rejects a duplicate email even with a different username', async () => {
    await localAuthBackend.signUp({ username: 'first_user', displayName: 'First', email: 'shared@example.com', password: 'secret1' });
    const second = await localAuthBackend.signUp({ username: 'second_user', displayName: 'Second', email: 'shared@example.com', password: 'secret2' });
    expect(second).toEqual({ ok: false, error: 'email-taken' });
  });

  it('rejects an invalid username, invalid email, or too-short password', async () => {
    expect(await localAuthBackend.signUp({ username: 'ab', displayName: 'X', email: 'x@example.com', password: 'secret1' })).toEqual({
      ok: false,
      error: 'invalid-username',
    });
    expect(await localAuthBackend.signUp({ username: 'validname', displayName: 'X', email: 'not-an-email', password: 'secret1' })).toEqual({
      ok: false,
      error: 'invalid-email',
    });
    expect(await localAuthBackend.signUp({ username: 'validname', displayName: 'X', email: 'x@example.com', password: '123' })).toEqual({
      ok: false,
      error: 'invalid-password',
    });
  });

  it('logs in by email with correct credentials and rejects the wrong password', async () => {
    await localAuthBackend.signUp({ username: 'barkeep', displayName: 'Barkeep', email: 'barkeep@example.com', password: 'correct1' });

    const wrong = await localAuthBackend.logIn({ email: 'barkeep@example.com', password: 'wrong-password' });
    expect(wrong).toEqual({ ok: false, error: 'wrong-password' });

    const right = await localAuthBackend.logIn({ email: 'barkeep@example.com', password: 'correct1' });
    expect(right.ok).toBe(true);
  });

  it('login email is case-insensitive', async () => {
    await localAuthBackend.signUp({ username: 'barkeep', displayName: 'Barkeep', email: 'Barkeep@Example.com', password: 'correct1' });
    const result = await localAuthBackend.logIn({ email: 'barkeep@example.com', password: 'correct1' });
    expect(result.ok).toBe(true);
  });

  it('rejects login for an email that was never registered', async () => {
    const result = await localAuthBackend.logIn({ email: 'ghost@example.com', password: 'whatever1' });
    expect(result).toEqual({ ok: false, error: 'not-found' });
  });

  it('clears the session on log out', async () => {
    await localAuthBackend.signUp({ username: 'someone', displayName: 'Someone', email: 'someone@example.com', password: 'secret1' });
    expect(await localAuthBackend.getSession()).not.toBeNull();

    await localAuthBackend.logOut();
    expect(await localAuthBackend.getSession()).toBeNull();
  });

  it('updates a profile field and persists it', async () => {
    const created = await localAuthBackend.signUp({ username: 'editme', displayName: 'Before', email: 'editme@example.com', password: 'secret1' });
    if (created.ok !== true) throw new Error('setup failed');

    const updated = await localAuthBackend.updateProfile(created.profile.id, { bio: 'Rum enthusiast.' });
    expect(updated?.bio).toBe('Rum enthusiast.');

    const fetched = await localAuthBackend.getProfile(created.profile.id);
    expect(fetched?.bio).toBe('Rum enthusiast.');
  });

  it('username lookup is case-insensitive at sign-up time', async () => {
    await localAuthBackend.signUp({ username: 'MixedCase', displayName: 'A', email: 'a@example.com', password: 'secret1' });
    const second = await localAuthBackend.signUp({ username: 'mixedcase', displayName: 'B', email: 'b@example.com', password: 'secret2' });
    expect(second).toEqual({ ok: false, error: 'username-taken' });
  });

  it('never returns a pending-confirmation outcome — the local backend has no email delivery to wait on', async () => {
    const result = await localAuthBackend.signUp({ username: 'instant', displayName: 'Instant', email: 'instant@example.com', password: 'secret1' });
    expect(result.ok).toBe(true);
  });

  describe('requestPasswordReset / resendConfirmationEmail', () => {
    it('are always an honest "not supported offline" failure, never a simulated send', async () => {
      await localAuthBackend.signUp({ username: 'someone', displayName: 'Someone', email: 'someone@example.com', password: 'secret1' });
      expect(await localAuthBackend.requestPasswordReset('someone@example.com')).toEqual({ ok: false, error: 'not-supported-offline' });
      expect(await localAuthBackend.resendConfirmationEmail('someone@example.com')).toEqual({ ok: false, error: 'not-supported-offline' });
    });
  });

  describe('getProfilesByIds', () => {
    it('returns only the requested profiles, not every account', async () => {
      const a = await localAuthBackend.signUp({ username: 'alice', displayName: 'Alice', email: 'alice@example.com', password: 'secret1' });
      const b = await localAuthBackend.signUp({ username: 'bob', displayName: 'Bob', email: 'bob@example.com', password: 'secret1' });
      await localAuthBackend.signUp({ username: 'carol', displayName: 'Carol', email: 'carol@example.com', password: 'secret1' });
      if (a.ok !== true || b.ok !== true) throw new Error('setup failed');

      const result = await localAuthBackend.getProfilesByIds([a.profile.id, b.profile.id]);
      expect(result.map((p) => p.username).sort()).toEqual(['alice', 'bob']);
    });

    it('returns an empty array for an empty input without touching storage', async () => {
      await localAuthBackend.signUp({ username: 'alice', displayName: 'Alice', email: 'alice@example.com', password: 'secret1' });
      expect(await localAuthBackend.getProfilesByIds([])).toEqual([]);
    });

    it('silently omits ids that do not correspond to a real account', async () => {
      const a = await localAuthBackend.signUp({ username: 'alice', displayName: 'Alice', email: 'alice@example.com', password: 'secret1' });
      if (a.ok !== true) throw new Error('setup failed');
      const result = await localAuthBackend.getProfilesByIds([a.profile.id, 'not-a-real-id']);
      expect(result.map((p) => p.username)).toEqual(['alice']);
    });
  });
});
