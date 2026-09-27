import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCAL_GUEST_OWNER_ID } from '../../domain/types';
import { useAuthStore } from '../authStore';
import { useEntitlementStore } from '../entitlementStore';
import { useFavoritesStore } from '../favoritesStore';
import { useInventoryStore } from '../inventoryStore';
import { useJournalStore } from '../journalStore';
import { useRecipesStore } from '../recipesStore';
import { useShoppingListStore } from '../shoppingListStore';

describe('store persistence across a simulated app restart', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    // Reset first — favorites/inventory now scope by currentOwnerId(),
    // which reads this, so a signed-in profile leaking in from a
    // different test file/describe would make these tests silently use
    // the wrong owner scope instead of the guest identity they assume.
    useAuthStore.setState({ profile: null, isLoaded: false });
    useFavoritesStore.setState({ favorites: [], isLoaded: false });
    useInventoryStore.setState({ entries: [], isLoaded: false });
    useRecipesStore.setState({ recipes: [], isLoaded: false });
  });

  it('favorites survive a restart', async () => {
    await useFavoritesStore.getState().toggle('cocktail', 'margarita');
    await useFavoritesStore.getState().toggle('cocktail', 'negroni');

    useFavoritesStore.setState({ favorites: [], isLoaded: false }); // simulate app relaunch
    await useFavoritesStore.getState().load();

    const ids = useFavoritesStore.getState().favorites.map((f) => f.targetId).sort();
    expect(ids).toEqual(['margarita', 'negroni']);
  });

  it('an un-favorited item stays gone after a restart', async () => {
    await useFavoritesStore.getState().toggle('cocktail', 'margarita');
    await useFavoritesStore.getState().toggle('cocktail', 'margarita'); // toggle off

    useFavoritesStore.setState({ favorites: [], isLoaded: false });
    await useFavoritesStore.getState().load();

    expect(useFavoritesStore.getState().favorites).toEqual([]);
  });

  it('ingredient inventory survives a restart', async () => {
    await useInventoryStore.getState().toggle('gin');
    await useInventoryStore.getState().toggle('tonic-water');

    useInventoryStore.setState({ entries: [], isLoaded: false });
    await useInventoryStore.getState().load();

    const ids = useInventoryStore.getState().entries.map((e) => e.ingredientId).sort();
    expect(ids).toEqual(['gin', 'tonic-water']);
  });

  it('clearing the inventory persists as empty after a restart', async () => {
    await useInventoryStore.getState().toggle('gin');
    await useInventoryStore.getState().clear();

    useInventoryStore.setState({ entries: [], isLoaded: false });
    await useInventoryStore.getState().load();

    expect(useInventoryStore.getState().entries).toEqual([]);
  });

  it('a created personal recipe survives a restart', async () => {
    await useRecipesStore.getState().create({
      name: 'My Sour',
      description: '',
      baseSpirit: 'gin',
      category: [],
      tags: [],
      ingredients: [],
      method: 'shake',
      steps: ['Shake.'],
      glass: ['coupe'],
      abv: null,
      difficulty: 'easy',
      prepTimeMinutes: 3,
    });

    useRecipesStore.setState({ recipes: [], isLoaded: false });
    await useRecipesStore.getState().load();

    expect(useRecipesStore.getState().recipes.map((r) => r.name)).toEqual(['My Sour']);
  });

  it('an edited recipe keeps the edit after a restart', async () => {
    const created = await useRecipesStore.getState().create({
      name: 'Original Name',
      description: '',
      baseSpirit: 'gin',
      category: [],
      tags: [],
      ingredients: [],
      method: 'shake',
      steps: ['Shake.'],
      glass: ['coupe'],
      abv: null,
      difficulty: 'easy',
      prepTimeMinutes: 3,
    });
    await useRecipesStore.getState().update(created.id, { name: 'Renamed' });

    useRecipesStore.setState({ recipes: [], isLoaded: false });
    await useRecipesStore.getState().load();

    expect(useRecipesStore.getState().recipes.map((r) => r.name)).toEqual(['Renamed']);
  });

  it('a deleted recipe stays deleted after a restart', async () => {
    const created = await useRecipesStore.getState().create({
      name: 'To Delete',
      description: '',
      baseSpirit: 'gin',
      category: [],
      tags: [],
      ingredients: [],
      method: 'shake',
      steps: ['Shake.'],
      glass: ['coupe'],
      abv: null,
      difficulty: 'easy',
      prepTimeMinutes: 3,
    });
    await useRecipesStore.getState().remove(created.id);

    useRecipesStore.setState({ recipes: [], isLoaded: false });
    await useRecipesStore.getState().load();

    expect(useRecipesStore.getState().recipes).toEqual([]);
  });

  it('a new recipe defaults to private and the local guest owner when signed out', async () => {
    useAuthStore.setState({ profile: null, isLoaded: false });
    const created = await useRecipesStore.getState().create({
      name: 'Guest Recipe',
      description: '',
      baseSpirit: 'gin',
      category: [],
      tags: [],
      ingredients: [],
      method: 'shake',
      steps: ['Shake.'],
      glass: ['coupe'],
      abv: null,
      difficulty: 'easy',
      prepTimeMinutes: 3,
    });
    expect(created.visibility).toBe('private');
    expect(created.ownerId).toBe(LOCAL_GUEST_OWNER_ID);
  });

  it('a recipe created while signed in and marked public keeps that visibility after a restart', async () => {
    const signUp = await useAuthStore.getState().signUp({ username: 'publisher', displayName: 'Publisher', email: 'publisher@example.com', password: 'secret1' });
    expect(signUp.ok).toBe(true);

    const created = await useRecipesStore.getState().create({
      name: 'Published Recipe',
      description: '',
      baseSpirit: 'gin',
      category: [],
      tags: [],
      ingredients: [],
      method: 'shake',
      steps: ['Shake.'],
      glass: ['coupe'],
      abv: null,
      difficulty: 'easy',
      prepTimeMinutes: 3,
      visibility: 'public',
    });
    expect(created.ownerId).toBe(useAuthStore.getState().profile?.id);
    expect(created.visibility).toBe('public');

    useRecipesStore.setState({ recipes: [], isLoaded: false });
    await useRecipesStore.getState().load();

    const reloaded = useRecipesStore.getState().recipes.find((r) => r.id === created.id);
    expect(reloaded?.visibility).toBe('public');
  });
});

