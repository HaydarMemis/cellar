import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../authStore';
import { useShoppingListStore } from '../shoppingListStore';

/**
 * Regression coverage for the real, persistent shopping list — added after
 * a real "Maximum update depth exceeded" crash was found and fixed in
 * app/shopping-list.tsx (a Zustand selector, `(s) => s.asIdSet()`, was
 * allocating a new Set on every call — see that file's comment). These
 * tests exercise the store's actual behavior, independent of that
 * rendering bug, since the store itself was never the buggy part.
 */
describe('useShoppingListStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useAuthStore.setState({ profile: null, isLoaded: false });
    useShoppingListStore.setState({ entries: [], isLoaded: false });
  });

  it('starts empty', () => {
    expect(useShoppingListStore.getState().entries).toEqual([]);
  });

  it('adds a single ingredient as an unchecked item', async () => {
    await useShoppingListStore.getState().addIngredients(['gin']);
    const entries = useShoppingListStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ ingredientId: 'gin', completed: false });
  });

  it('adds multiple ingredients in one call', async () => {
    await useShoppingListStore.getState().addIngredients(['gin', 'tonic-water', 'lime-juice']);
    const ids = useShoppingListStore.getState().entries.map((e) => e.ingredientId).sort();
    expect(ids).toEqual(['gin', 'lime-juice', 'tonic-water']);
  });

  it('adding the same ingredient twice does not create a duplicate row', async () => {
    await useShoppingListStore.getState().addIngredients(['gin']);
    await useShoppingListStore.getState().addIngredients(['gin']);
    expect(useShoppingListStore.getState().entries).toHaveLength(1);
  });

  it('adding an ingredient from a second recipe merges into the same list rather than replacing it', async () => {
    await useShoppingListStore.getState().addIngredients(['gin', 'tonic-water']); // from recipe A
    await useShoppingListStore.getState().addIngredients(['lime-juice', 'gin']); // from recipe B, gin overlaps
    const ids = useShoppingListStore.getState().entries.map((e) => e.ingredientId).sort();
    expect(ids).toEqual(['gin', 'lime-juice', 'tonic-water']);
  });

  it('re-adding an already-checked-off ingredient unchecks it again', async () => {
    await useShoppingListStore.getState().addIngredients(['gin']);
    const entry = useShoppingListStore.getState().entries[0];
    await useShoppingListStore.getState().toggleCompleted(entry.id);
    expect(useShoppingListStore.getState().entries[0].completed).toBe(true);

    await useShoppingListStore.getState().addIngredients(['gin']);
    expect(useShoppingListStore.getState().entries).toHaveLength(1);
    expect(useShoppingListStore.getState().entries[0].completed).toBe(false);
  });

  it('re-adding an ingredient that is still unchecked leaves it alone (no-op, no duplicate)', async () => {
    await useShoppingListStore.getState().addIngredients(['gin']);
    const before = useShoppingListStore.getState().entries[0];
    await useShoppingListStore.getState().addIngredients(['gin']);
    const after = useShoppingListStore.getState().entries[0];
    expect(after.id).toBe(before.id);
    expect(useShoppingListStore.getState().entries).toHaveLength(1);
  });

  it('addIngredients([]) is a safe no-op', async () => {
    await useShoppingListStore.getState().addIngredients(['gin']);
    await useShoppingListStore.getState().addIngredients([]);
    expect(useShoppingListStore.getState().entries).toHaveLength(1);
  });

  it('toggleCompleted flips completed and toggling twice returns to unchecked', async () => {
    await useShoppingListStore.getState().addIngredients(['gin']);
    const entry = useShoppingListStore.getState().entries[0];

    await useShoppingListStore.getState().toggleCompleted(entry.id);
    expect(useShoppingListStore.getState().entries[0].completed).toBe(true);

    await useShoppingListStore.getState().toggleCompleted(entry.id);
    expect(useShoppingListStore.getState().entries[0].completed).toBe(false);
  });

  it('toggling an unknown id does not throw and leaves the list unchanged', async () => {
    await useShoppingListStore.getState().addIngredients(['gin']);
    await expect(useShoppingListStore.getState().toggleCompleted('not-a-real-id')).resolves.toBeUndefined();
    expect(useShoppingListStore.getState().entries).toHaveLength(1);
  });

  it('remove deletes exactly the targeted item', async () => {
    await useShoppingListStore.getState().addIngredients(['gin', 'tonic-water']);
    const gin = useShoppingListStore.getState().entries.find((e) => e.ingredientId === 'gin')!;
    await useShoppingListStore.getState().remove(gin.id);
    const ids = useShoppingListStore.getState().entries.map((e) => e.ingredientId);
    expect(ids).toEqual(['tonic-water']);
  });

  it('clearCompleted removes only checked items, leaving unchecked ones', async () => {
    await useShoppingListStore.getState().addIngredients(['gin', 'tonic-water', 'lime-juice']);
    const [gin, tonic] = useShoppingListStore.getState().entries;
    await useShoppingListStore.getState().toggleCompleted(gin.id);
    await useShoppingListStore.getState().toggleCompleted(tonic.id);

    await useShoppingListStore.getState().clearCompleted();

    const remaining = useShoppingListStore.getState().entries;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].ingredientId).toBe('lime-juice');
  });

  it('clearCompleted with nothing checked off is a no-op', async () => {
    await useShoppingListStore.getState().addIngredients(['gin']);
    await useShoppingListStore.getState().clearCompleted();
    expect(useShoppingListStore.getState().entries).toHaveLength(1);
  });

  it('clearAll empties the list regardless of checked state', async () => {
    await useShoppingListStore.getState().addIngredients(['gin', 'tonic-water']);
    const gin = useShoppingListStore.getState().entries.find((e) => e.ingredientId === 'gin')!;
    await useShoppingListStore.getState().toggleCompleted(gin.id);

    await useShoppingListStore.getState().clearAll();

    expect(useShoppingListStore.getState().entries).toEqual([]);
  });

  it('clearAll on an already-empty list does not throw', async () => {
    await expect(useShoppingListStore.getState().clearAll()).resolves.toBeUndefined();
    expect(useShoppingListStore.getState().entries).toEqual([]);
  });
});
