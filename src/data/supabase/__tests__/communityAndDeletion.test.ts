import { supabaseAuthBackend } from '../SupabaseAuthBackend';
import { supabaseCommunityBackend } from '../SupabaseCommunityBackend';

const mockRpc = jest.fn();
const mockInvoke = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue({ error: null });
let mockLikeRows: { recipe_id: string }[] = [];

jest.mock('../client', () => ({
  get supabase() {
    return {
      rpc: (...a: unknown[]) => mockRpc(...a),
      functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
      auth: { signOut: () => mockSignOut() },
      from: () => {
        const q: Record<string, unknown> = {};
        q.select = () => q;
        q.eq = () => q;
        q.in = () => Promise.resolve({ data: mockLikeRows, error: null });
        return q;
      },
    };
  },
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'cellar://x' }));


beforeEach(() => {
  mockRpc.mockReset();
  mockInvoke.mockReset();
  mockLikeRows = [];
});

describe('like counts', () => {
  it('are aggregated by the database function', async () => {
    mockRpc.mockResolvedValue({ data: [{ recipe_id: 'a', like_count: '3' }], error: null });
    expect(await supabaseCommunityBackend.getLikeCounts(['a', 'b'])).toEqual({ a: 3, b: 0 });
    expect(mockRpc).toHaveBeenCalledWith('recipe_like_counts', { recipe_ids: ['a', 'b'] });
  });

  it('fall back to counting rows if the function is not deployed yet', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } });
    mockLikeRows = [{ recipe_id: 'a' }, { recipe_id: 'a' }];
    expect(await supabaseCommunityBackend.getLikeCounts(['a'])).toEqual({ a: 2 });
  });

  it('throw on a real failure instead of showing 0 likes', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '08006', message: 'connection failure' } });
    await expect(supabaseCommunityBackend.getLikeCounts(['a'])).rejects.toMatchObject({ code: '08006' });
  });
});

describe('account deletion request', () => {
  it('sends the Apple authorization code so the Edge Function can revoke Sign in with Apple', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    await supabaseAuthBackend.deleteAccount('u1', { appleAuthorizationCode: 'c0de' });
    expect(mockInvoke).toHaveBeenCalledWith('delete-account', { body: { userId: 'u1', appleAuthorizationCode: 'c0de' } });
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('a failed deletion throws (nothing local is changed by the caller)', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('500') });
    await expect(supabaseAuthBackend.deleteAccount('u1')).rejects.toThrow('500');
  });
});
