import { generateId } from '../../domain/id';
import { JsonStore } from '../storage/jsonStore';

export type ReportTargetType = 'recipe' | 'user';
export type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'copyright' | 'other';
export type ReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned';

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  createdAt: string;
}

/** Thrown by reportContent() when the same reporter already has an open (unreviewed) report against the same target — mirrors the Postgres partial-unique-index constraint on the Supabase backend (see supabase/migrations/20260922000300_reports_retention_and_dedupe.sql), reproduced here so local-backend behavior matches exactly and the UI can show one honest, non-technical message regardless of which backend is active. */
export class DuplicateReportError extends Error {
  constructor() {
    super('An open report already exists for this reporter/target.');
    this.name = 'DuplicateReportError';
  }
}

/**
 * User-generated-content safety: reporting and blocking. Shipping a public
 * feed with no moderation path at all is exactly what the production audit
 * ruled out — this interface is real and functional end-to-end, on both
 * the local dev backend (this file) and the real Supabase backend
 * (SupabaseModerationBackend), selected the same way as every other
 * backend seam — see src/data/community/index.ts.
 *
 * What differs by backend is what happens to a report after filing it:
 * locally, it is stored on-device only — there is no moderation team to
 * receive it, and the app never claims otherwise (see the honest,
 * backend-aware copy in app/report.tsx). Once Supabase is configured,
 * reports land in a real `reports` table (supabase/schema.sql),
 * reviewable via the Supabase dashboard or a future admin tool.
 *
 * Blocking is fully real and effective on BOTH backends immediately: it is
 * purely client-side content filtering (hide a blocked user's recipes from
 * the blocker's own Discover feed and creator profile), which needs no
 * server round-trip to be correct.
 */
export interface ModerationBackend {
  reportContent(reporterId: string, targetType: ReportTargetType, targetId: string, reason: ReportReason, details?: string): Promise<void>;
  blockUser(blockerId: string, blockedId: string): Promise<void>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  getBlockedUserIds(blockerId: string): Promise<string[]>;
  isBlocked(blockerId: string, blockedId: string): Promise<boolean>;
  /** Called from account deletion (see useAuthStore.deleteAccount) — removes this user's filed reports and every block involving them, in either direction. Mirrors the ON DELETE CASCADE behavior of supabase/schema.sql's `reports`/`blocks` tables, so local and Supabase accounts clean up identically. */
  removeUserData(userId: string): Promise<void>;
}

function isReportArray(value: unknown): value is Report[] {
  return Array.isArray(value) && value.every((v) => v && typeof v.id === 'string' && typeof v.reporterId === 'string');
}

function isBlockMap(value: unknown): value is Record<string, string[]> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const reportsStore = new JsonStore<Report[]>('@community/reports', isReportArray, []);
const blocksStore = new JsonStore<Record<string, string[]>>('@community/blocks', isBlockMap, {});

export const localModerationBackend: ModerationBackend = {
  async reportContent(reporterId, targetType, targetId, reason, details) {
    // The duplicate check and the write must happen inside the SAME
    // queued update() callback — checking with a separate read() first
    // would leave a window where two concurrent calls both see "no
    // duplicate" and both insert, exactly the race this guard exists to
    // prevent. JsonStore.update() serializes callbacks one at a time.
    let duplicate = false;
    await reportsStore.update((reports) => {
      duplicate = reports.some(
        (r) => r.reporterId === reporterId && r.targetType === targetType && r.targetId === targetId && r.status === 'open',
      );
      if (duplicate) return reports;

      const report: Report = {
        id: generateId('report'),
        reporterId,
        targetType,
        targetId,
        reason,
        details: details?.trim() || undefined,
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      return [...reports, report];
    });
    if (duplicate) throw new DuplicateReportError();
  },

  async blockUser(blockerId, blockedId) {
    await blocksStore.update((map) => ({
      ...map,
      [blockerId]: Array.from(new Set([...(map[blockerId] ?? []), blockedId])),
    }));
  },

  async unblockUser(blockerId, blockedId) {
    await blocksStore.update((map) => ({
      ...map,
      [blockerId]: (map[blockerId] ?? []).filter((id) => id !== blockedId),
    }));
  },

  async getBlockedUserIds(blockerId) {
    const map = await blocksStore.read();
    return map[blockerId] ?? [];
  },

  async isBlocked(blockerId, blockedId) {
    const map = await blocksStore.read();
    return (map[blockerId] ?? []).includes(blockedId);
  },

  async removeUserData(userId) {
    await reportsStore.update((reports) => reports.filter((r) => r.reporterId !== userId));
    await blocksStore.update((map) => {
      const next: Record<string, string[]> = {};
      for (const [blockerId, blockedIds] of Object.entries(map)) {
        if (blockerId === userId) continue;
        next[blockerId] = blockedIds.filter((id) => id !== userId);
      }
      return next;
    });
  },
};
