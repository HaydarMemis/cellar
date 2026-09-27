import { remoteRecipeId } from '../../../domain/uuid';
import { supabaseRemoteRecipeBackend } from '../RemoteRecipeBackend';

const mockUpload = jest.fn();
const mockRemoveKind = jest.fn().mockResolvedValue(undefined);
const mockUpserts: Record<string, unknown>[] = [];
let mockUpsertError: unknown = null;

jest.mock('../mediaUpload', () => ({
  isRemoteMediaUrl: (uri: string) => uri.startsWith('https://'),
  isRecipeMediaUrlFor: jest.requireActual('../mediaUpload').isRecipeMediaUrlFor,
  uploadRecipeMedia: (...a: unknown[]) => mockUpload(...a),
  removeRecipeMedia: jest.fn().mockResolvedValue(undefined),
  removeRecipeMediaKind: (...a: unknown[]) => mockRemoveKind(...a),
}));
jest.mock('../client', () => ({
  get supabase() {
    return {
      from: () => ({
        upsert: (row: Record<string, unknown>) => {
          mockUpserts.push(row);
          return Promise.resolve(mockUpsertError ? { error: mockUpsertError, status: 400 } : { error: null, status: 201 });
        },
      }),
    };
  },
}));

const base = {
  id: '44444444-4444-4444-8444-444444444444',
  ownerId: '11111111-1111-4111-8111-111111111111',
  name: 'R',
  description: '',
  baseSpirit: 'gin',
  category: [],
  tags: [],
  ingredients: [{ ingredientId: 'gin', amount: null, isOptional: false, isGarnish: false }],
  method: 'shake' as const,
  steps: ['s'],
  glass: ['coupe' as const],
  abv: null,
  difficulty: 'easy' as const,
  prepTimeMinutes: 3,
  visibility: 'public' as const,
  createdAt: 'x',
  updatedAt: 'x',
};

/** A real-shaped public URL of this recipe's photo object under its owner's folder. */
const storedPhotoUrl = (owner: string, version: number) =>
  `https://x.supabase.co/storage/v1/object/public/recipe-media/${owner}/${remoteRecipeId(base.id)}/photo?v=${version}`;

beforeEach(() => {
  mockUpsertError = null;
  mockUpload.mockReset().mockResolvedValue('https://cdn/photo?v=2');
  mockRemoveKind.mockClear();
  mockUpserts.length = 0;
});

it('uploads a new local photo under <owner>/<remote id>/photo and never writes a file:// URI', async () => {
  const result = await supabaseRemoteRecipeBackend.publishRecipe({ ...base, photoUri: 'file:///docs/recipe-photos/a.jpg' });
  expect(mockUpload).toHaveBeenCalledWith(base.ownerId, remoteRecipeId(base.id), 'file:///docs/recipe-photos/a.jpg', 'photo');
  expect(mockUpserts[0].photo_url).toBe('https://cdn/photo?v=2');
  expect(result.photoUrl).toBe('https://cdn/photo?v=2');
});

it('does not re-upload an unchanged photo on a later edit', async () => {
  await supabaseRemoteRecipeBackend.publishRecipe({
    ...base,
    photoUri: 'file:///docs/recipe-photos/a.jpg',
    publishedPhoto: { localUri: 'file:///docs/recipe-photos/a.jpg', url: storedPhotoUrl(base.ownerId, 1) },
  });
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockUpserts[0].photo_url).toBe(storedPhotoUrl(base.ownerId, 1));
});

it('a replaced photo is uploaded again (new versioned URL)', async () => {
  await supabaseRemoteRecipeBackend.publishRecipe({
    ...base,
    photoUri: 'file:///docs/recipe-photos/b.jpg',
    publishedPhoto: { localUri: 'file:///docs/recipe-photos/a.jpg', url: 'https://cdn/photo?v=1' },
  });
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockUpserts[0].photo_url).toBe('https://cdn/photo?v=2');
});

it('removing the photo from a published recipe deletes the public object', async () => {
  await supabaseRemoteRecipeBackend.publishRecipe({ ...base, photoUri: undefined });
  expect(mockUpserts[0].photo_url).toBeNull();
  expect(mockRemoveKind).toHaveBeenCalledWith(base.ownerId, base.id, 'photo');
});

it('a failed upload fails the publish (the recipe is then kept pending locally)', async () => {
  mockUpload.mockRejectedValue(new Error('upload-failed'));
  await expect(supabaseRemoteRecipeBackend.publishRecipe({ ...base, photoUri: 'file:///x.jpg' })).rejects.toThrow('upload-failed');
  expect(mockUpserts).toHaveLength(0);
});

it('never reuses a remembered upload that lives under a DIFFERENT owner (account deletion / adoption): uploads under the current owner', async () => {
  const previousOwner = '99999999-9999-4999-8999-999999999999';
  await supabaseRemoteRecipeBackend.publishRecipe({
    ...base,
    photoUri: 'recipe-photos/a.jpg',
    publishedPhoto: { localUri: 'recipe-photos/a.jpg', url: storedPhotoUrl(previousOwner, 1) },
  });
  expect(mockUpload).toHaveBeenCalledWith(base.ownerId, remoteRecipeId(base.id), 'recipe-photos/a.jpg', 'photo');
  expect(mockUpserts[0].photo_url).toBe('https://cdn/photo?v=2');
});

it('never reuses a remembered URL that is not a storage object of this recipe', async () => {
  await supabaseRemoteRecipeBackend.publishRecipe({
    ...base,
    photoUri: 'recipe-photos/a.jpg',
    publishedPhoto: { localUri: 'recipe-photos/a.jpg', url: 'https://cdn/photo?v=1' },
  });
  expect(mockUpload).toHaveBeenCalledTimes(1);
});

it('a rejected upsert carries its HTTP status (so the store can classify it as permanent)', async () => {
  mockUpsertError = Object.assign(new Error('new row for relation "recipes" violates check constraint "recipes_glass_valid"'), { code: '23514' });
  await expect(supabaseRemoteRecipeBackend.publishRecipe({ ...base })).rejects.toMatchObject({ code: '23514', status: 400 });
});
