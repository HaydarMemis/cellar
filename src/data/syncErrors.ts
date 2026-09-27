/**
 * Classifies a failed publish/unpublish so the app can tell "try again
 * later" (offline, timeouts, server hiccups — retried automatically via
 * PersonalRecipe.pendingSync) from "the backend rejected this recipe"
 * (retrying the same data can never succeed — surfaced to the author via
 * PersonalRecipe.syncError instead of looping forever behind a "will be
 * published automatically" promise).
 *
 * Unknown errors are RETRYABLE: the safe default is today's behavior
 * (keep trying), never silently giving up on a publish.
 */

/** Stable codes stored in PersonalRecipe.syncError.reason and translated under `publish.syncErrorReason.*`. */
export type SyncErrorReason =
  | 'photoMissing'
  | 'photoUnsupported'
  | 'photoTooLarge'
  | 'photoRejected'
  | 'invalidRecipe'
  | 'notAllowed'
  | 'rejected';

/** Recipe fields a constraint name can point at — translated under `publish.syncErrorField.*`. */
export type SyncErrorField =
  | 'name'
  | 'description'
  | 'method'
  | 'glass'
  | 'steps'
  | 'tags'
  | 'category'
  | 'ingredients'
  | 'garnish'
  | 'abv'
  | 'prepTime'
  | 'difficulty'
  | 'baseSpirit'
  | 'photo'
  | 'video';

export type SyncErrorClassification =
  | { kind: 'retryable' }
  | { kind: 'permanent'; reason: SyncErrorReason; field?: SyncErrorField };

/** Postgres SQLSTATEs that mean "this data / this request is never going to be accepted as-is". */
const PERMANENT_SQLSTATES: Record<string, SyncErrorReason> = {
  '23514': 'invalidRecipe', // check_violation
  '23502': 'invalidRecipe', // not_null_violation
  '23505': 'rejected', // unique_violation (e.g. id already used by another owner's row)
  '22P02': 'invalidRecipe', // invalid_text_representation (bad enum/uuid/int)
  '22001': 'invalidRecipe', // string_data_right_truncation
  '22003': 'invalidRecipe', // numeric_value_out_of_range
  '22023': 'invalidRecipe', // invalid_parameter_value
  '22007': 'invalidRecipe', // invalid_datetime_format
  '42501': 'notAllowed', // insufficient_privilege / RLS rejection
  P0001: 'invalidRecipe', // raise_exception from a validation trigger
};

/** Checked in order, most specific first (e.g. `base_spirit` before anything shorter). */
const FIELD_HINTS: [RegExp, SyncErrorField][] = [
  [/base_spirit/, 'baseSpirit'],
  [/prep_time/, 'prepTime'],
  [/photo/, 'photo'],
  [/video/, 'video'],
  [/ingredient/, 'ingredients'],
  [/description/, 'description'],
  [/difficulty/, 'difficulty'],
  [/category/, 'category'],
  [/garnish/, 'garnish'],
  [/method/, 'method'],
  [/glass/, 'glass'],
  [/step/, 'steps'],
  [/tag/, 'tags'],
  [/abv/, 'abv'],
  [/name/, 'name'],
];

interface ErrorLike {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  details?: unknown;
}

function asErrorLike(error: unknown): ErrorLike {
  return error && typeof error === 'object' ? (error as ErrorLike) : {};
}

function httpStatus(e: ErrorLike): number | undefined {
  if (typeof e.status === 'number' && e.status > 0) return e.status;
  if (typeof e.statusCode === 'string' && /^\d{3}$/.test(e.statusCode)) return Number(e.statusCode);
  return undefined;
}

/** Best-effort: which recipe field a constraint/column error message refers to. */
export function fieldFromMessage(text: string): SyncErrorField | undefined {
  const lower = text.toLowerCase();
  // Prefer the constraint name (`violates check constraint "recipes_glass_valid"`), then the column (`column "method"`).
  const constraint = /constraint "([^"]+)"/.exec(lower)?.[1];
  const column = /column "([^"]+)"/.exec(lower)?.[1];
  // Never the whole message: its "Failing row contains (...)" details hold user text.
  for (const candidate of [constraint?.replace(/^recipes_/, ''), column]) {
    if (!candidate) continue;
    for (const [pattern, field] of FIELD_HINTS) if (pattern.test(candidate)) return field;
  }
  return undefined;
}

export function classifySyncError(error: unknown): SyncErrorClassification {
  const e = asErrorLike(error);
  const name = typeof e.name === 'string' ? e.name : '';
  const message = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  const text = `${message} ${typeof e.details === 'string' ? e.details : ''}`;

  // Transport-level failures: offline, DNS, aborted/timed-out requests, auth refresh hiccups.
  if (name === 'AuthRetryableFetchError' || name === 'AbortError' || name === 'TimeoutError') return { kind: 'retryable' };
  if (/network request failed|failed to fetch|network ?error|timed? ?out|timeout|aborted|offline/i.test(message)) return { kind: 'retryable' };

  // Local media problems (see mediaUpload.ts / localMedia.ts): the file itself is the problem.
  if (name === 'MediaUploadError') {
    if (code === 'read-failed') return { kind: 'permanent', reason: 'photoMissing', field: 'photo' };
    if (code === 'unsupported-type') return { kind: 'permanent', reason: 'photoUnsupported', field: 'photo' };
    if (code === 'too-large') return { kind: 'permanent', reason: 'photoTooLarge', field: 'photo' };
    // 'upload-failed' — decided by the storage HTTP status below.
    const status = httpStatus(e);
    if (status === 413) return { kind: 'permanent', reason: 'photoTooLarge', field: 'photo' };
    if (status === 415) return { kind: 'permanent', reason: 'photoUnsupported', field: 'photo' };
    if (status !== undefined && isPermanentHttpStatus(status)) return { kind: 'permanent', reason: status === 403 ? 'notAllowed' : 'photoRejected', field: 'photo' };
    return { kind: 'retryable' };
  }

  // Postgres / PostgREST.
  const sqlReason = PERMANENT_SQLSTATES[code];
  if (sqlReason) {
    const field = fieldFromMessage(text);
    return field ? { kind: 'permanent', reason: sqlReason, field } : { kind: 'permanent', reason: sqlReason };
  }
  // Any other integrity-constraint (23xxx, except FK 23503 — the profile row may simply not exist yet) or data-exception (22xxx) class.
  if (/^(22|23)[0-9A-Z]{3}$/.test(code) && code !== '23503') {
    const field = fieldFromMessage(text);
    return field ? { kind: 'permanent', reason: 'invalidRecipe', field } : { kind: 'permanent', reason: 'invalidRecipe' };
  }

  const status = httpStatus(e);
  if (status !== undefined && isPermanentHttpStatus(status)) {
    return { kind: 'permanent', reason: status === 403 ? 'notAllowed' : 'rejected' };
  }
  return { kind: 'retryable' };
}

/**
 * 4xx means "this request is wrong", except: 408 (timeout) and 429 (rate
 * limited) are transient, and 401 is an expired/refreshing session — the
 * client refreshes the token and the same request then succeeds.
 */
function isPermanentHttpStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
}
