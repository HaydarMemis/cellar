import { classifySyncError, fieldFromMessage } from '../syncErrors';
import { MediaUploadError } from '../supabase/mediaUpload';

function pgError(code: string, message = 'boom', status?: number) {
  return Object.assign(new Error(message), { code, details: '', hint: '', ...(status !== undefined ? { status } : {}) });
}

describe('classifySyncError — retryable (stays pendingSync, retried automatically)', () => {
  it.each([
    ['offline fetch failure', new TypeError('Network request failed')],
    ['postgrest fetch failure (code "", status 0)', pgError('', 'TypeError: Network request failed', 0)],
    ['aborted/timed out request', Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })],
    ['auth refresh fetch failure', Object.assign(new Error('fetch failed'), { name: 'AuthRetryableFetchError', status: 0 })],
    ['5xx', pgError('', 'Internal Server Error', 503)],
    ['408 timeout', pgError('', 'Request Timeout', 408)],
    ['429 rate limit', pgError('', 'Too Many Requests', 429)],
    ['401 expired session (refreshed and retried)', pgError('PGRST301', 'JWT expired', 401)],
    ['FK violation (profile row not created yet)', pgError('23503', 'violates foreign key constraint "recipes_owner_id_fkey"')],
    ['a transient storage upload failure', new MediaUploadError('Internal', 'upload-failed', 500)],
    ['a storage upload failure with no status', new MediaUploadError('socket hang up', 'upload-failed')],
    ['anything unknown', new Error('something odd')],
    ['a non-error value', 'weird'],
  ])('%s', (_label, error) => {
    expect(classifySyncError(error)).toEqual({ kind: 'retryable' });
  });
});

describe('classifySyncError — permanent (not retried; surfaced as syncError)', () => {
  it('local photo problems', () => {
    expect(classifySyncError(new MediaUploadError('gone', 'read-failed'))).toMatchObject({ kind: 'permanent', reason: 'photoMissing' });
    expect(classifySyncError(new MediaUploadError('type', 'unsupported-type'))).toMatchObject({ kind: 'permanent', reason: 'photoUnsupported' });
    expect(classifySyncError(new MediaUploadError('big', 'too-large'))).toMatchObject({ kind: 'permanent', reason: 'photoTooLarge' });
    expect(classifySyncError(new MediaUploadError('big', 'upload-failed', 413))).toMatchObject({ kind: 'permanent', reason: 'photoTooLarge' });
    expect(classifySyncError(new MediaUploadError('rls', 'upload-failed', 403))).toMatchObject({ kind: 'permanent', reason: 'notAllowed' });
    expect(classifySyncError(new MediaUploadError('mime', 'upload-failed', 400))).toMatchObject({ kind: 'permanent', reason: 'photoRejected' });
  });

  it('check constraint violations name the offending field', () => {
    expect(classifySyncError(pgError('23514', 'new row for relation "recipes" violates check constraint "recipes_method_valid"', 400))).toEqual({
      kind: 'permanent',
      reason: 'invalidRecipe',
      field: 'method',
    });
    expect(classifySyncError(pgError('23514', 'violates check constraint "recipes_glass_bounded"'))).toMatchObject({ field: 'glass' });
    expect(classifySyncError(pgError('23514', 'violates check constraint "recipes_steps_bounded"'))).toMatchObject({ field: 'steps' });
    expect(classifySyncError(pgError('23514', 'violates check constraint "recipes_tags_bounded"'))).toMatchObject({ field: 'tags' });
    expect(classifySyncError(pgError('23514', 'violates check constraint "recipes_ingredients_shape"'))).toMatchObject({ field: 'ingredients' });
    expect(classifySyncError(pgError('23514', 'violates check constraint "recipes_photo_url_own_object"'))).toMatchObject({ field: 'photo' });
    expect(classifySyncError(pgError('23514', 'violates check constraint "recipes_base_spirit_length"'))).toMatchObject({ field: 'baseSpirit' });
  });

  it('other data / integrity errors and RLS rejections', () => {
    expect(classifySyncError(pgError('22P02', 'invalid input value for enum recipe_method: "fry"'))).toMatchObject({ kind: 'permanent', reason: 'invalidRecipe' });
    expect(classifySyncError(pgError('23502', 'null value in column "name" violates not-null constraint'))).toMatchObject({ reason: 'invalidRecipe', field: 'name' });
    expect(classifySyncError(pgError('22001', 'value too long for type character varying(120)'))).toMatchObject({ kind: 'permanent', reason: 'invalidRecipe' });
    expect(classifySyncError(pgError('42501', 'new row violates row-level security policy for table "recipes"', 403))).toMatchObject({ kind: 'permanent', reason: 'notAllowed' });
    expect(classifySyncError(pgError('23505', 'duplicate key value violates unique constraint "recipes_pkey"', 409))).toMatchObject({ kind: 'permanent' });
  });

  it('other 4xx responses', () => {
    expect(classifySyncError(pgError('PGRST204', "Could not find the 'x' column", 400))).toMatchObject({ kind: 'permanent', reason: 'rejected' });
    expect(classifySyncError(pgError('', 'Forbidden', 403))).toMatchObject({ kind: 'permanent', reason: 'notAllowed' });
  });
});

describe('fieldFromMessage', () => {
  it('never reads user text from the failing-row details', () => {
    expect(fieldFromMessage('Failing row contains (glass, method, steps).')).toBeUndefined();
  });
});
