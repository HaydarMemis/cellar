import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin JSON collection store over AsyncStorage. One blob per key.
 *
 * Every mutation — a raw `write` or a read-modify-write `update` — chains
 * onto a single internal queue, so they always run one at a time in call
 * order. This matters because a naive "read current value, compute the next
 * value, write it back" (which is what every repository does to toggle a
 * favorite or add an ingredient) is a read-modify-write: two of those
 * firing close together — e.g. rapidly tapping several ingredient
 * checkboxes — can otherwise both read the same starting array and the
 * second write silently clobbers the first. Routing every mutation through
 * `update()` closes that window. A plain `read()` still reads directly
 * (mutations are what need ordering, not reads), and any failure falls back
 * to `fallback` rather than throwing (see project plan, Section 6 / 22).
 */
export class JsonStore<T> {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly key: string,
    private readonly isValidShape: (value: unknown) => value is T,
    private readonly fallback: T,
    /**
     * Optional escape hatch for a validator that has legitimately gotten
     * stricter over time (a new required field, a renamed field, etc.).
     * Without this, `isValidShape` is a hard binary — anything that
     * doesn't match reads back as `fallback`, which for a collection
     * usually means an empty array. That is exactly what caused a real
     * production bug: adding a required `email` field to the local auth
     * account record (see AuthBackend.ts's `recoverAccountArray`) made
     * every account created before that change fail validation, which
     * silently emptied the accounts collection on read — signing every
     * existing local user out permanently, which in turn made their
     * still-perfectly-intact recipes/favorites/inventory/journal/shopping
     * list (stored under other, unaffected keys, correctly tagged with
     * that now-unreachable account's id) invisible, because nothing could
     * resolve back to their identity to filter by it any more. The data
     * was never actually lost — it was orphaned by a validator with no
     * migration path. `recover` is that migration path: given the raw
     * parsed JSON that failed `isValidShape`, return an upgraded value (or
     * `undefined` to give up and fall back, same as before). A successful
     * recovery is persisted immediately so this only ever runs once per
     * piece of legacy data, not on every read.
     */
    private readonly recover?: (raw: unknown) => T | undefined,
  ) {}

  async read(): Promise<T> {
    try {
      const raw = await AsyncStorage.getItem(this.key);
      if (raw == null) return this.fallback;
      const parsed = JSON.parse(raw);
      if (this.isValidShape(parsed)) return parsed;

      if (this.recover) {
        const recovered = this.recover(parsed);
        if (recovered !== undefined && this.isValidShape(recovered)) {
          void this.write(recovered); // queued; self-heals in the background, not awaited so a slow write never blocks this read
          return recovered;
        }
      }
      return this.fallback;
    } catch {
      return this.fallback;
    }
  }

  /** Replaces the stored value outright, serialized after any mutation already queued. */
  write(value: T): Promise<void> {
    const task = this.queue.then(() => this.writeRaw(value));
    this.queue = task;
    return task;
  }

  /** Reads the current value and writes back `mutator(current)`, as one atomic step relative to other mutations. */
  update(mutator: (current: T) => T): Promise<T> {
    const task = this.queue.then(async () => {
      const current = await this.read();
      const next = mutator(current);
      await this.writeRaw(next);
      return next;
    });
    this.queue = task.then(() => undefined);
    return task;
  }

  private writeRaw(value: T): Promise<void> {
    return AsyncStorage.setItem(this.key, JSON.stringify(value)).catch(() => undefined);
  }
}
