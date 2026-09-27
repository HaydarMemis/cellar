import { reportError } from '../../lib/crashReporting';
import { CommunityBackend } from '../community/CommunityBackend';
import { supabase } from './client';

function client() {
  if (!supabase) throw new Error('SupabaseCommunityBackend used without a configured Supabase client');
  return supabase;
}

/**
 * A REAL implementation of CommunityBackend (likes/follows) against
 * Supabase — see supabase/schema.sql for the `likes`/`follows` tables and
 * their RLS policies. Every insert/delete result here is checked for an
 * `error`, not discarded — this matters concretely, not just as hygiene:
 * the RLS insert policies reject a like/follow between two users who have
 * blocked each other (either direction), so a blocked interaction now
 * genuinely fails server-side, and silently swallowing that error would
 * leave the UI's optimistic "liked!" state permanently wrong (see
 * useCommunityStore, which rolls back its optimistic update when these
 * throw).
 */
export const supabaseCommunityBackend: CommunityBackend = {
  async toggleLike(userId, recipeId) {
    const existing = await client().from('likes').select('id').eq('user_id', userId).eq('recipe_id', recipeId).maybeSingle();
    if (existing.data) {
      const { error } = await client().from('likes').delete().eq('id', existing.data.id);
      if (error) {
        reportError(error, { module: 'SupabaseCommunityBackend', action: 'toggleLike:delete', recipeId });
        throw error;
      }
      return false;
    }
    const { error } = await client().from('likes').insert({ user_id: userId, recipe_id: recipeId });
    if (error) {
      reportError(error, { module: 'SupabaseCommunityBackend', action: 'toggleLike:insert', recipeId });
      throw error;
    }
    return true;
  },

  async hasLiked(userId, recipeId) {
    const { data } = await client().from('likes').select('id').eq('user_id', userId).eq('recipe_id', recipeId).maybeSingle();
    return !!data;
  },

  async getLikeCounts(recipeIds) {
    const counts: Record<string, number> = {};
    for (const id of recipeIds) counts[id] = 0;
    if (recipeIds.length === 0) return counts;
    // Aggregated in the database (migration 20260926120000). Falls back to
    // counting rows client-side only if that function isn't deployed yet.
    const { data, error } = await client().rpc('recipe_like_counts', { recipe_ids: recipeIds });
    if (!error) {
      for (const row of (data ?? []) as { recipe_id: string; like_count: number | string }[]) {
        if (row.recipe_id in counts) counts[row.recipe_id] = Number(row.like_count);
      }
      return counts;
    }
    if (error.code !== 'PGRST202' && error.code !== '42883') {
      reportError(error, { module: 'SupabaseCommunityBackend', action: 'getLikeCounts' });
      throw error;
    }
    const fallback = await client().from('likes').select('recipe_id').in('recipe_id', recipeIds);
    if (fallback.error) throw fallback.error;
    for (const row of fallback.data ?? []) {
      if (row.recipe_id in counts) counts[row.recipe_id] += 1;
    }
    return counts;
  },

  async getLikedSet(userId, recipeIds) {
    if (recipeIds.length === 0) return new Set();
    const { data, error } = await client().from('likes').select('recipe_id').eq('user_id', userId).in('recipe_id', recipeIds);
    if (error) throw error;
    return new Set((data ?? []).map((row) => row.recipe_id));
  },

  async toggleFollow(followerId, followingId) {
    const existing = await client().from('follows').select('id').eq('follower_id', followerId).eq('following_id', followingId).maybeSingle();
    if (existing.data) {
      const { error } = await client().from('follows').delete().eq('id', existing.data.id);
      if (error) {
        reportError(error, { module: 'SupabaseCommunityBackend', action: 'toggleFollow:delete', followingId });
        throw error;
      }
      return false;
    }
    const { error } = await client().from('follows').insert({ follower_id: followerId, following_id: followingId });
    if (error) {
      reportError(error, { module: 'SupabaseCommunityBackend', action: 'toggleFollow:insert', followingId });
      throw error;
    }
    return true;
  },

  async isFollowing(followerId, followingId) {
    const { data, error } = await client().from('follows').select('id').eq('follower_id', followerId).eq('following_id', followingId).maybeSingle();
    if (error) throw error;
    return !!data;
  },

  async getFollowCounts(userId) {
    const [followers, following] = await Promise.all([
      client().from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
      client().from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);
    if (followers.error) throw followers.error;
    if (following.error) throw following.error;
    return { followers: followers.count ?? 0, following: following.count ?? 0 };
  },

  async removeUserData(userId) {
    await Promise.all([
      client().from('likes').delete().eq('user_id', userId),
      client().from('follows').delete().eq('follower_id', userId),
      client().from('follows').delete().eq('following_id', userId),
    ]);
  },
};