describe('journal persistence across a simulated app restart', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useAuthStore.setState({ profile: null, isLoaded: false });
    useJournalStore.setState({ entries: [], isLoaded: false });
  });

  it('a logged journal entry survives a restart', async () => {
    await useJournalStore.getState().create({
      drinkKind: 'cocktail',
      drinkId: 'margarita',
      drinkName: 'Margarita',
      rating: 4,
      madeAt: new Date().toISOString(),
    });

    useJournalStore.setState({ entries: [], isLoaded: false });
    await useJournalStore.getState().load();

    expect(useJournalStore.getState().entries.map((e) => e.drinkName)).toEqual(['Margarita']);
  });

  it('a deleted journal entry stays deleted after a restart', async () => {
    const entry = await useJournalStore.getState().create({
      drinkKind: 'cocktail',
      drinkId: 'daiquiri',
      drinkName: 'Daiquiri',
      rating: 5,
      madeAt: new Date().toISOString(),
    });
    await useJournalStore.getState().remove(entry.id);

    useJournalStore.setState({ entries: [], isLoaded: false });
    await useJournalStore.getState().load();

    expect(useJournalStore.getState().entries).toEqual([]);
  });

  it('an edited journal entry keeps the edit after a restart', async () => {
    const entry = await useJournalStore.getState().create({
      drinkKind: 'cocktail',
      drinkId: 'daiquiri',
      drinkName: 'Daiquiri',
      rating: 3,
      madeAt: new Date().toISOString(),
    });
    await useJournalStore.getState().update(entry.id, { rating: 5, note: 'Better with less sugar.' });

    useJournalStore.setState({ entries: [], isLoaded: false });
    await useJournalStore.getState().load();

    const reloaded = useJournalStore.getState().entries.find((e) => e.id === entry.id);
    expect(reloaded?.rating).toBe(5);
    expect(reloaded?.note).toBe('Better with less sugar.');
    // the drink association itself is immutable via update() — only rating/note are editable
    expect(reloaded?.drinkId).toBe('daiquiri');
  });

  it('updating an unknown journal entry id is a safe no-op', async () => {
    await useJournalStore.getState().create({
      drinkKind: 'cocktail',
      drinkId: 'daiquiri',
      drinkName: 'Daiquiri',
      rating: 3,
      madeAt: new Date().toISOString(),
    });
    await expect(useJournalStore.getState().update('not-a-real-id', { rating: 1 })).resolves.toBeUndefined();
    expect(useJournalStore.getState().entries).toHaveLength(1);
    expect(useJournalStore.getState().entries[0].rating).toBe(3);
  });
});

