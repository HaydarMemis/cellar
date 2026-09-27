import { create } from 'zustand';
import { communityBackend } from '../data/community';
import { reportError } from '../lib/crashReporting';

interface FollowCounts {
  followers: number;
  following: number;
}

interface CommunityState {
  likeCounts: Record<string, number>;
  likedByMe: Set<string>;
  followingByMe: Set<string>;
  followCountsByUser: Record<string, FollowCounts>;
  refreshLikes: (recipeIds: string[], myUserId: string | null) => Promise<void>;
  toggleLike: (recipeId: string, myUserId: string) => Promise<void>;
  refreshFollowState: (profileUserId: string, myUserId: string | null) => Promise<void>;
  toggleFollow: (profileUserId: string, myUserId: string) => Promise<void>;
  /** Drops every cached "liked by me"/"following" flag — called whenever the signed-in identity changes (see authStore), so account B never sees account A's hearts or follow buttons. */
  reset: () => void;
}

/** Ids with a like/follow write in flight — a second tap while one is pending is ignored rather than racing the first (select-then-insert on the backend). */
const pendingLikes = new Set<string>();
const pendingFollows = new Set<string>();

/** Reactive cache over CommunityBackend (likes/follows) — see src/data/community. Recipe/profile data itself stays in recipesStore/authStore; this only owns the social graph. */
export const useCommunityStore = create<CommunityState>((set, get) => ({
  likeCounts: {},
  likedByMe: new Set(),
  followingByMe: new Set(),
  followCountsByUser: {},

  refreshLikes: async (recipeIds, myUserId) => {
    if (recipeIds.length === 0) return;
    let counts: Record<string, number>;
    let liked: Set<string>;
    try {
      counts = await communityBackend.getLikeCounts(recipeIds);
      liked = myUserId ? await communityBackend.getLikedSet(myUserId, recipeIds) : new Set<string>();
    } catch (e) {
      // Keep what's on screen rather than flashing everything to 0 likes.
      reportError(e, { module: 'communityStore', action: 'refreshLikes' });
      return;
    }
    set((state) => {
      // Authoritative for exactly the requested ids: add what's liked AND
      // remove what isn't (the previous union-only merge could never clear a
      // stale "liked" flag — e.g. one left over from another account).
      const nextLiked = new Set(state.likedByMe);
      for (const id of recipeIds) {
        if (liked.has(id)) nextLiked.add(id);
        else nextLiked.delete(id);
      }
      return { likeCounts: { ...state.likeCounts, ...counts }, likedByMe: nextLiked };
    });
  },

  toggleLike: async (recipeId, myUserId) => {
    if (pendingLikes.has(recipeId)) return;
    pendingLikes.add(recipeId);
    const wasLiked = get().likedByMe.has(recipeId);
    const currentCount = get().likeCounts[recipeId] ?? 0;
    const nextLiked = new Set(get().likedByMe);
    if (wasLiked) nextLiked.delete(recipeId);
    else nextLiked.add(recipeId);
    set({
      likedByMe: nextLiked,
      likeCounts: { ...get().likeCounts, [recipeId]: Math.max(0, currentCount + (wasLiked ? -1 : 1)) },
    });
    try {
      await communityBackend.toggleLike(myUserId, recipeId);
    } catch (e) {
      // The backend rejected it (most likely: a block exists between the
      // two users, which the RLS insert policy now enforces server-side)
      // — roll the optimistic update back rather than leaving the UI
      // showing "liked" for something that never actually persisted.
      reportError(e, { module: 'communityStore', action: 'toggleLike', recipeId });
      const reverted = new Set(get().likedByMe);
      if (wasLiked) reverted.add(recipeId);
      else reverted.delete(recipeId);
      set({ likedByMe: reverted, likeCounts: { ...get().likeCounts, [recipeId]: currentCount } });
    } finally {
      pendingLikes.delete(recipeId);
    }
  },

  refreshFollowState: async (profileUserId, myUserId) => {
    let counts: FollowCounts;
    let isFollowing: boolean;
    try {
      counts = await communityBackend.getFollowCounts(profileUserId);
      isFollowing = myUserId ? await communityBackend.isFollowing(myUserId, profileUserId) : false;
    } catch (e) {
      reportError(e, { module: 'communityStore', action: 'refreshFollowState' });
      return;
    }
    set((state) => {
      const nextFollowing = new Set(state.followingByMe);
      if (isFollowing) nextFollowing.add(profileUserId);
      else nextFollowing.delete(profileUserId);
      return { followCountsByUser: { ...state.followCountsByUser, [profileUserId]: counts }, followingByMe: nextFollowing };
    });
  },

  toggleFollow: async (profileUserId, myUserId) => {
    if (pendingFollows.has(profileUserId)) return;
    pendingFollows.add(profileUserId);
    const wasFollowing = get().followingByMe.has(profileUserId);
    const counts = get().followCountsByUser[profileUserId] ?? { followers: 0, following: 0 };
    const nextFollowing = new Set(get().followingByMe);
    if (wasFollowing) nextFollowing.delete(profileUserId);
    else nextFollowing.add(profileUserId);
    set({
      followingByMe: nextFollowing,
      followCountsByUser: {
        ...get().followCountsByUser,
        [profileUserId]: { ...counts, followers: Math.max(0, counts.followers + (wasFollowing ? -1 : 1)) },
      },
    });
    try {
      await communityBackend.toggleFollow(myUserId, profileUserId);
    } catch (e) {
      // Same rationale as toggleLike's rollback above — most likely cause
      // is the RLS insert policy rejecting a follow between blocked users.
      reportError(e, { module: 'communityStore', action: 'toggleFollow', profileUserId });
      const reverted = new Set(get().followingByMe);
      if (wasFollowing) reverted.add(profileUserId);
      else reverted.delete(profileUserId);
      set({ followingByMe: reverted, followCountsByUser: { ...get().followCountsByUser, [profileUserId]: counts } });
    } finally {
      pendingFollows.delete(profileUserId);
    }
  },

  reset: () => set({ likedByMe: new Set(), followingByMe: new Set() }),
}));
