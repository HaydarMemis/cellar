import {
  deleteManagedLocalPhoto,
  isManagedLocalPhoto,
  managedPhotoFileName,
  PhotoProcessingError,
  prepareRecipePhoto,
  resolveLocalPhotoUri,
} from '../localMedia';
import { isRecipeMediaUrlFor, MediaUploadError, uploadRecipeMedia } from '../supabase/mediaUpload';

/**
 * Recipe photos: stable references, legacy-URI resolution, no unprocessed
 * fallbacks. expo-file-system is replaced with a tiny in-memory fake so the
 * tests can simulate an iOS container move (the documents directory path
 * changes between app versions / after a restore).
 */
const mockFs = {
  documentUri: 'file:///var/mobile/Containers/Data/Application/NEW-CONTAINER/Documents',
  files: new Map<string, Uint8Array>(),
  copies: [] as [string, string][],
  deleted: [] as string[],
  failCopy: false,
};

jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts
      .map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri))
      .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')))
      .join('/');
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return true;
    }
    create() {}
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockFs.files.has(this.uri);
    }
    get size() {
      return mockFs.files.get(this.uri)?.length ?? 0;
    }
    get type() {
      return '';
    }
    async bytes() {
      return mockFs.files.get(this.uri) ?? new Uint8Array();
    }
    async copy(target: { uri: string }) {
      if (mockFs.failCopy) throw new Error('copy failed');
      mockFs.copies.push([this.uri, target.uri]);
      mockFs.files.set(target.uri, mockFs.files.get(this.uri) ?? new Uint8Array([1]));
    }
    delete() {
      mockFs.deleted.push(this.uri);
      mockFs.files.delete(this.uri);
    }
  }
  return {
    Directory,
    File,
    Paths: {
      get document() {
        return new Directory(mockFs.documentUri);
      },
    },
  };
});

const mockManipulate = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (...a: unknown[]) => mockManipulate(...a) },
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockUpload = jest.fn();
jest.mock('../supabase/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => mockUpload(...a),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/recipe-media/${path}` } }),
      }),
    },
  },
}));

const NEW_DIR = `${mockFs.documentUri}/recipe-photos`;
const OLD_ABSOLUTE = 'file:///var/mobile/Containers/Data/Application/OLD-CONTAINER/Documents/recipe-photos/lx1-abc123.jpg';

function processedTo(uri: string) {
  mockManipulate.mockReturnValue({
    resize: jest.fn(),
    renderAsync: async () => ({ saveAsync: async () => ({ uri }) }),
  });
}

beforeEach(() => {
  mockFs.files.clear();
  mockFs.copies.length = 0;
  mockFs.deleted.length = 0;
  mockFs.failCopy = false;
  mockManipulate.mockReset();
  mockUpload.mockReset().mockResolvedValue({ error: null });
});

describe('stored photo references', () => {
  it('recognizes both the relative form and legacy absolute URIs from any container', () => {
    expect(managedPhotoFileName('recipe-photos/lx1-abc123.jpg')).toBe('lx1-abc123.jpg');
    expect(managedPhotoFileName(OLD_ABSOLUTE)).toBe('lx1-abc123.jpg');
    expect(managedPhotoFileName(`${NEW_DIR}/x.jpg`)).toBe('x.jpg');
    expect(isManagedLocalPhoto('recipe-photos/a.jpg')).toBe(true);
    expect(isManagedLocalPhoto(OLD_ABSOLUTE)).toBe(true);
  });

  it('never treats other files as managed (so they are never deleted)', () => {
    expect(isManagedLocalPhoto('file:///var/mobile/Containers/Data/Application/X/Library/Caches/ImagePicker/a.jpg')).toBe(false);
    expect(isManagedLocalPhoto('https://x.supabase.co/storage/v1/object/public/recipe-media/u/r/photo')).toBe(false);
    expect(isManagedLocalPhoto('content://media/external/images/media/1')).toBe(false);
    expect(isManagedLocalPhoto('recipe-photos/../secrets.json')).toBe(false);
    expect(isManagedLocalPhoto('recipe-photos/nested/a.jpg')).toBe(false);
    expect(isManagedLocalPhoto(undefined)).toBe(false);
  });

  it('resolves a relative reference under the CURRENT documents directory', () => {
    expect(resolveLocalPhotoUri('recipe-photos/lx1-abc123.jpg')).toBe(`${NEW_DIR}/lx1-abc123.jpg`);
  });

  it('re-resolves a legacy absolute URI from a previous app container by file name', () => {
    expect(resolveLocalPhotoUri(OLD_ABSOLUTE)).toBe(`${NEW_DIR}/lx1-abc123.jpg`);
  });

  it('leaves current absolute URIs, remote URLs and unmanaged URIs unchanged', () => {
    expect(resolveLocalPhotoUri(`${NEW_DIR}/a.jpg`)).toBe(`${NEW_DIR}/a.jpg`);
    expect(resolveLocalPhotoUri('https://cdn/x.jpg')).toBe('https://cdn/x.jpg');
    expect(resolveLocalPhotoUri('content://media/1')).toBe('content://media/1');
    expect(resolveLocalPhotoUri(undefined)).toBeUndefined();
  });

  it('deleting a legacy absolute reference deletes the file where it actually is now', () => {
    mockFs.files.set(`${NEW_DIR}/lx1-abc123.jpg`, new Uint8Array([1]));
    deleteManagedLocalPhoto(OLD_ABSOLUTE);
    expect(mockFs.deleted).toEqual([`${NEW_DIR}/lx1-abc123.jpg`]);
  });

  it('never deletes an unmanaged file', () => {
    mockFs.files.set('file:///cache/a.jpg', new Uint8Array([1]));
    deleteManagedLocalPhoto('file:///cache/a.jpg');
    expect(mockFs.deleted).toEqual([]);
  });
});

