/**
 * Profile creation on first sign-in (after email confirmation, or via Apple /
 * Google): chosen username honored, collisions resolved with a suffix, an
 * existing profile never overwritten, Apple private-relay emails not used as
 * usernames.
 */
import { createProfileOnFirstSignIn } from '../SupabaseAuthBackend';

const mockUpserts: { row: Record<string, string>; options: unknown }[] = [];
let mockResponses: { data: unknown; error: unknown }[] = [];
let mockExisting: unknown = null;

jest.mock('../client', () => ({
  get supabase() {
    return {
      from: () => {
        const q: Record<string, unknown> = {};
        q.select = () => q;
        q.eq = () => q;
        q.maybeSingle = () => Promise.resolve(mockUpserts.length > 0 && mockResponses.length === 0 ? { data: mockExisting, error: null } : mockResponses.shift() ?? { data: mockExisting, error: null });
        q.upsert = (row: Record<string, string>, options: unknown) => {
          mockUpserts.push({ row, options });
          return q;
        };
        return q;
      },
    };
  },
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'cellar://x' }));


const created = (username: string, display: string) => ({
  data: { id: 'u1', username, display_name: display, bio: null, avatar_color_seed: username, created_at: 'x' },
  error: null,
});

beforeEach(() => {
  mockUpserts.length = 0;
  mockResponses = [];
  mockExisting = null;
});

it('uses the username chosen at sign-up', async () => {
  mockResponses = [created('alice_1', 'Alice')];
  const profile = await createProfileOnFirstSignIn('u1', { username: 'alice_1', display_name: 'Alice' }, 'a@x.com');
  expect(profile?.username).toBe('alice_1');
  expect(mockUpserts[0].options).toEqual({ onConflict: 'id', ignoreDuplicates: true });
});

it('a username taken meanwhile gets a numeric suffix instead of locking the account out', async () => {
  mockResponses = [{ data: null, error: { code: '23505' } }, created('alice_1_1234', 'Alice')];
  const profile = await createProfileOnFirstSignIn('u1', { username: 'alice_1' }, 'a@x.com');
  expect(mockUpserts).toHaveLength(2);
  expect(mockUpserts[1].row.username).toMatch(/^alice_1_\d{4}$/);
  expect(profile?.username).toMatch(/^alice_1_\d{4}$/);
});

it('never overwrites an existing profile (conflict on id => reads the existing row)', async () => {
  mockExisting = { id: 'u1', username: 'kept', display_name: 'Edited Name', bio: 'bio', avatar_color_seed: 'k', created_at: 'x' };
  mockResponses = [{ data: null, error: null }];
  const profile = await createProfileOnFirstSignIn('u1', { username: 'other' }, 'a@x.com');
  expect(profile).toMatchObject({ username: 'kept', displayName: 'Edited Name' });
});

it('Apple “Hide My Email”: builds the username from the name, not the random relay address', async () => {
  mockResponses = [created('ada_lovelace', 'Ada Lovelace')];
  await createProfileOnFirstSignIn('u1', {}, 'x7kq2m9p@privaterelay.appleid.com', { fullName: 'Ada Lovelace' });
  expect(mockUpserts[0].row.username).toBe('adalovelace');
  expect(mockUpserts[0].row.display_name).toBe('Ada Lovelace');
});

it('Turkish characters are transliterated into a valid username', async () => {
  mockResponses = [created('sukru', 'Şükrü')];
  await createProfileOnFirstSignIn('u1', {}, undefined, { fullName: 'Şükrü Işık' });
  expect(mockUpserts[0].row.username).toBe('sukruisik');
});
