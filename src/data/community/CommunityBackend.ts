import { generateId } from '../../domain/id';
import { FollowEntry, LikeEntry } from '../../domain/types';
import { JsonStore } from '../storage/jsonStore';

/**
 * Likes and follows for published (public) recipes. "Public recipes"
 * themselves are not duplicated here — they're just PersonalRecipe rows
 * with visibility: 'public' (see RecipeRepository); this backend only owns
 * the social graph on top of them. Same local-only caveat as AuthBackend:
 * real, working, on-device — ready to swap for a hosted implementation.
 */
export interface CommunityBackend {
  toggleLike(userId: string, recipeId: string): Promise<boolean>;
  hasLiked(userId: string, recipeId: string): Promise<boolean>;
  getLikeCounts(recipeIds: string[]): Promise<Record<string, number>>;
  getLikedSet(userId: string, recipeIds: string[]): Promise<Set<string>>;
  toggleFollow(followerId: string, followingId: string): Promise<boolean>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  getFollowCounts(userId: string): Promise<{ followers: number; following: number }>;
  /** Account deletion support: strips every like and follow relationship involving this account, in either direction. */
  removeUserData(userId: string): Promise<void>;
}

function isLikeArray(value: unknown): value is LikeEntry[] {
  return Array.isArray(value) && value.every((v) => v && typeof v.userId === 'string' && typeof v.recipeId === 'string');
}

function isFollowArray(value: unknown): value is FollowEntry[] {
  return Array.isArray(value) && value.every((v) => v && typeof v.followerId === 'string' && typeof v.followingId === 'string');
}

const likesStore = new JsonStore<LikeEntry[]>('@community/likes', isLikeArray, []);
const followsStore = new JsonStore<FollowEntry[]>('@community/follows', isFollowArray, []);

export const localCommunityBackend: CommunityBackend = {
  async toggleLike(userId, recipeId) {
    let didLike = false;
    await likesStore.update((all) => {
      const exists = all.some((l) => l.userId === userId && l.recipeId === recipeId);
      if (exists) {
        didLike = false;
        return all.filter((l) => !(l.userId === userId && l.recipeId === recipeId));
      }
      didLike = true;
      const entry: LikeEntry = { id: generateId('like'), userId, recipeId, createdAt: new Date().toISOString() };
      return [...all, entry];
    });
    return didLike;
  },

  async hasLiked(userId, recipeId) {
    const all = await likesStore.read();
    return all.some((l) => l.userId === userId && l.recipeId === recipeId);
  },

  async getLikeCounts(recipeIds) {
    const all = await likesStore.read();
    const counts: Record<string, number> = {};
    for (const id of recipeIds) counts[id] = 0;
    for (const like of all) {
      if (like.recipeId in counts) counts[like.recipeId] += 1;
    }
    return counts;
  },

  async getLikedSet(userId, recipeIds) {
    const all = await likesStore.read();
    const idSet = new Set(recipeIds);
    return new Set(all.filter((l) => l.userId === userId && idSet.has(l.recipeId)).map((l) => l.recipeId));
  },

  async toggleFollow(followerId, followingId) {
    let didFollow = false;
    await followsStore.update((all) => {
      const exists = all.some((f) => f.followerId === followerId && f.followingId === followingId);
      if (exists) {
        didFollow = false;
        return all.filter((f) => !(f.followerId === followerId && f.followingId === followingId));
      }
      didFollow = true;
      const entry: FollowEntry = { id: generateId('follow'), followerId, followingId, createdAt: new Date().toISOString() };
      return [...all, entry];
    });
    return didFollow;
  },

  async isFollowing(followerId, followingId) {
    const all = await followsStore.read();
    return all.some((f) => f.followerId === followerId && f.followingId === followingId);
  },

  async getFollowCounts(userId) {
    const all = await followsStore.read();
    return {
      followers: all.filter((f) => f.followingId === userId).length,
      following: all.filter((f) => f.followerId === userId).length,
    };
  },

  async removeUserData(userId) {
    await likesStore.update((all) => all.filter((l) => l.userId !== userId));
    await followsStore.update((all) => all.filter((f) => f.followerId !== userId && f.followingId !== userId));
  },
};
