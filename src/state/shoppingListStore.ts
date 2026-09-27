import { create } from 'zustand';
import { asyncStorageShoppingListRepository } from '../data/repositories/ShoppingListRepository';
import { ShoppingListEntry } from '../domain/types';
import { currentOwnerId } from './authStore';

interface ShoppingListState {
  entries: ShoppingListEntry[];
  isLoaded: boolean;
  load: () => Promise<void>;
  addIngredients: (ingredientIds: string[]) => Promise<void>;
  toggleCompleted: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  clearAll: () => Promise<void>;
  /** Account deletion support — see app/delete-account.tsx. */
  reassignOwnerToGuest: (ownerId: string) => Promise<void>;
}

/**
 * Reactive cache over ShoppingListRepository — the real, persistent
 * shopping list (survives app restarts, supports add/remove/complete/
 * clear), scoped per signed-in account (or the guest identity) on this
 * device — see src/state/accountScope.ts. NOTE: nothing here exposes a
 * derived-Set-returning selector — see app/shopping-list.tsx's comment
 * for why that pattern (`useStore((s) => s.someMethodThatAllocates())`)
 * caused a real infinite render loop in this exact feature; `entries` is
 * the only thing this store lets you select, always a stable array
 * reference.
 */
export const useShoppingListStore = create<ShoppingListState>((set, get) => ({
  entries: [],
  isLoaded: false,

  load: async () => {
    const entries = await asyncStorageShoppingListRepository.getAll(currentOwnerId());
    set({ entries, isLoaded: true });
  },

  addIngredients: async (ingredientIds) => {
    if (ingredientIds.length === 0) return;
    const entries = await asyncStorageShoppingListRepository.addIngredients(currentOwnerId(), ingredientIds);
    set({ entries });
  },

  toggleCompleted: async (id) => {
    set({ entries: get().entries.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e)) });
    await asyncStorageShoppingListRepository.toggleCompleted(currentOwnerId(), id);
  },

  remove: async (id) => {
    set({ entries: get().entries.filter((e) => e.id !== id) });
    await asyncStorageShoppingListRepository.remove(currentOwnerId(), id);
  },

  clearCompleted: async () => {
    set({ entries: get().entries.filter((e) => !e.completed) });
    await asyncStorageShoppingListRepository.clearCompleted(currentOwnerId());
  },

  clearAll: async () => {
    set({ entries: [] });
    await asyncStorageShoppingListRepository.clearAll(currentOwnerId());
  },

  reassignOwnerToGuest: async (ownerId) => {
    await asyncStorageShoppingListRepository.reassignOwnerToGuest(ownerId);
  },
}));
