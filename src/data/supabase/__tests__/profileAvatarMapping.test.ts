/**
 * profiles.avatar_url <-> UserProfile.avatarUrl, and updateProfile writing
 * (or clearing) avatar_url.
 */
import { supabaseAuthBackend, toProfile } from '../SupabaseAuthBackend';

const mockUpdates: Record<string, unknown>[] = [];
let mockRow: Record<string, unknown> | null = null;

jest.mock('../client', () => ({
  get supabase() {
    return {
      from: () => {
        const q: Record<string, unknown> = {};
        q.select = () => q;
        q.eq = () => q;
        q.update = (update: Record<string, unknown>) => {
          mockUpdates.push(update);
          mockRow = { ...(mockRow ?? {}), ...update };
          return q;
        };
        q.maybeSingle = () => Promise.resolve({ data: mockRow, error: null });
        return q;
      },
    };
  },
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'cellar://x' }));

const URL_V = 'https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars/u1/avatar?v=1';
const baseRow = { id: 'u1', username: 'alice', display_name: 'Alice', bio: null, avatar_color_seed: 'alice', created_at: '2026-09-28T00:00:00Z' };

beforeEach(() => {
  mockUpdates.length = 0;
  mockRow = { ...baseRow, avatar_url: null };
});

describe('toProfile', () => {
  it('maps avatar_url to avatarUrl', () => {
    expect(toProfile({ ...baseRow, avatar_url: URL_V }).avatarUrl).toBe(URL_V);
  });

  it('null / missing avatar_url (un-migrated database) means no photo — the key is absent', () => {
    expect('avatarUrl' in toProfile({ ...baseRow, avatar_url: null })).toBe(false);
    expect('avatarUrl' in toProfile(baseRow)).toBe(false);
  });
});

describe('supabaseAuthBackend.updateProfile', () => {
  it('writes avatar_url and returns the mapped profile', async () => {
    const updated = await supabaseAuthBackend.updateProfile('u1', { avatarUrl: URL_V });
    expect(mockUpdates).toEqual([{ avatar_url: URL_V }]);
    expect(updated?.avatarUrl).toBe(URL_V);
  });

  it('null clears the photo', async () => {
    mockRow = { ...baseRow, avatar_url: URL_V };
    const updated = await supabaseAuthBackend.updateProfile('u1', { avatarUrl: null });
    expect(mockUpdates).toEqual([{ avatar_url: null }]);
    expect(updated?.avatarUrl).toBeUndefined();
  });

  it('a name/bio edit never touches avatar_url', async () => {
    await supabaseAuthBackend.updateProfile('u1', { displayName: 'A', bio: 'b' });
    expect(mockUpdates).toEqual([{ display_name: 'A', bio: 'b' }]);
  });
});