describe('prepareRecipePhoto', () => {
  it('stores the PROCESSED image and returns a container-independent reference', async () => {
    mockFs.files.set('file:///cache/manipulated.jpg', new Uint8Array([9]));
    processedTo('file:///cache/manipulated.jpg');

    const ref = await prepareRecipePhoto({ uri: 'file:///cache/picked.heic', width: 4032, height: 3024 });

    expect(ref).toMatch(/^recipe-photos\/[a-z0-9]+-[a-z0-9]+\.jpg$/);
    expect(mockFs.copies).toEqual([['file:///cache/manipulated.jpg', resolveLocalPhotoUri(ref)]]);
    expect(mockFs.deleted).toContain('file:///cache/manipulated.jpg'); // temp output cleaned up
  });

  it('if processing fails it throws — the unprocessed original (EXIF/GPS, HEIC) is never stored', async () => {
    mockManipulate.mockImplementation(() => {
      throw new Error('decode failed');
    });
    await expect(prepareRecipePhoto({ uri: 'file:///cache/picked.heic' })).rejects.toBeInstanceOf(PhotoProcessingError);
    expect(mockFs.copies).toEqual([]);
  });

  it('if saving into documents fails it throws rather than returning a purgeable cache URI', async () => {
    processedTo('file:///cache/manipulated.jpg');
    mockFs.failCopy = true;
    await expect(prepareRecipePhoto({ uri: 'file:///cache/picked.jpg' })).rejects.toMatchObject({ stage: 'persist' });
  });
});

describe('uploadRecipeMedia with stored references', () => {
  it('uploads a relative reference from the current documents directory', async () => {
    mockFs.files.set(`${NEW_DIR}/a.jpg`, new Uint8Array([1, 2, 3]));
    const url = await uploadRecipeMedia('owner-1', 'recipe-1', 'recipe-photos/a.jpg', 'photo');
    expect(mockUpload).toHaveBeenCalledWith('owner-1/recipe-1/photo', new Uint8Array([1, 2, 3]), { contentType: 'image/jpeg', upsert: true });
    expect(isRecipeMediaUrlFor(url, 'owner-1', 'recipe-1', 'photo')).toBe(true);
  });

  it('uploads a legacy absolute URI from an old container (re-resolved by file name)', async () => {
    mockFs.files.set(`${NEW_DIR}/lx1-abc123.jpg`, new Uint8Array([7]));
    await uploadRecipeMedia('owner-1', 'recipe-1', OLD_ABSOLUTE, 'photo');
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it('a missing file is a read-failed MediaUploadError', async () => {
    await expect(uploadRecipeMedia('owner-1', 'recipe-1', 'recipe-photos/gone.jpg', 'photo')).rejects.toMatchObject({
      name: 'MediaUploadError',
      code: 'read-failed',
    });
  });

  it('a rejected storage upload keeps its HTTP status', async () => {
    mockFs.files.set(`${NEW_DIR}/a.jpg`, new Uint8Array([1]));
    mockUpload.mockResolvedValue({ error: { message: 'new row violates row-level security policy', status: 403, statusCode: '403' } });
    const error = await uploadRecipeMedia('owner-1', 'recipe-1', 'recipe-photos/a.jpg', 'photo').catch((e) => e);
    expect(error).toBeInstanceOf(MediaUploadError);
    expect(error).toMatchObject({ code: 'upload-failed', status: 403 });
  });
});

describe('isRecipeMediaUrlFor', () => {
  const url = 'https://x.supabase.co/storage/v1/object/public/recipe-media/owner-1/recipe-1/photo?v=123';
  it('matches only the same owner, recipe and kind (ignoring the cache-buster)', () => {
    expect(isRecipeMediaUrlFor(url, 'owner-1', 'recipe-1', 'photo')).toBe(true);
    expect(isRecipeMediaUrlFor(url, 'owner-2', 'recipe-1', 'photo')).toBe(false);
    expect(isRecipeMediaUrlFor(url, 'owner-1', 'recipe-2', 'photo')).toBe(false);
    expect(isRecipeMediaUrlFor(url, 'owner-1', 'recipe-1', 'video')).toBe(false);
    expect(isRecipeMediaUrlFor('https://cdn/photo?v=1', 'owner-1', 'recipe-1', 'photo')).toBe(false);
  });
});