describe('shopping list persistence across a simulated app restart', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useAuthStore.setState({ profile: null, isLoaded: false });
    useShoppingListStore.setState({ entries: [], isLoaded: false });
  });

  it('added ingredients survive a restart', async () => {
    await useShoppingListStore.getState().addIngredients(['gin', 'tonic-water']);

    useShoppingListStore.setState({ entries: [], isLoaded: false });
    await useShoppingListStore.getState().load();

    const ids = useShoppingListStore.getState().entries.map((e) => e.ingredientId).sort();
    expect(ids).toEqual(['gin', 'tonic-water']);
  });

  it('a checked-off state survives a restart', async () => {
    await useShoppingListStore.getState().addIngredients(['gin']);
    const entry = useShoppingListStore.getState().entries[0];
    await useShoppingListStore.getState().toggleCompleted(entry.id);

    useShoppingListStore.setState({ entries: [], isLoaded: false });
    await useShoppingListStore.getState().load();

    expect(useShoppingListStore.getState().entries[0].completed).toBe(true);
  });

  it('a removed item stays removed after a restart', async () => {
    await useShoppingListStore.getState().addIngredients(['gin', 'lime-juice']);
    const toRemove = useShoppingListStore.getState().entries.find((e) => e.ingredientId === 'gin')!;
    await useShoppingListStore.getState().remove(toRemove.id);

    useShoppingListStore.setState({ entries: [], isLoaded: false });
    await useShoppingListStore.getState().load();

    expect(useShoppingListStore.getState().entries.map((e) => e.ingredientId)).toEqual(['lime-juice']);
  });

  it('clearing all persists as empty after a restart', async () => {
    await useShoppingListStore.getState().addIngredients(['gin', 'lime-juice']);
    await useShoppingListStore.getState().clearAll();

    useShoppingListStore.setState({ entries: [], isLoaded: false });
    await useShoppingListStore.getState().load();

    expect(useShoppingListStore.getState().entries).toEqual([]);
  });
});

describe('entitlement persistence across a simulated app restart', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useEntitlementStore.setState({ isPremium: false, activePlan: null, isLoaded: false });
  });

  it('defaults to free (never premium by default)', async () => {
    await useEntitlementStore.getState().load();
    expect(useEntitlementStore.getState().isPremium).toBe(false);
  });

  it('a purchase persists across a restart', async () => {
    await useEntitlementStore.getState().purchase('yearly');
    expect(useEntitlementStore.getState().isPremium).toBe(true);

    useEntitlementStore.setState({ isPremium: false, activePlan: null, isLoaded: false });
    await useEntitlementStore.getState().load();

    expect(useEntitlementStore.getState().isPremium).toBe(true);
    expect(useEntitlementStore.getState().activePlan).toBe('yearly');
  });

  it('a dev downgrade to free persists across a restart', async () => {
    await useEntitlementStore.getState().purchase('monthly');
    await useEntitlementStore.getState().devDowngradeToFree();
    expect(useEntitlementStore.getState().isPremium).toBe(false);

    useEntitlementStore.setState({ isPremium: true, activePlan: 'monthly', isLoaded: false });
    await useEntitlementStore.getState().load();

    expect(useEntitlementStore.getState().isPremium).toBe(false);
  });
});

describe('auth session persistence across a simulated app restart', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useAuthStore.setState({ profile: null, isLoaded: false });
  });

  it('a signed-in session survives a restart', async () => {
    const result = await useAuthStore.getState().signUp({ username: 'restartuser', displayName: 'Restart User', email: 'restartuser@example.com', password: 'secret1' });
    expect(result.ok).toBe(true);

    useAuthStore.setState({ profile: null, isLoaded: false });
    await useAuthStore.getState().load();

    expect(useAuthStore.getState().profile?.username).toBe('restartuser');
  });

  it('signing out clears the session across a restart', async () => {
    await useAuthStore.getState().signUp({ username: 'logsout', displayName: 'Logs Out', email: 'logsout@example.com', password: 'secret1' });
    await useAuthStore.getState().logOut();

    useAuthStore.setState({ profile: null, isLoaded: false });
    await useAuthStore.getState().load();

    expect(useAuthStore.getState().profile).toBeNull();
  });
});
