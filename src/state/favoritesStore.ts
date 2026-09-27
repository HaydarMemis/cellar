import { create } from 'zustand';
import { asyncStorageFavoritesRepository } from '../data/repositories/FavoritesRepository';
import { FavoriteEntry, FavoriteTargetType } from '../domain/types';
import { currentOwnerId } from './authStore';

interface FavoritesState {
  favorites: FavoriteEntry[];
  isLoaded: boolean;
  load: () => Promise<void>;
  isFavorite: (targetType: FavoriteTargetType, targetId: string) => boolean;
  toggle: (targetType: FavoriteTargetType, targetId: string) => Promise<void>;
  /** Account deletion support — see app/delete-account.tsx. Call before useAuthStore.deleteAccount(), same as recipesStore's equivalent. */
  reassignOwnerToGuest: (ownerId: string) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  isLoaded: false,

  load: async () => {
    const favorites = await asyncStorageFavoritesRepository.getAll(currentOwnerId());
    set({ favorites, isLoaded: true });
  },

  isFavorite: (targetType, targetId) =>
    get().favorites.some((f) => f.targetType === targetType && f.targetId === targetId),

  toggle: async (targetType, targetId) => {
    const ownerId = currentOwnerId();
    // Optimistic update — the repository call is the source of truth on failure.
    const wasFavorite = get().isFavorite(targetType, targetId);
    set({
      favorites: wasFavorite
        ? get().favorites.filter((f) => !(f.targetType === targetType && f.targetId === targetId))
        : [
            ...get().favorites,
            { id: `optimistic-${targetType}-${targetId}`, targetType, targetId, ownerId, createdAt: new Date().toISOString() },
          ],
    });
    await asyncStorageFavoritesRepository.toggle(ownerId, targetType, targetId);
    const favorites = await asyncStorageFavoritesRepository.getAll(ownerId);
    set({ favorites });
  },

  reassignOwnerToGuest: async (ownerId) => {
    await asyncStorageFavoritesRepository.reassignOwnerToGuest(ownerId);
  },
}));
