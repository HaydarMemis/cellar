import { create } from 'zustand';
import { remoteRecipeBackend } from '../data/community';
import { PersonalRecipe } from '../domain/types';
import { reportError } from '../lib/crashReporting';

const PAGE_SIZE = 20;

interface DiscoverFeedState {
  recipes: PersonalRecipe[];
  isLoading: boolean;
  /** True only for a genuine backend failure — an empty community is not an error (see Discover's empty state). */
  hasError: boolean;
  nextCursor: string | null;
  /**
   * Every published recipe this session has seen from the backend (feed
   * pages, creator pages, direct lookups), keyed by remote id — what the
   * recipe detail screen resolves someone else's recipe from, since those
   * never exist in this device's own recipe store.
   */
  byId: Record<string, PersonalRecipe>;
  /** Replaces the feed with a fresh first page. Safe to call on every focus. */
  load: () => Promise<void>;
  /** Appends the next page; a no-op once the last page has been reached or while another load is in flight. */
  loadMore: () => Promise<void>;
  /** Adds recipes fetched elsewhere (e.g. a creator's page) to `byId`. */
  remember: (recipes: PersonalRecipe[]) => void;
  /** Resolves one published recipe by remote id: from `byId` if already seen, otherwise from the backend. Throws on a backend failure; undefined means "doesn't exist". */
  fetchById: (id: string) => Promise<PersonalRecipe | undefined>;
}

function indexById(existing: Record<string, PersonalRecipe>, recipes: PersonalRecipe[]): Record<string, PersonalRecipe> {
  if (recipes.length === 0) return existing;
  const next = { ...existing };
  for (const r of recipes) next[r.id] = r;
  return next;
}

/**
 * Monotonic token for `load()`: a focus-triggered refresh can overlap an
 * earlier one (or a loadMore), and whichever response arrives LAST must not
 * win just because it was slower — only the newest request may write.
 */
let loadGeneration = 0;

/** Ids the backend said don't exist (unpublished/deleted) — not re-requested every render. Cleared on refresh. */
const knownMissing = new Set<string>();

/**
 * The community feed, read from the REAL backend (`recipes` table) rather
 * than from this device's own recipe store — that on-device list only ever
 * contains recipes created on this device, so it can never show anyone
 * else's work.
 *
 * Only used when Supabase is configured; with no backend
 * (`remoteRecipeBackend === null`) every action here is a no-op and
 * app/(tabs)/discover.tsx keeps reading the local store instead. Block
 * filtering stays client-side on top of this, as before.
 */
export const useDiscoverFeedStore = create<DiscoverFeedState>((set, get) => ({
  recipes: [],
  isLoading: false,
  hasError: false,
  nextCursor: null,
  byId: {},

  load: async () => {
    if (!remoteRecipeBackend) return;
    const generation = ++loadGeneration;
    knownMissing.clear();
    set({ isLoading: true, hasError: false });
    try {
      const page = await remoteRecipeBackend.fetchPublicRecipesPage(null, PAGE_SIZE);
      if (generation !== loadGeneration) return;
      set({ recipes: page.recipes, nextCursor: page.nextCursor, isLoading: false, byId: indexById(get().byId, page.recipes) });
    } catch (e) {
      reportError(e, { module: 'discoverFeedStore', action: 'load' });
      if (generation !== loadGeneration) return;
      // Keep whatever was already on screen rather than blanking the feed
      // out from under the user on a transient network failure.
      set({ isLoading: false, hasError: true });
    }
  },

  loadMore: async () => {
    const { nextCursor, isLoading } = get();
    if (!remoteRecipeBackend || !nextCursor || isLoading) return;
    const generation = loadGeneration;
    set({ isLoading: true });
    try {
      const page = await remoteRecipeBackend.fetchPublicRecipesPage(nextCursor, PAGE_SIZE);
      // A fresh load() started while this page was in flight: its first
      // page replaces the feed, so appending this (older) page would mix
      // two different snapshots.
      if (generation !== loadGeneration) return;
      const seen = new Set(get().recipes.map((r) => r.id));
      const merged = [...get().recipes, ...page.recipes.filter((r) => !seen.has(r.id))];
      set({ recipes: merged, nextCursor: page.nextCursor, isLoading: false, byId: indexById(get().byId, page.recipes) });
    } catch (e) {
      reportError(e, { module: 'discoverFeedStore', action: 'loadMore' });
      if (generation !== loadGeneration) return;
      set({ isLoading: false, hasError: true });
    }
  },

  remember: (recipes) => set({ byId: indexById(get().byId, recipes) }),

  fetchById: async (id) => {
    const cached = get().byId[id];
    if (cached) return cached;
    if (!remoteRecipeBackend || knownMissing.has(id)) return undefined;
    const recipe = await remoteRecipeBackend.fetchRecipeById(id);
    if (recipe) set({ byId: indexById(get().byId, [recipe]) });
    else knownMissing.add(id);
    return recipe;
  },
}));
