import { create } from 'zustand';
import { asyncStorageInventoryRepository } from '../data/repositories/InventoryRepository';
import { IngredientInventoryEntry } from '../domain/types';
import { currentOwnerId } from './authStore';

interface InventoryState {
  entries: IngredientInventoryEntry[];
  isLoaded: boolean;
  load: () => Promise<void>;
  has: (ingredientId: string) => boolean;
  toggle: (ingredientId: string) => Promise<void>;
  clear: () => Promise<void>;
  /** Note: never select this reactively via `useInventoryStore((s) => s.asIdSet())` — it allocates a new Set every call, which breaks Zustand/useSyncExternalStore's identity check and causes an infinite render loop (a real, previously-shipped crash — see app/shopping-list.tsx's fix). Always select `entries` and derive the Set with useMemo instead. */
  asIdSet: () => Set<string>;
  /** Account deletion support — see app/delete-account.tsx. */
  reassignOwnerToGuest: (ownerId: string) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  entries: [],
  isLoaded: false,

  load: async () => {
    const entries = await asyncStorageInventoryRepository.getAll(currentOwnerId());
    set({ entries, isLoaded: true });
  },

  has: (ingredientId) => get().entries.some((e) => e.ingredientId === ingredientId),

  toggle: async (ingredientId) => {
    const ownerId = currentOwnerId();
    const has = get().has(ingredientId);
    set({
      entries: has
        ? get().entries.filter((e) => e.ingredientId !== ingredientId)
        : [...get().entries, { ingredientId, ownerId, addedAt: new Date().toISOString() }],
    });
    await asyncStorageInventoryRepository.toggle(ownerId, ingredientId);
  },

  clear: async () => {
    const ownerId = currentOwnerId();
    await asyncStorageInventoryRepository.clear(ownerId);
    set({ entries: [] });
  },

  asIdSet: () => new Set(get().entries.map((e) => e.ingredientId)),

  reassignOwnerToGuest: async (ownerId) => {
    await asyncStorageInventoryRepository.reassignOwnerToGuest(ownerId);
  },
}));
