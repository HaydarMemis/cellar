/**
 * Profile photo upload: exact object path, JPEG content type, upsert,
 * cache-busted public URL, and error mapping (offline / too large / RLS).
 */
import { AvatarError, avatarObjectPath, isAvatarUrlFor, removeAvatarObject, toAvatarError, uploadAvatar } from '../avatarUpload';

const mockFiles = new Map<string, Uint8Array>();

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      return mockFiles.get(this.uri)?.length ?? 0;
    }
    async bytes() {
      return mockFiles.get(this.uri) ?? new Uint8Array();
    }
  },
}));

const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockFrom = jest.fn();
jest.mock('../client', () => ({
  supabase: {
    storage: {
      from: (bucket: string) => {
        mockFrom(bucket);
        return {
          upload: (...a: unknown[]) => mockUpload(...a),
          remove: (...a: unknown[]) => mockRemove(...a),
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
        };
      },
    },
  },
}));

jest.mock('../../../lib/crashReporting', () => ({ reportError: jest.fn() }));

const USER = '11111111-1111-4111-8111-111111111111';
const PROCESSED = 'file:///cache/ImageManipulator/processed.jpg';
// Must match public.profile_avatar_url_ok in supabase/migrations/20260928120000_profile_avatars.sql.
const SERVER_URL_PATTERN = new RegExp(`^https://[a-z0-9]{20}\\.supabase\\.co/storage/v1/object/public/avatars/${USER}/avatar(\\?v=[0-9]+)?$`);

beforeEach(() => {
  mockFiles.clear();
  mockFiles.set(PROCESSED, new Uint8Array([1, 2, 3]));
  mockUpload.mockReset().mockResolvedValue({ data: { path: `${USER}/avatar` }, error: null });
  mockRemove.mockReset().mockResolvedValue({ data: [], error: null });
  mockFrom.mockReset();
});

describe('uploadAvatar', () => {
  it('upserts the JPEG bytes to avatars/<uid>/avatar and returns a versioned public URL the DB constraint accepts', async () => {
    const before = Date.now();
    const url = await uploadAvatar(USER, PROCESSED);
    expect(mockFrom).toHaveBeenCalledWith('avatars');
    expect(mockUpload).toHaveBeenCalledWith(`${USER}/avatar`, new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg', upsert: true });
    expect(url).toMatch(SERVER_URL_PATTERN);
    const version = Number(new URL(url).searchParams.get('v'));
    expect(version).toBeGreaterThanOrEqual(before);
    expect(isAvatarUrlFor(url, USER)).toBe(true);
  });

  it('a missing processed file is processing-failed and nothing is uploaded', async () => {
    mockFiles.clear();
    await expect(uploadAvatar(USER, PROCESSED)).rejects.toMatchObject({ name: 'AvatarError', code: 'processing-failed' });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('a file over the 5 MB bucket limit is too-large before any network call', async () => {
    mockFiles.set(PROCESSED, new Uint8Array(5 * 1024 * 1024 + 1));
    await expect(uploadAvatar(USER, PROCESSED)).rejects.toMatchObject({ code: 'too-large' });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('offline (fetch throws) is a retryable offline error', async () => {
    mockUpload.mockRejectedValue(new TypeError('Network request failed'));
    await expect(uploadAvatar(USER, PROCESSED)).rejects.toMatchObject({ code: 'offline' });
  });

  it('offline (storage-js returns the wrapped fetch error) is offline too', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { name: 'StorageUnknownError', message: 'Network request failed' } });
    await expect(uploadAvatar(USER, PROCESSED)).rejects.toMatchObject({ code: 'offline' });
  });

  it('a server-side size rejection (413) is too-large', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'The object exceeded the maximum allowed size', statusCode: '413' } });
    await expect(uploadAvatar(USER, PROCESSED)).rejects.toMatchObject({ code: 'too-large', status: 413 });
  });

  it('an RLS rejection is upload-failed and keeps its HTTP status', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'new row violates row-level security policy', statusCode: '403' } });
    const error = await uploadAvatar(USER, PROCESSED).catch((e) => e);
    expect(error).toBeInstanceOf(AvatarError);
    expect(error).toMatchObject({ code: 'upload-failed', status: 403 });
  });
});

describe('removeAvatarObject', () => {
  it('removes exactly avatars/<uid>/avatar', async () => {
    await removeAvatarObject(USER);
    expect(mockFrom).toHaveBeenCalledWith('avatars');
    expect(mockRemove).toHaveBeenCalledWith([`${USER}/avatar`]);
  });

  it('offline removal fails with offline (the caller keeps the photo)', async () => {
    mockRemove.mockRejectedValue(new TypeError('Network request failed'));
    await expect(removeAvatarObject(USER)).rejects.toMatchObject({ code: 'offline' });
  });
});

describe('helpers', () => {
  it('avatarObjectPath is the single allowed path', () => {
    expect(avatarObjectPath(USER)).toBe(`${USER}/avatar`);
  });

  it('isAvatarUrlFor matches only this user (ignoring the cache-buster)', () => {
    const url = `https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars/${USER}/avatar?v=1`;
    expect(isAvatarUrlFor(url, USER)).toBe(true);
    expect(isAvatarUrlFor(url, '22222222-2222-4222-8222-222222222222')).toBe(false);
    expect(isAvatarUrlFor(`https://x/recipe-media/${USER}/avatar`, USER)).toBe(false);
  });

  it('toAvatarError maps timeouts to offline and unknown failures to upload-failed', () => {
    expect(toAvatarError({ name: 'AbortError', message: 'Aborted' }).code).toBe('offline');
    expect(toAvatarError(new Error('The request timed out')).code).toBe('offline');
    expect(toAvatarError({ message: 'Internal Server Error', status: 500 }).code).toBe('upload-failed');
    expect(toAvatarError(undefined).code).toBe('upload-failed');
  });
});

describe('storage error → diagnostic reference', () => {
  it('turns storage-js errors into a stable code', () => {
    const { storageErrorForDiagnostics } = jest.requireActual('../avatarUpload') as typeof import('../avatarUpload');
    expect(storageErrorForDiagnostics({ name: 'StorageApiError', message: 'new row violates row-level security policy', error: 'Unauthorized' }, 403)).toEqual({
      name: 'StorageApiError',
      status: 403,
      code: 'unauthorized',
      message: 'new row violates row-level security policy',
    });
    expect(storageErrorForDiagnostics({ message: 'Bucket not found', error: 'Bucket not found' }, 404).code).toBe('bucket_not_found');
  });
});
