import { create } from 'zustand';
import { emptyFilterState, FilterState } from '../domain/search';

interface FilterStoreState {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  reset: () => void;
}

/** Ephemeral UI state shared between the Search screen and the Filters modal. Not persisted. */
export const useFilterStore = create<FilterStoreState>((set) => ({
  filters: emptyFilterState,
  setFilters: (filters) => set({ filters }),
  reset: () => set({ filters: emptyFilterState }),
}));
