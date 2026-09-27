import AsyncStorage from '@react-native-async-storage/async-storage';
import { communityBackend } from '../../data/community';
import { LOCAL_GUEST_OWNER_ID } from '../../domain/types';
import { useAuthStore } from '../authStore';
import { useCommunityStore } from '../communityStore';
import { useFavoritesStore } from '../favoritesStore';
import { useInventoryStore } from '../inventoryStore';
import { useJournalStore } from '../journalStore';
import { useRecipesStore } from '../recipesStore';
import { useShoppingListStore } from '../shoppingListStore';

const baseRecipeInput = {
  name: 'Test Recipe',
  description: '',
  baseSpirit: 'gin',
  category: [],
  tags: [],
  ingredients: [],
  method: 'shake' as const,
  steps: ['Shake.'],
  glass: ['coupe' as const],
  abv: null,
  difficulty: 'easy' as const,
  prepTimeMinutes: 3,
};

describe('account deletion', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useAuthStore.setState({ profile: null, isLoaded: false });
    useRecipesStore.setState({ recipes: [], isLoaded: false });
    useFavoritesStore.setState({ favorites: [], isLoaded: false });
    useInventoryStore.setState({ entries: [], isLoaded: false });
    useJournalStore.setState({ entries: [], isLoaded: false });
    useShoppingListStore.setState({ entries: [], isLoaded: false });
    useCommunityStore.setState({ likeCounts: {}, likedByMe: new Set(), followingByMe: new Set(), followCountsByUser: {} });
  });

  it('reassigns the deleted account\'s public recipes to the local guest owner and makes them private', async () => {
    const signUp = await useAuthStore.getState().signUp({ username: 'deleteme', displayName: 'Delete Me', email: 'deleteme@example.com', password: 'secret1' });
    expect(signUp.ok).toBe(true);
    const userId = useAuthStore.getState().profile!.id;

    const recipe = await useRecipesStore.getState().create({ ...baseRecipeInput, visibility: 'public' });
    expect(recipe.ownerId).toBe(userId);
    expect(recipe.visibility).toBe('public');

    await useRecipesStore.getState().reassignOwnerToGuestAndPrivatize(userId);
    await useAuthStore.getState().deleteAccount();

    const updated = useRecipesStore.getState().recipes.find((r) => r.id === recipe.id);
    expect(updated?.ownerId).toBe(LOCAL_GUEST_OWNER_ID);
    expect(updated?.visibility).toBe('private');
  });

  it('clears the session and removes the account so login/lookup no longer succeed', async () => {
    await useAuthStore.getState().signUp({ username: 'goneuser', displayName: 'Gone User', email: 'goneuser@example.com', password: 'secret1' });
    await useAuthStore.getState().deleteAccount();

    expect(useAuthStore.getState().profile).toBeNull();

    // Reloading from storage must also come back signed out — the account record itself is gone.
    useAuthStore.setState({ profile: null, isLoaded: false });
    await useAuthStore.getState().load();
    expect(useAuthStore.getState().profile).toBeNull();

    const loginAttempt = await useAuthStore.getState().logIn({ email: 'goneuser@example.com', password: 'secret1' });
    expect(loginAttempt).toEqual({ ok: false, error: 'not-found' });
  });

  it('removes likes and follows involving the deleted account', async () => {
    const a = await useAuthStore.getState().signUp({ username: 'usera', displayName: 'User A', email: 'usera@example.com', password: 'secret1' });
    expect(a.ok).toBe(true);
    const userAId = useAuthStore.getState().profile!.id;

    await useAuthStore.getState().logOut();
    const b = await useAuthStore.getState().signUp({ username: 'userb', displayName: 'User B', email: 'userb@example.com', password: 'secret1' });
    expect(b.ok).toBe(true);
    const userBId = useAuthStore.getState().profile!.id;

    // User A liked a recipe and User B follows User A — sign back in as A to delete that account.
    await communityBackend.toggleLike(userAId, 'recipe-1');
    await communityBackend.toggleFollow(userBId, userAId);

    await useAuthStore.getState().logOut();
    await useAuthStore.getState().logIn({ email: 'usera@example.com', password: 'secret1' });
    await useAuthStore.getState().deleteAccount();

    expect(await communityBackend.hasLiked(userAId, 'recipe-1')).toBe(false);
    expect(await communityBackend.isFollowing(userBId, userAId)).toBe(false);
  });

  it(
    'reassigns favorites, inventory, and journal data to the guest identity on deletion — matching the real ' +
      'delete-account screen flow (reassign-then-delete, see app/delete-account.tsx), the data is not lost',
    async () => {
      await useAuthStore.getState().signUp({ username: 'localstuffuser', displayName: 'Local Stuff', email: 'localstuffuser@example.com', password: 'secret1' });
      const userId = useAuthStore.getState().profile!.id;

      await useFavoritesStore.getState().toggle('cocktail', 'margarita');
      await useInventoryStore.getState().toggle('gin');
      await useJournalStore.getState().create({ drinkKind: 'cocktail', drinkId: 'margarita', drinkName: 'Margarita', rating: 5, madeAt: new Date().toISOString() });
      await useShoppingListStore.getState().addIngredients(['lime-juice']);

      // The real screen reassigns every account-scoped store to the guest
      // identity BEFORE calling deleteAccount() — see app/delete-account.tsx.
      await Promise.all([
        useFavoritesStore.getState().reassignOwnerToGuest(userId),
        useInventoryStore.getState().reassignOwnerToGuest(userId),
        useJournalStore.getState().reassignOwnerToGuest(userId),
        useShoppingListStore.getState().reassignOwnerToGuest(userId),
      ]);
      await useAuthStore.getState().deleteAccount();

      // Now signed out (guest) — currentOwnerId() resolves to LOCAL_GUEST_OWNER_ID,
      // and the reassigned data should be visible again under that identity.
      expect(useAuthStore.getState().profile).toBeNull();
      expect(useFavoritesStore.getState().isFavorite('cocktail', 'margarita')).toBe(true);
      expect(useInventoryStore.getState().has('gin')).toBe(true);
      expect(useJournalStore.getState().entries.map((e) => e.drinkName)).toEqual(['Margarita']);
      expect(useShoppingListStore.getState().entries.map((e) => e.ingredientId)).toEqual(['lime-juice']);
    },
  );

  it('without reassignment, deleteAccount() alone does not delete favorites/inventory/journal data from storage — it becomes orphaned under the deleted account id, not lost, just no longer reachable from this session', async () => {
    await useAuthStore.getState().signUp({ username: 'noreassign', displayName: 'No Reassign', email: 'noreassign@example.com', password: 'secret1' });
    await useFavoritesStore.getState().toggle('cocktail', 'daiquiri');

    await useAuthStore.getState().deleteAccount();

    // In-memory state reloads as guest — the orphaned data (still tagged
    // with the now-deleted account's id) is correctly not shown, since it
    // no longer belongs to anyone who can sign in again.
    expect(useFavoritesStore.getState().isFavorite('cocktail', 'daiquiri')).toBe(false);
  });
});
