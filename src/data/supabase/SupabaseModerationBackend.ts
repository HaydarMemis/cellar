import { reportError } from '../../lib/crashReporting';
import { DuplicateReportError, ModerationBackend } from '../community/ModerationBackend';
import { supabase } from './client';

/** Postgres unique_violation — thrown when the exact same block already exists (blocks' unique(blocker_id, blocked_id)) or when the same reporter already has an open report against the same target (reports' partial unique index) — see supabase/migrations/. */
const UNIQUE_VIOLATION = '23505';
/** Raised by the reports BEFORE INSERT trigger (supabase/migrations/20260927120000_audit_hardening.sql) when the reported recipe/user does not exist (e.g. the recipe was unpublished or the account deleted since it was shown) or is the reporter themselves. Same SQLSTATE as a plain FK violation, so the trigger's hint is what identifies it. */
const FOREIGN_KEY_VIOLATION = '23503';
const REPORT_TARGET_NOT_FOUND_HINT = 'report_target_not_found';
/** Raised by the same trigger when the reporter has filed 20+ reports in the last hour. */
const PROGRAM_LIMIT_EXCEEDED = '54000';

/** The reported recipe/user no longer exists (or is the reporter). Expected, user-facing — not crash-reported. */
export class ReportTargetUnavailableError extends Error {
  constructor() {
    super('The reported content no longer exists.');
    this.name = 'ReportTargetUnavailableError';
  }
}

/** The reporter hit the server-side report rate limit (20 per hour). Expected, user-facing — not crash-reported; retrying immediately will fail again. */
export class ReportRateLimitedError extends Error {
  constructor() {
    super('Too many reports submitted recently. Please try again later.');
    this.name = 'ReportRateLimitedError';
  }
}

function isReportTargetNotFound(error: { code?: string; hint?: string | null; message?: string }): boolean {
  return (
    error.code === FOREIGN_KEY_VIOLATION &&
    (error.hint === REPORT_TARGET_NOT_FOUND_HINT || (error.message ?? '').includes('report target not found'))
  );
}

function client() {
  if (!supabase) throw new Error('SupabaseModerationBackend used without a configured Supabase client');
  return supabase;
}

/** A REAL implementation of ModerationBackend against Supabase's `reports`/`blocks` tables — see supabase/schema.sql for their RLS policies (reports are reporter-only readable; nobody else's block list is visible to a client). */
export const supabaseModerationBackend: ModerationBackend = {
  async reportContent(reporterId, targetType, targetId, reason, details) {
    const { error } = await client()
      .from('reports')
      .insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason, details: details?.trim() || null });
    if (error?.code === UNIQUE_VIOLATION) throw new DuplicateReportError();
    if (error && isReportTargetNotFound(error)) throw new ReportTargetUnavailableError();
    if (error?.code === PROGRAM_LIMIT_EXCEEDED) throw new ReportRateLimitedError();
    if (error) {
      reportError(error, { module: 'SupabaseModerationBackend', action: 'reportContent', targetType, targetId });
      throw error;
    }
  },

  async blockUser(blockerId, blockedId) {
    const { error } = await client().from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
    if (error && error.code !== UNIQUE_VIOLATION) {
      reportError(error, { module: 'SupabaseModerationBackend', action: 'blockUser', blockedId });
      throw error;
    }
  },

  async unblockUser(blockerId, blockedId) {
    const { error } = await client().from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
    if (error) {
      reportError(error, { module: 'SupabaseModerationBackend', action: 'unblockUser', blockedId });
      throw error;
    }
  },

  async getBlockedUserIds(blockerId) {
    const { data, error } = await client().from('blocks').select('blocked_id').eq('blocker_id', blockerId);
    // Throw rather than return [] — an empty list would silently un-hide
    // every blocked creator on a transient network error.
    if (error) throw error;
    return (data ?? []).map((row) => row.blocked_id);
  },

  async isBlocked(blockerId, blockedId) {
    const { data } = await client().from('blocks').select('id').eq('blocker_id', blockerId).eq('blocked_id', blockedId).maybeSingle();
    return !!data;
  },

  async removeUserData() {
    // No-op: both `blocks.blocker_id`/`blocks.blocked_id` are ON DELETE
    // CASCADE against profiles(id), so deleting the auth user (see the
    // delete-account Edge Function) already removes block rows
    // server-side. `reports.reporter_id` is ON DELETE SET NULL instead of
    // CASCADE (see supabase/migrations/20260922000300_reports_retention_and_dedupe.sql)
    // — filed reports deliberately survive their reporter's account
    // deletion, retained for moderation, just no longer attributable to a
    // specific account. A client-side delete here would be redundant for
    // blocks and actively wrong for reports.
  },
};
