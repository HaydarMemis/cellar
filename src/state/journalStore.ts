import { create } from 'zustand';
import { asyncStorageJournalRepository, JournalEntryPatch, NewJournalEntryInput } from '../data/repositories/JournalRepository';
import { JournalEntry } from '../domain/types';
import { currentOwnerId } from './authStore';

interface JournalState {
  entries: JournalEntry[];
  isLoaded: boolean;
  load: () => Promise<void>;
  create: (input: NewJournalEntryInput) => Promise<JournalEntry>;
  update: (id: string, patch: JournalEntryPatch) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Account deletion support — see app/delete-account.tsx. */
  reassignOwnerToGuest: (ownerId: string) => Promise<void>;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  isLoaded: false,

  load: async () => {
    const entries = await asyncStorageJournalRepository.getAll(currentOwnerId());
    set({ entries, isLoaded: true });
  },

  create: async (input) => {
    const entry = await asyncStorageJournalRepository.create(input, currentOwnerId());
    set({ entries: [entry, ...get().entries] });
    return entry;
  },

  update: async (id, patch) => {
    const updated = await asyncStorageJournalRepository.update(id, patch, currentOwnerId());
    if (updated) set({ entries: get().entries.map((e) => (e.id === id ? updated : e)) });
  },

  remove: async (id) => {
    await asyncStorageJournalRepository.remove(id, currentOwnerId());
    set({ entries: get().entries.filter((e) => e.id !== id) });
  },

  reassignOwnerToGuest: async (ownerId) => {
    await asyncStorageJournalRepository.reassignOwnerToGuest(ownerId);
  },
}));
