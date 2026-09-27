import { isUuid, remoteRecipeId } from '../../../domain/uuid';
import { afterCursorFilter, decodeCursor, encodeCursor, normalizePrepTime, supabaseRemoteRecipeBackend } from '../RemoteRecipeBackend';

/**
 * A minimal chainable fake of the supabase-js query builder — records what
 * the backend sends so the tests can assert on the actual request shape.
 */
const mockCalls: { table: string; op: string; args: unknown[] }[] = [];
let mockNextResult: { data: unknown; error: unknown } = { data: [], error: null };

function mockBuilder(table: string) {
  const b: Record<string, unknown> = {};
  const record = (op: string) => (...args: unknown[]) => {
    mockCalls.push({ table, op, args });
    return b;
  };
  for (const op of ['select', 'eq', 'or', 'order', 'limit', 'delete', 'lt']) b[op] = record(op);
  b.upsert = (...args: unknown[]) => {
    mockCalls.push({ table, op: 'upsert', args });
    return Promise.resolve(mockNextResult);
  };
  b.maybeSingle = () => Promise.resolve(mockNextResult);
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(mockNextResult).then(resolve, reject);
  return b;
}

const mockStorageList = jest.fn().mockResolvedValue({ data: [], error: null });
const mockStorageRemove = jest.fn().mockResolvedValue({ error: null });
jest.mock('../client', () => ({
  get supabase() {
    return {
      from: (table: string) => mockBuilder(table),
      storage: { from: () => ({ list: (...a: unknown[]) => mockStorageList(...a), remove: (...a: unknown[]) => mockStorageRemove(...a) }) },
    };
  },
}));

const recipe = {
  id: 'recipe-legacy-1',
  ownerId: '11111111-1111-4111-8111-111111111111',
  name: 'Legacy',
  description: '',
  baseSpirit: 'gin',
  category: [],
  tags: [],
  ingredients: [{ ingredientId: 'gin', amount: { value: 50, unit: 'ml' as const }, isOptional: false, isGarnish: false }],
  method: 'shake' as const,
  steps: ['Shake.'],
  glass: ['coupe' as const],
  abv: null,
  difficulty: 'easy' as const,
  prepTimeMinutes: 2.5,
  visibility: 'public' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  mockCalls.length = 0;
  mockNextResult = { data: [], error: null };
  mockStorageList.mockClear();
  mockStorageRemove.mockClear();
});

describe('publishRecipe', () => {
  it('writes a uuid primary key (a legacy recipe-… id would be rejected by Postgres with 22P02)', async () => {
    await supabaseRemoteRecipeBackend.publishRecipe(recipe);
    const upsert = mockCalls.find((c) => c.op === 'upsert')!;
    const row = upsert.args[0] as { id: string; prep_time_minutes: number };
    expect(isUuid(row.id)).toBe(true);
    expect(row.id).toBe(remoteRecipeId('recipe-legacy-1'));
    // prep_time_minutes is an int column constrained to 1..240
    expect(row.prep_time_minutes).toBe(3);
  });

  it('throws (so the store can report "saved but not published") when the backend rejects the write', async () => {
    mockNextResult = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(supabaseRemoteRecipeBackend.publishRecipe(recipe)).rejects.toEqual({ code: '42501', message: 'rls' });
  });
});

describe('unpublishRecipe', () => {
  it('deletes the row under the remote id even when given the local legacy id', async () => {
    mockNextResult = { data: null, error: null };
    await supabaseRemoteRecipeBackend.unpublishRecipe('recipe-legacy-1');
    const deleteEq = mockCalls.filter((c) => c.op === 'eq').map((c) => c.args);
    expect(deleteEq).toContainEqual(['id', remoteRecipeId('recipe-legacy-1')]);
  });
});

describe('fetchPublicRecipesPage', () => {
  it('throws on a backend error instead of pretending the community is empty', async () => {
    mockNextResult = { data: null, error: { message: 'network down' } };
    await expect(supabaseRemoteRecipeBackend.fetchPublicRecipesPage(null, 20)).rejects.toEqual({ message: 'network down' });
  });

  it('uses a composite (created_at, id) keyset cursor', async () => {
    const row = (id: string) => ({
      id,
      owner_id: recipe.ownerId,
      name: 'x',
      description: '',
      base_spirit: 'gin',
      category: [],
      tags: [],
      ingredients: [],
      method: 'shake',
      steps: ['s'],
      glass: ['coupe'],
      garnish: null,
      abv_approx: null,
      difficulty: 'easy',
      prep_time_minutes: 3,
      photo_url: null,
      video_url: null,
      created_at: '2026-09-25T10:00:00.123456+00:00',
      updated_at: '2026-09-25T10:00:00.123456+00:00',
    });
    const a = '22222222-2222-4222-8222-222222222222';
    mockNextResult = { data: [row(a)], error: null };
    const page = await supabaseRemoteRecipeBackend.fetchPublicRecipesPage(null, 1);
    expect(page.nextCursor).toBe(`2026-09-25T10:00:00.123456+00:00|${a}`);

    mockNextResult = { data: [], error: null };
    await supabaseRemoteRecipeBackend.fetchPublicRecipesPage(page.nextCursor, 1);
    const or = mockCalls.find((c) => c.op === 'or')!;
    expect(or.args[0]).toBe(`created_at.lt."2026-09-25T10:00:00.123456+00:00",and(created_at.eq."2026-09-25T10:00:00.123456+00:00",id.lt.${a})`);
  });
});

describe('cursor helpers', () => {
  it('round-trips and rejects garbage', () => {
    const c = encodeCursor({ createdAt: '2026-09-25T10:00:00+00:00', id: '22222222-2222-4222-8222-222222222222' });
    expect(decodeCursor(c)).toEqual({ createdAt: '2026-09-25T10:00:00+00:00', id: '22222222-2222-4222-8222-222222222222' });
    expect(decodeCursor('2026-09-25')).toBeNull();
    expect(decodeCursor('nonsense|not-a-uuid')).toBeNull();
    expect(afterCursorFilter({ createdAt: 't', id: 'i' })).toBe('created_at.lt."t",and(created_at.eq."t",id.lt.i)');
  });

  it('normalizePrepTime clamps to the DB constraint', () => {
    expect(normalizePrepTime(0)).toBe(1);
    expect(normalizePrepTime(2.4)).toBe(2);
    expect(normalizePrepTime(999)).toBe(240);
    expect(normalizePrepTime(Number.NaN)).toBe(5);
  });
});
