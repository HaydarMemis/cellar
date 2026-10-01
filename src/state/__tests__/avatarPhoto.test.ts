/**
 * useAuthStore.setAvatarPhoto / removeAvatarPhoto: the processed photo (never
 * the original) is uploaded, the profile + offline profile cache update only
 * on success, a failure keeps the previous photo, and removal deletes the
 * Storage object before clearing the URL.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authBackend } from '../../data/community';
import { AvatarError } from '../../data/supabase/avatarUpload';
import { useAuthStore } from '../authStore';

const mockCalls: string[] = [];
const mockPrepare = jest.fn();
const mockDiscard = jest.fn();
const mockUpload = jest.fn();
const mockRemove = jest.fn();
let mockAvailable = true;

jest.mock('../../data/localMedia', () => ({
  ...jest.requireActual('../../data/localMedia'),
  prepareAvatarPhoto: (...a: unknown[]) => mockPrepare(...a),
  discardProcessedAvatar: (...a: unknown[]) => mockDiscard(...a),
}));

jest.mock('../../data/supabase/avatarUpload', () => ({
  ...jest.requireActual('../../data/supabase/avatarUpload'),
  isAvatarUploadAvailable: () => mockAvailable,
  uploadAvatar: (...a: unknown[]) => mockUpload(...a),
  removeAvatarObject: (...a: unknown[]) => mockRemove(...a),
}));

const PICKED = { uri: 'file:///cache/ImagePicker/original.heic', width: 4032, height: 3024 };
const PROCESSED = 'file:///cache/ImageManipulator/processed.jpg';
const url = (v: number) => `https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/avatars/u/avatar?v=${v}`;

async function cachedProfile() {
  const raw = await AsyncStorage.getItem('@auth/lastProfile');
  return raw ? JSON.parse(raw) : null;
}

let userId: string;

beforeEach(async () => {
  mockCalls.length = 0;
  mockAvailable = true;
  mockPrepare.mockReset().mockImplementation(async () => {
    mockCalls.push('prepare');
    return PROCESSED;
  });
  mockDiscard.mockReset();
  mockUpload.mockReset().mockImplementation(async () => {
    mockCalls.push('upload');
    return url(1);
  });
  mockRemove.mockReset().mockImplementation(async () => {
    mockCalls.push('remove');
  });
  await AsyncStorage.clear();
  useAuthStore.setState({ profile: null, isLoaded: false });
  const name = `u${Math.random().toString(36).slice(2, 10)}`;
  const r = await useAuthStore.getState().signUp({ username: name, displayName: name, email: `${name}@example.com`, password: 'secret1' });
  expect(r.ok).toBe(true);
  userId = useAuthStore.getState().profile!.id;
});

describe('setAvatarPhoto', () => {
  it('uploads the PROCESSED file, then updates the profile, the store and the offline cache', async () => {
    await useAuthStore.getState().setAvatarPhoto(PICKED);

    expect(mockPrepare).toHaveBeenCalledWith(PICKED);
    expect(mockUpload).toHaveBeenCalledWith(userId, PROCESSED);
    expect(useAuthStore.getState().profile?.avatarUrl).toBe(url(1));
    expect((await cachedProfile())?.avatarUrl).toBe(url(1));
    expect((await authBackend.getProfile(userId))?.avatarUrl).toBe(url(1));
    expect(mockDiscard).toHaveBeenCalledWith(PROCESSED); // temp file cleaned up
  });

  it('processing failure: nothing is uploaded (never the original) and the previous photo stays', async () => {
    await useAuthStore.getState().setAvatarPhoto(PICKED);
    mockUpload.mockClear();
    mockPrepare.mockRejectedValue(new Error('decode failed'));

    await expect(useAuthStore.getState().setAvatarPhoto(PICKED)).rejects.toMatchObject({ code: 'processing-failed' });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(useAuthStore.getState().profile?.avatarUrl).toBe(url(1));
  });

  it('offline: the error surfaces as offline and the profile + cache keep the previous photo', async () => {
    await useAuthStore.getState().setAvatarPhoto(PICKED);
    mockUpload.mockRejectedValue(new AvatarError('Network request failed', 'offline'));

    await expect(useAuthStore.getState().setAvatarPhoto(PICKED)).rejects.toMatchObject({ code: 'offline' });
    expect(useAuthStore.getState().profile?.avatarUrl).toBe(url(1));
    expect((await cachedProfile())?.avatarUrl).toBe(url(1));
    expect(mockDiscard).toHaveBeenLastCalledWith(PROCESSED);
  });

  it('a failed profile update after the upload is upload-failed and the store is unchanged', async () => {
    jest.spyOn(authBackend, 'updateProfile').mockResolvedValueOnce(undefined);
    await expect(useAuthStore.getState().setAvatarPhoto(PICKED)).rejects.toMatchObject({ code: 'upload-failed' });
    expect(useAuthStore.getState().profile?.avatarUrl).toBeUndefined();
  });

  it('not available without the Supabase backend (nothing processed or uploaded)', async () => {
    mockAvailable = false;
    await expect(useAuthStore.getState().setAvatarPhoto(PICKED)).rejects.toMatchObject({ code: 'not-available' });
    expect(mockPrepare).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('signed out while uploading: the old identity is not resurrected', async () => {
    mockUpload.mockImplementation(async () => {
      useAuthStore.setState({ profile: null });
      return url(2);
    });
    await useAuthStore.getState().setAvatarPhoto(PICKED);
    expect(useAuthStore.getState().profile).toBeNull();
  });
});

describe('removeAvatarPhoto', () => {
  it('deletes the object first, then clears avatarUrl in the store and cache', async () => {
    await useAuthStore.getState().setAvatarPhoto(PICKED);
    const updateSpy = jest.spyOn(authBackend, 'updateProfile');
    updateSpy.mockClear();

    await useAuthStore.getState().removeAvatarPhoto();

    expect(mockRemove).toHaveBeenCalledWith(userId);
    expect(updateSpy).toHaveBeenCalledWith(userId, { avatarUrl: null });
    expect(mockCalls.indexOf('remove')).toBeGreaterThan(-1);
    expect(mockRemove.mock.invocationCallOrder[0]).toBeLessThan(updateSpy.mock.invocationCallOrder[0]);
    expect(useAuthStore.getState().profile?.avatarUrl).toBeUndefined();
    expect((await cachedProfile())?.avatarUrl).toBeUndefined();
    updateSpy.mockRestore();
  });

  it('offline: nothing changes and the photo is still set (retryable)', async () => {
    await useAuthStore.getState().setAvatarPhoto(PICKED);
    mockRemove.mockRejectedValue(new AvatarError('Network request failed', 'offline'));
    await expect(useAuthStore.getState().removeAvatarPhoto()).rejects.toMatchObject({ code: 'offline' });
    expect(useAuthStore.getState().profile?.avatarUrl).toBe(url(1));
  });
});
