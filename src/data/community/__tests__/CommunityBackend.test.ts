import AsyncStorage from '@react-native-async-storage/async-storage';
import { localCommunityBackend } from '../CommunityBackend';

describe('localCommunityBackend likes', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts at zero likes for an unliked recipe', async () => {
    const counts = await localCommunityBackend.getLikeCounts(['recipe-1']);
    expect(counts['recipe-1']).toBe(0);
  });

  it('toggling like on then off returns to zero', async () => {
    await localCommunityBackend.toggleLike('user-a', 'recipe-1');
    expect((await localCommunityBackend.getLikeCounts(['recipe-1']))['recipe-1']).toBe(1);
    expect(await localCommunityBackend.hasLiked('user-a', 'recipe-1')).toBe(true);

    await localCommunityBackend.toggleLike('user-a', 'recipe-1');
    expect((await localCommunityBackend.getLikeCounts(['recipe-1']))['recipe-1']).toBe(0);
    expect(await localCommunityBackend.hasLiked('user-a', 'recipe-1')).toBe(false);
  });

  it('counts likes from multiple distinct users', async () => {
    await localCommunityBackend.toggleLike('user-a', 'recipe-1');
    await localCommunityBackend.toggleLike('user-b', 'recipe-1');
    expect((await localCommunityBackend.getLikeCounts(['recipe-1']))['recipe-1']).toBe(2);
  });

  it('getLikedSet only returns recipes the given user liked', async () => {
    await localCommunityBackend.toggleLike('user-a', 'recipe-1');
    await localCommunityBackend.toggleLike('user-b', 'recipe-2');
    const liked = await localCommunityBackend.getLikedSet('user-a', ['recipe-1', 'recipe-2']);
    expect(liked.has('recipe-1')).toBe(true);
    expect(liked.has('recipe-2')).toBe(false);
  });
});

describe('localCommunityBackend follows', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('is not following by default', async () => {
    expect(await localCommunityBackend.isFollowing('user-a', 'user-b')).toBe(false);
  });

  it('toggling follow updates both isFollowing and follower/following counts', async () => {
    await localCommunityBackend.toggleFollow('user-a', 'user-b');
    expect(await localCommunityBackend.isFollowing('user-a', 'user-b')).toBe(true);

    const bCounts = await localCommunityBackend.getFollowCounts('user-b');
    expect(bCounts.followers).toBe(1);

    const aCounts = await localCommunityBackend.getFollowCounts('user-a');
    expect(aCounts.following).toBe(1);
  });

  it('unfollowing removes the relationship', async () => {
    await localCommunityBackend.toggleFollow('user-a', 'user-b');
    await localCommunityBackend.toggleFollow('user-a', 'user-b');
    expect(await localCommunityBackend.isFollowing('user-a', 'user-b')).toBe(false);
    expect((await localCommunityBackend.getFollowCounts('user-b')).followers).toBe(0);
  });
});
