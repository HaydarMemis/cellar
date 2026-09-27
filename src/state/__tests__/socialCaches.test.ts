import { communityBackend, moderationBackend } from '../../data/community';
import { useCommunityStore } from '../communityStore';
import { useModerationStore } from '../moderationStore';

beforeEach(() => jest.restoreAllMocks());

it('a failed like-count refresh keeps what is on screen', async () => {
  useCommunityStore.setState({ likeCounts: { r1: 7 }, likedByMe: new Set(['r1']) });
  jest.spyOn(communityBackend, 'getLikeCounts').mockRejectedValue(new Error('offline'));
  await useCommunityStore.getState().refreshLikes(['r1'], 'me');
  expect(useCommunityStore.getState().likeCounts.r1).toBe(7);
  expect(useCommunityStore.getState().likedByMe.has('r1')).toBe(true);
});

it('a failed block-list refresh never un-hides blocked creators', async () => {
  useModerationStore.setState({ blockedByMe: new Set(['bad-user']) });
  jest.spyOn(moderationBackend, 'getBlockedUserIds').mockRejectedValue(new Error('offline'));
  await useModerationStore.getState().refreshBlocked('me');
  expect(useModerationStore.getState().blockedByMe.has('bad-user')).toBe(true);
});

it('a failed follow-state refresh keeps the current state', async () => {
  useCommunityStore.setState({ followingByMe: new Set(['u2']), followCountsByUser: { u2: { followers: 5, following: 1 } } });
  jest.spyOn(communityBackend, 'getFollowCounts').mockRejectedValue(new Error('offline'));
  await useCommunityStore.getState().refreshFollowState('u2', 'me');
  expect(useCommunityStore.getState().followingByMe.has('u2')).toBe(true);
  expect(useCommunityStore.getState().followCountsByUser.u2.followers).toBe(5);
});

it('reset clears per-account social caches', () => {
  useModerationStore.setState({ blockedByMe: new Set(['x']) });
  useModerationStore.getState().reset();
  expect(useModerationStore.getState().blockedByMe.size).toBe(0);
});
