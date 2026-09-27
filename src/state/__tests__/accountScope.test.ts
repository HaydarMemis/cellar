import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCAL_GUEST_OWNER_ID } from '../../domain/types';
import { useAuthStore } from '../authStore';
import { useFavoritesStore } from '../favoritesStore';
import { useInventoryStore } from '../inventoryStore';
import { useJournalStore } from '../journalStore';
import { useRecipesStore } from '../recipesStore';
import { useShoppingListStore } from '../shoppingListStore';

/**
 * Regression coverage for the real account-isolation bug found in the
 * auth-lifecycle audit: on a shared device, User A's favorites/inventory/
 * journal/shopping-list/private-recipes were a single global blob, not
 * scoped per signed-in account — so User B, signing in on the same phone
 * after User A signed out, would see User A's personal data. These tests
 * exercise the fix end-to-end through the real store actions (not just
 * the repository layer — see raceConditions.test.ts for that), the same
 * way the app itself calls them: sign up, use a feature, sign out, sign
 * in as someone else, verify isolation.
 */
describe('account-scoped local data isolation', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useAuthStore.setState({ profile: null, isLoaded: false });
    useFavoritesStore.setState({ favorites: [], isLoaded: false });
    useInventoryStore.setState({ entries: [], isLoaded: false });
    useJournalStore.setState({ entries: [], isLoaded: false });
    useShoppingListStore.setState({ entries: [], isLoaded: false });
    useRecipesStore.setState({ recipes: [], isLoaded: false });
  });

  it('User B does not see User A\'s favorites, inventory, journal, or shopping list after switching accounts on the same device', async () => {
    const a = await useAuthStore.getState().signUp({ username: 'usera', displayName: 'User A', email: 'usera@example.com', password: 'secret1' });
    expect(a.ok).toBe(true);

    await useFavoritesStore.getState().toggle('cocktail', 'negroni');
    await useInventoryStore.getState().toggle('gin');
    await useJournalStore.getState().create({ drinkKind: 'cocktail', drinkId: 'negroni', drinkName: 'Negroni', rating: 5, madeAt: new Date().toISOString() });
    await useShoppingListStore.getState().addIngredients(['campari']);

    expect(useFavoritesStore.getState().isFavorite('cocktail', 'negroni')).toBe(true);
    expect(useInventoryStore.getState().has('gin')).toBe(true);
    expect(useJournalStore.getState().entries).toHaveLength(1);
    expect(useShoppingListStore.getState().entries).toHaveLength(1);

    await useAuthStore.getState().logOut();
    const b = await useAuthStore.getState().signUp({ username: 'userb', displayName: 'User B', email: 'userb@example.com', password: 'secret1' });
    expect(b.ok).toBe(true);

    // User B's in-memory view must be empty — none of User A's data.
    expect(useFavoritesStore.getState().isFavorite('cocktail', 'negroni')).toBe(false);
    expect(useFavoritesStore.getState().favorites).toEqual([]);
    expect(useInventoryStore.getState().has('gin')).toBe(false);
    expect(useInventoryStore.getState().entries).toEqual([]);
    expect(useJournalStore.getState().entries).toEqual([]);
    expect(useShoppingListStore.getState().entries).toEqual([]);
  });

  it('signing back in as User A restores exactly their own data, unaffected by User B\'s activity in between', async () => {
    await useAuthStore.getState().signUp({ username: 'usera', displayName: 'User A', email: 'usera@example.com', password: 'secret1' });
    await useFavoritesStore.getState().toggle('cocktail', 'daiquiri');
    await useAuthStore.getState().logOut();

    await useAuthStore.getState().signUp({ username: 'userb', displayName: 'User B', email: 'userb@example.com', password: 'secret1' });
    await useFavoritesStore.getState().toggle('cocktail', 'margarita');
    await useAuthStore.getState().logOut();

    const backAsA = await useAuthStore.getState().logIn({ email: 'usera@example.com', password: 'secret1' });
    expect(backAsA.ok).toBe(true);

    expect(useFavoritesStore.getState().favorites.map((f) => f.targetId)).toEqual(['daiquiri']);
    expect(useFavoritesStore.getState().isFavorite('cocktail', 'margarita')).toBe(false);
  });

  it('data created as a guest (signed out) stays isolated from a signed-in account, and a cold-start session restore loads the right scope', async () => {
    // As a guest first.
    await useFavoritesStore.getState().toggle('cocktail', 'martini');

    await useAuthStore.getState().signUp({ username: 'usera', displayName: 'User A', email: 'usera@example.com', password: 'secret1' });
    expect(useFavoritesStore.getState().isFavorite('cocktail', 'martini')).toBe(false);

    await useAuthStore.getState().logOut();
    // Simulate a cold start: only authStore.load() is called, as
    // app/_layout.tsx's hydrateStores() actually does — it alone must
    // reload the account-scoped stores correctly (see accountScope.ts).
    useAuthStore.setState({ profile: null, isLoaded: false });
    useFavoritesStore.setState({ favorites: [], isLoaded: false });
    await useAuthStore.getState().load();

    expect(useFavoritesStore.getState().isFavorite('cocktail', 'martini')).toBe(true);
  });

  it('"My recipes" ownership: a recipe created by one account is not editable/owned by a different account signed in later on the same device', async () => {
    await useAuthStore.getState().signUp({ username: 'usera', displayName: 'User A', email: 'usera@example.com', password: 'secret1' });
    const userAId = useAuthStore.getState().profile!.id;
    const recipe = await useRecipesStore.getState().create({
      name: "A's Recipe",
      description: '',
      baseSpirit: 'gin',
      category: [],
      tags: [],
      ingredients: [],
      method: 'stir',
      steps: ['Stir.'],
      glass: ['rocks'],
      abv: null,
      difficulty: 'easy',
      prepTimeMinutes: 3,
    });
    expect(recipe.ownerId).toBe(userAId);

    await useAuthStore.getState().logOut();
    await useAuthStore.getState().signUp({ username: 'userb', displayName: 'User B', email: 'userb@example.com', password: 'secret1' });

    // The repository itself refuses the mutation for a non-owner — this is
    // the defense-in-depth check (not just a UI-level "don't show the
    // button"), matching "the backend remains authoritative."
    const updateResult = await useRecipesStore.getState().update(recipe.id, { name: 'Hijacked' });
    expect(useRecipesStore.getState().recipes.find((r) => r.id === recipe.id)?.name).toBe("A's Recipe");
    void updateResult;
  });

  it('deleting an account without prior reassignment leaves guest-scope data untouched by an orphaned account\'s data', async () => {
    await useFavoritesStore.getState().toggle('cocktail', 'sazerac'); // guest favorite, before any sign-up
    await useAuthStore.getState().signUp({ username: 'temp', displayName: 'Temp', email: 'temp@example.com', password: 'secret1' });
    expect(useFavoritesStore.getState().favorites).toEqual([]); // signing up hid the guest favorite, as expected

    await useAuthStore.getState().deleteAccount();

    // Back to guest scope — the original guest favorite (never touched by
    // the deleted account, which had none of its own) is visible again.
    expect(useFavoritesStore.getState().isFavorite('cocktail', 'sazerac')).toBe(true);
  });

  it('LOCAL_GUEST_OWNER_ID is used for anything created while signed out', async () => {
    const recipe = await useRecipesStore.getState().create({
      name: 'Guest Recipe',
      description: '',
      baseSpirit: 'gin',
      category: [],
      tags: [],
      ingredients: [],
      method: 'stir',
      steps: ['Stir.'],
      glass: ['rocks'],
      abv: null,
      difficulty: 'easy',
      prepTimeMinutes: 3,
    });
    expect(recipe.ownerId).toBe(LOCAL_GUEST_OWNER_ID);
  });
});
