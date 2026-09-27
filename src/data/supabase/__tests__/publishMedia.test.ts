import { remoteRecipeId } from '../../../domain/uuid';
import { supabaseRemoteRecipeBackend } from '../RemoteRecipeBackend';

const mockUpload = jest.fn();
const mockRemoveKind = jest.fn().mockResolvedValue(undefined);
const mockUpserts: Record<string, unknown>[] = [];

jest.mock('../mediaUpload', () => ({
  isRemoteMediaUrl: (uri: string) => uri.startsWith('https://'),
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
          return Promise.resolve({ error: null });
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

beforeEach(() => {
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
    publishedPhoto: { localUri: 'file:///docs/recipe-photos/a.jpg', url: 'https://cdn/photo?v=1' },
  });
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockUpserts[0].photo_url).toBe('https://cdn/photo?v=1');
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
