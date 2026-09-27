import AsyncStorage from '@react-native-async-storage/async-storage';
import { DuplicateReportError, localModerationBackend } from '../ModerationBackend';

/**
 * Regression coverage for the production backend hardening sprint:
 * duplicate-report throttling (mirrors the Postgres partial unique index
 * added in supabase/migrations/20260922000300_reports_retention_and_dedupe.sql
 * so local and Supabase behavior match), plus the pre-existing block
 * flows.
 */
describe('localModerationBackend', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('reportContent', () => {
    it('accepts a report', async () => {
      await expect(localModerationBackend.reportContent('user-a', 'recipe', 'recipe-1', 'spam')).resolves.toBeUndefined();
    });

    it('rejects a second open report from the same reporter against the same target', async () => {
      await localModerationBackend.reportContent('user-a', 'recipe', 'recipe-1', 'spam');
      await expect(localModerationBackend.reportContent('user-a', 'recipe', 'recipe-1', 'inappropriate')).rejects.toBeInstanceOf(
        DuplicateReportError,
      );
    });

    it('allows a different reporter to report the same target', async () => {
      await localModerationBackend.reportContent('user-a', 'recipe', 'recipe-1', 'spam');
      await expect(localModerationBackend.reportContent('user-b', 'recipe', 'recipe-1', 'spam')).resolves.toBeUndefined();
    });

    it('allows the same reporter to report a different target', async () => {
      await localModerationBackend.reportContent('user-a', 'recipe', 'recipe-1', 'spam');
      await expect(localModerationBackend.reportContent('user-a', 'recipe', 'recipe-2', 'spam')).resolves.toBeUndefined();
    });

    it('allows the same reporter/target pair across a "user" vs "recipe" target type (not a real duplicate)', async () => {
      await localModerationBackend.reportContent('user-a', 'user', 'target-1', 'harassment');
      await expect(localModerationBackend.reportContent('user-a', 'recipe', 'target-1', 'spam')).resolves.toBeUndefined();
    });

    it('concurrent duplicate reports from the same reporter resolve to exactly one success and one rejection', async () => {
      const results = await Promise.allSettled([
        localModerationBackend.reportContent('user-a', 'recipe', 'recipe-1', 'spam'),
        localModerationBackend.reportContent('user-a', 'recipe', 'recipe-1', 'spam'),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
    });
  });

  describe('blocking', () => {
    it('a block is reflected in getBlockedUserIds and isBlocked', async () => {
      await localModerationBackend.blockUser('user-a', 'user-b');
      expect(await localModerationBackend.getBlockedUserIds('user-a')).toEqual(['user-b']);
      expect(await localModerationBackend.isBlocked('user-a', 'user-b')).toBe(true);
    });

    it('blocking the same user twice does not create a duplicate entry', async () => {
      await localModerationBackend.blockUser('user-a', 'user-b');
      await localModerationBackend.blockUser('user-a', 'user-b');
      expect(await localModerationBackend.getBlockedUserIds('user-a')).toEqual(['user-b']);
    });

    it('unblocking removes the block', async () => {
      await localModerationBackend.blockUser('user-a', 'user-b');
      await localModerationBackend.unblockUser('user-a', 'user-b');
      expect(await localModerationBackend.isBlocked('user-a', 'user-b')).toBe(false);
    });

    it('a block is directional — the blocked user does not see themselves as blocking back', async () => {
      await localModerationBackend.blockUser('user-a', 'user-b');
      expect(await localModerationBackend.isBlocked('user-b', 'user-a')).toBe(false);
    });
  });

  describe('removeUserData (account deletion)', () => {
    it('removes reports filed by the deleted user', async () => {
      await localModerationBackend.reportContent('user-a', 'recipe', 'recipe-1', 'spam');
      await localModerationBackend.removeUserData('user-a');
      // the open-report guard would reject a re-report if the old one were still there
      await expect(localModerationBackend.reportContent('user-a', 'recipe', 'recipe-1', 'spam')).resolves.toBeUndefined();
    });

    it('removes blocks the deleted user made and blocks made against them', async () => {
      await localModerationBackend.blockUser('user-a', 'user-b');
      await localModerationBackend.blockUser('user-c', 'user-a');

      await localModerationBackend.removeUserData('user-a');

      expect(await localModerationBackend.getBlockedUserIds('user-a')).toEqual([]);
      expect(await localModerationBackend.getBlockedUserIds('user-c')).toEqual([]);
    });
  });
});
