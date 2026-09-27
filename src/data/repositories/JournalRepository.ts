import { generateId } from '../../domain/id';
import { JournalEntry, LOCAL_GUEST_OWNER_ID } from '../../domain/types';
import { JsonStore } from '../storage/jsonStore';

export type NewJournalEntryInput = Omit<JournalEntry, 'id' | 'createdAt' | 'ownerId'>;
export type JournalEntryPatch = Partial<Pick<JournalEntry, 'rating' | 'note'>>;

/** See FavoritesRepository's doc comment — same ownerId account-isolation convention. update/remove also verify ownership, not just look the id up, so entry ids being unguessable isn't the only thing standing between accounts on a shared device. */
export interface JournalRepository {
  getAll(ownerId: string): Promise<JournalEntry[]>;
  create(input: NewJournalEntryInput, ownerId: string): Promise<JournalEntry>;
  update(id: string, patch: JournalEntryPatch, ownerId: string): Promise<JournalEntry | undefined>;
  remove(id: string, ownerId: string): Promise<void>;
  /** Account deletion support — see FavoritesRepository.reassignOwnerToGuest. No de-duplication needed here: unlike favorites/inventory, each journal entry has its own unique id and represents a distinct tasting event, so two "I made a Negroni" entries (one from before signing up, one after) are both meaningful, not a duplicate. */
  reassignOwnerToGuest(ownerId: string): Promise<void>;
  /** Local-data adoption (see src/state/localDataAdoption.ts): how many entries each owner id holds on this device. */
  countByOwner(): Promise<Record<string, number>>;
  /** Local-data adoption: moves every entry owned by any of `fromOwnerIds` to `toOwnerId`, merging without creating duplicates. */
  reassignOwners(fromOwnerIds: string[], toOwnerId: string): Promise<void>;
}

function isJournalArray(value: unknown): value is JournalEntry[] {
  return Array.isArray(value) && value.every((v) => v && typeof v.id === 'string' && typeof v.drinkId === 'string');
}

function ownerOf(entry: JournalEntry): string {
  return entry.ownerId ?? LOCAL_GUEST_OWNER_ID;
}

const store = new JsonStore<JournalEntry[]>('@bar/journal', isJournalArray, []);

export const asyncStorageJournalRepository: JournalRepository = {
  async getAll(ownerId) {
    const all = await store.read();
    return all.filter((e) => ownerOf(e) === ownerId);
  },

  async create(input, ownerId) {
    const entry: JournalEntry = { ...input, id: generateId('journal'), ownerId, createdAt: new Date().toISOString() };
    await store.update((all) => [entry, ...all]);
    return entry;
  },

  async update(id, patch, ownerId) {
    let updated: JournalEntry | undefined;
    await store.update((all) =>
      all.map((e) => {
        if (e.id !== id || ownerOf(e) !== ownerId) return e;
        updated = { ...e, ...patch };
        return updated;
      }),
    );
    return updated;
  },

  async remove(id, ownerId) {
    await store.update((all) => all.filter((e) => !(e.id === id && ownerOf(e) === ownerId)));
  },

  async reassignOwnerToGuest(ownerId) {
    await store.update((all) => all.map((e) => (ownerOf(e) === ownerId ? { ...e, ownerId: LOCAL_GUEST_OWNER_ID } : e)));
  },

  async countByOwner() {
    const counts: Record<string, number> = {};
    for (const e of await store.read()) {
      const owner = ownerOf(e);
      counts[owner] = (counts[owner] ?? 0) + 1;
    }
    return counts;
  },

  async reassignOwners(fromOwnerIds, toOwnerId) {
    const from = new Set(fromOwnerIds.filter((id) => id !== toOwnerId));
    if (from.size === 0) return;
    // Every journal entry is a distinct tasting event — nothing to de-duplicate.
    await store.update((all) => all.map((e) => (from.has(ownerOf(e)) ? { ...e, ownerId: toOwnerId } : e)));
  },
};
