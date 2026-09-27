import AsyncStorage from '@react-native-async-storage/async-storage';
import { JsonStore } from '../jsonStore';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

describe('JsonStore', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns the fallback when nothing is stored yet', async () => {
    const store = new JsonStore('@test/empty', isStringArray, []);
    expect(await store.read()).toEqual([]);
  });

  it('round-trips a write through read', async () => {
    const store = new JsonStore('@test/roundtrip', isStringArray, []);
    await store.write(['a', 'b']);
    expect(await store.read()).toEqual(['a', 'b']);
  });

  it('falls back safely when the stored value fails shape validation', async () => {
    await AsyncStorage.setItem('@test/corrupt', JSON.stringify({ not: 'an array' }));
    const store = new JsonStore('@test/corrupt', isStringArray, ['fallback']);
    expect(await store.read()).toEqual(['fallback']);
  });

  it('falls back safely when the stored value is not valid JSON', async () => {
    await AsyncStorage.setItem('@test/badjson', 'not json{{{');
    const store = new JsonStore('@test/badjson', isStringArray, ['fallback']);
    expect(await store.read()).toEqual(['fallback']);
  });

  it('serializes concurrent update() calls instead of losing one to a stale read', async () => {
    // Regression test: toggling favorites/inventory previously did an
    // unserialized read-modify-write (read current array, compute next,
    // write it). Two of those fired close together could both read the
    // same starting array, and the second write would silently clobber the
    // first — e.g. rapidly checking two ingredient boxes could lose one.
    const store = new JsonStore('@test/concurrent', isStringArray, []);

    await Promise.all([
      store.update((current) => [...current, 'first']),
      store.update((current) => [...current, 'second']),
    ]);

    const result = await store.read();
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining(['first', 'second']));
  });

  it('serializes many concurrent update() calls with none lost', async () => {
    const store = new JsonStore('@test/many-concurrent', isStringArray, []);

    await Promise.all(Array.from({ length: 20 }, (_, i) => store.update((current) => [...current, `item-${i}`])));

    const result = await store.read();
    expect(result).toHaveLength(20);
    for (let i = 0; i < 20; i++) {
      expect(result).toContain(`item-${i}`);
    }
  });

  it('update() reflects a write() that was queued just before it', async () => {
    const store = new JsonStore('@test/mixed', isStringArray, []);
    await store.write(['seed']);
    const next = store.update((current) => [...current, 'appended']);
    expect(await next).toEqual(['seed', 'appended']);
  });

  describe('recover (migration for a validator that has gotten stricter)', () => {
    // Regression coverage for a real bug: adding a required field to a
    // persisted shape's validator, with no migration path, silently
    // discarded an entire collection on the next read (see AuthBackend.ts's
    // recoverAccountArray for the exact production incident this caused —
    // existing local accounts, and everything keyed off their id, appeared
    // to vanish after an update that added a required `email` field).
    interface Widget {
      id: string;
      color: string;
    }
    function isWidgetArray(value: unknown): value is Widget[] {
      return Array.isArray(value) && value.every((v) => v && typeof v.id === 'string' && typeof v.color === 'string');
    }
    /** Simulates a validator that used to accept `{ id }` alone and now also requires `color`. */
    function recoverWidgets(raw: unknown): Widget[] | undefined {
      if (!Array.isArray(raw)) return undefined;
      const recovered: Widget[] = [];
      for (const entry of raw) {
        if (!entry || typeof entry !== 'object' || typeof (entry as { id?: unknown }).id !== 'string') return undefined;
        const e = entry as { id: string; color?: unknown };
        recovered.push({ id: e.id, color: typeof e.color === 'string' ? e.color : 'unknown' });
      }
      return recovered;
    }

    it('recovers legacy-shaped data instead of discarding it when the validator has gotten stricter', async () => {
      await AsyncStorage.setItem('@test/widgets', JSON.stringify([{ id: 'w1' }, { id: 'w2' }]));
      const store = new JsonStore('@test/widgets', isWidgetArray, [], recoverWidgets);

      const result = await store.read();
      expect(result).toEqual([
        { id: 'w1', color: 'unknown' },
        { id: 'w2', color: 'unknown' },
      ]);
    });

    it('persists the recovered value so a second read no longer needs to migrate', async () => {
      await AsyncStorage.setItem('@test/widgets-persist', JSON.stringify([{ id: 'w1' }]));
      const store = new JsonStore('@test/widgets-persist', isWidgetArray, [], recoverWidgets);

      await store.read();
      // Give the fire-and-forget self-heal write (queued inside read()) a turn to complete.
      await new Promise((resolve) => setTimeout(resolve, 0));

      const raw = await AsyncStorage.getItem('@test/widgets-persist');
      expect(JSON.parse(raw!)).toEqual([{ id: 'w1', color: 'unknown' }]);
    });

    it('falls back to the default when recover cannot make sense of the data either', async () => {
      await AsyncStorage.setItem('@test/widgets-garbage', JSON.stringify({ totally: 'not a widget list' }));
      const store = new JsonStore('@test/widgets-garbage', isWidgetArray, ['fallback' as never], recoverWidgets);

      expect(await store.read()).toEqual(['fallback']);
    });

    it('never calls recover when the data already matches the current shape', async () => {
      await AsyncStorage.setItem('@test/widgets-current', JSON.stringify([{ id: 'w1', color: 'red' }]));
      const recoverSpy = jest.fn(recoverWidgets);
      const store = new JsonStore('@test/widgets-current', isWidgetArray, [], recoverSpy);

      await store.read();
      expect(recoverSpy).not.toHaveBeenCalled();
    });

    it('without a recover function, still falls back exactly as before (no behavior change for every other store)', async () => {
      await AsyncStorage.setItem('@test/widgets-no-recover', JSON.stringify([{ id: 'w1' }]));
      const store = new JsonStore('@test/widgets-no-recover', isWidgetArray, []);
      expect(await store.read()).toEqual([]);
    });
  });
});
