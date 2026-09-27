import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportError } from '../../lib/crashReporting';

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
 * (mutations are what need ordering, not reads) and never throws.
 *
 * Damaged data is never silently destroyed:
 * - For an ARRAY store (array fallback), a stored array with some invalid
 *   elements reads back as just its valid elements — one bad entry no
 *   longer empties the whole collection.
 * - Whenever what `read()` returns is not the complete stored value (some
 *   elements dropped, unparseable JSON, wrong shape), the original raw
 *   string is first copied to `<key>.corrupt-<timestamp>` and the incident
 *   is reported. `update()` refuses to overwrite such data if that backup
 *   could not be written.
 *
 * Mutations REJECT when AsyncStorage fails to persist (storage full, I/O
 * error) — callers must not be told a save succeeded when it did not.
 */
export class JsonStore<T> {
  private queue: Promise<void> = Promise.resolve();
  /** Raw values already backed up by this instance — avoids a new backup key on every read of the same damaged value. */
  private readonly backedUpRaw = new Set<string>();

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
    return (await this.readState()).value;
  }

  /** Replaces the stored value outright, serialized after any mutation already queued. Rejects if the value could not be persisted. */
  write(value: T): Promise<void> {
    const task = this.queue.then(() => this.writeRaw(value));
    this.queue = task.then(settled, settled);
    return task;
  }

  /**
   * Reads the current value and writes back `mutator(current)`, as one
   * atomic step relative to other mutations. Rejects (without writing) if
   * the mutator throws, if the stored value is damaged and could not be
   * backed up first, or if the write itself fails.
   */
  update(mutator: (current: T) => T): Promise<T> {
    const task = this.queue.then(async () => {
      const { value, lossy, backedUp } = await this.readState();
      if (lossy && !backedUp) {
        throw new Error(`JsonStore(${this.key}): stored data is damaged and could not be backed up; refusing to overwrite it`);
      }
      const next = mutator(value);
      await this.writeRaw(next);
      return next;
    });
    // A failed mutation must not wedge the queue for every later one.
    this.queue = task.then(settled, settled);
    return task;
  }

  /**
   * `lossy` = the returned value does not contain everything that is
   * stored; `backedUp` = the raw stored value is safely copied aside (or
   * there was nothing to lose).
   */
  private async readState(): Promise<{ value: T; lossy: boolean; backedUp: boolean }> {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(this.key);
    } catch (e) {
      // Can't even read: never let an update() overwrite what we couldn't see.
      reportError(e, { module: 'jsonStore', action: 'read', key: this.key });
      return { value: this.fallback, lossy: true, backedUp: false };
    }
    if (raw == null) return { value: this.fallback, lossy: false, backedUp: true };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { value: this.fallback, lossy: true, backedUp: await this.backupCorrupt(raw, 'unparseable', e) };
    }
    if (this.isValidShape(parsed)) return { value: parsed, lossy: false, backedUp: true };

    if (this.recover) {
      let recovered: T | undefined;
      try {
        recovered = this.recover(parsed);
      } catch (e) {
        reportError(e, { module: 'jsonStore', action: 'recover', key: this.key });
      }
      if (recovered !== undefined && this.isValidShape(recovered)) {
        // Queued; self-heals in the background, not awaited so a slow write never blocks this read.
        this.write(recovered).catch((e) => reportError(e, { module: 'jsonStore', action: 'persistRecovered', key: this.key }));
        return { value: recovered, lossy: false, backedUp: true };
      }
    }

    const salvaged = this.salvageElements(parsed);
    const backedUp = await this.backupCorrupt(raw, salvaged ? 'invalid-elements' : 'invalid-shape');
    return { value: salvaged ?? this.fallback, lossy: true, backedUp };
  }

  /**
   * Array stores only: keeps the elements that pass validation on their
   * own. Every array validator in the app is "is an array AND every
   * element matches", so validating `[element]` is exactly the per-element
   * check — no separate per-item validator needs to be threaded through.
   */
  private salvageElements(parsed: unknown): T | undefined {
    if (!Array.isArray(this.fallback) || !Array.isArray(parsed)) return undefined;
    const kept = parsed.filter((element) => {
      try {
        return this.isValidShape([element]);
      } catch {
        return false;
      }
    });
    return this.isValidShape(kept) ? kept : undefined;
  }

  /** Copies a damaged raw value aside before anything can overwrite it. Returns whether it is safely stored. */
  private async backupCorrupt(raw: string, reason: string, error?: unknown): Promise<boolean> {
    if (this.backedUpRaw.has(raw)) return true;
    try {
      const prefix = `${this.key}.corrupt-`;
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(prefix));
      const existing = keys.length > 0 ? await AsyncStorage.multiGet(keys) : [];
      if (!existing.some(([, value]) => value === raw)) {
        await AsyncStorage.setItem(`${prefix}${Date.now()}`, raw);
      }
      this.backedUpRaw.add(raw);
      reportError(error ?? new Error(`JsonStore: damaged data under ${this.key}`), { module: 'jsonStore', action: 'backupCorrupt', key: this.key, reason });
      return true;
    } catch (e) {
      reportError(e, { module: 'jsonStore', action: 'backupCorruptFailed', key: this.key, reason });
      return false;
    }
  }

  private writeRaw(value: T): Promise<void> {
    return AsyncStorage.setItem(this.key, JSON.stringify(value));
  }
}

function settled(): void {
  // queue continuation: swallow here only; the caller's own promise still rejects
}
