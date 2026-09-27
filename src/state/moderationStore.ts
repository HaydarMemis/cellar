import { create } from 'zustand';
import { moderationBackend, ReportReason, ReportTargetType } from '../data/community';
import { reportError } from '../lib/crashReporting';

interface ModerationState {
  blockedByMe: Set<string>;
  refreshBlocked: (myUserId: string | null) => Promise<void>;
  toggleBlock: (blockedUserId: string, myUserId: string) => Promise<void>;
  /** Clears the cached block list on any identity change (see authStore). */
  reset: () => void;
  report: (reporterId: string, targetType: ReportTargetType, targetId: string, reason: ReportReason, details?: string) => Promise<void>;
}

/**
 * Reactive cache over ModerationBackend (reports/blocks) — mirrors
 * communityStore's shape (Set-based membership, optimistic toggle) so the
 * two feel consistent. `blockedByMe` is what Discover/creator-profile
 * screens filter published recipes against; see app/(tabs)/discover.tsx
 * and app/creator/[id].tsx.
 */
export const useModerationStore = create<ModerationState>((set, get) => ({
  blockedByMe: new Set(),

  refreshBlocked: async (myUserId) => {
    if (!myUserId) {
      set({ blockedByMe: new Set() });
      return;
    }
    try {
      const ids = await moderationBackend.getBlockedUserIds(myUserId);
      set({ blockedByMe: new Set(ids) });
    } catch (e) {
      // Keep the current block list — never un-hide blocked creators on a failed refresh.
      reportError(e, { module: 'moderationStore', action: 'refreshBlocked' });
    }
  },

  toggleBlock: async (blockedUserId, myUserId) => {
    const wasBlocked = get().blockedByMe.has(blockedUserId);
    const next = new Set(get().blockedByMe);
    if (wasBlocked) next.delete(blockedUserId);
    else next.add(blockedUserId);
    set({ blockedByMe: next });
    try {
      if (wasBlocked) await moderationBackend.unblockUser(myUserId, blockedUserId);
      else await moderationBackend.blockUser(myUserId, blockedUserId);
    } catch (e) {
      reportError(e, { module: 'moderationStore', action: 'toggleBlock', blockedUserId });
      const reverted = new Set(get().blockedByMe);
      if (wasBlocked) reverted.add(blockedUserId);
      else reverted.delete(blockedUserId);
      set({ blockedByMe: reverted });
    }
  },

  reset: () => set({ blockedByMe: new Set() }),

  report: async (reporterId, targetType, targetId, reason, details) => {
    await moderationBackend.reportContent(reporterId, targetType, targetId, reason, details);
  },
}));
