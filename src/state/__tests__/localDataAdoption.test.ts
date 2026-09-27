import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCAL_GUEST_OWNER_ID } from '../../domain/types';
import { useAuthStore } from '../authStore';
import { useFavoritesStore } from '../favoritesStore';
import { useInventoryStore } from '../inventoryStore';
import { useJournalStore } from '../journalStore';
import {
  adoptionSignature,
  adoptLocalData,
  findAdoptableData,
  isAdoptableOwner,
  rememberAdoptionDeclined,
  totalAdoptable,
  wasAdoptionDeclined,
} from '../localDataAdoption';
import { useRecipesStore } from '../recipesStore';
import { useShoppingListStore } from '../shoppingListStore';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER_REAL_ACCOUNT = '22222222-2222-4222-8222-222222222222';
const LEGACY_LOCAL_ACCOUNT = 'user-lz3k9w1-ab12cd34';

function recipe(id: string, ownerId: string, visibility: 'public' | 'private' = 'private') {
  return {
    id,
    ownerId,
    visibility,
    name: id,
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
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
}

async function seed() {
  await AsyncStorage.setItem(
    '@bar/recipes',
    JSON.stringify([
      recipe('recipe-guest', LOCAL_GUEST_OWNER_ID, 'public'),
      recipe('recipe-legacy', LEGACY_LOCAL_ACCOUNT, 'public'),
      recipe('recipe-other', OTHER_REAL_ACCOUNT),
      recipe('recipe-mine', ME),
    ]),
  );
  await AsyncStorage.setItem(
    '@bar/favorites',
    JSON.stringify([
      { id: 'f1', targetType: 'cocktail', targetId: 'negroni', ownerId: LOCAL_GUEST_OWNER_ID, createdAt: 'x' },
      { id: 'f2', targetType: 'cocktail', targetId: 'negroni', ownerId: ME, createdAt: 'x' },
      { id: 'f3', targetType: 'cocktail', targetId: 'daiquiri', ownerId: LEGACY_LOCAL_ACCOUNT, createdAt: 'x' },
      { id: 'f4', targetType: 'cocktail', targetId: 'martini', ownerId: OTHER_REAL_ACCOUNT, createdAt: 'x' },
    ]),
  );
  await AsyncStorage.setItem(
    '@bar/inventory',
    JSON.stringify([
      { ingredientId: 'gin', ownerId: LOCAL_GUEST_OWNER_ID, addedAt: 'x' },
      { ingredientId: 'gin', ownerId: ME, addedAt: 'x' },
      { ingredientId: 'campari', ownerId: LOCAL_GUEST_OWNER_ID, addedAt: 'x' },
    ]),
  );
  await AsyncStorage.setItem(
    '@bar/journal',
    JSON.stringify([{ id: 'j1', drinkId: 'negroni', drinkName: 'Negroni', drinkKind: 'cocktail', rating: 4, ownerId: LOCAL_GUEST_OWNER_ID, createdAt: 'x' }]),
  );
  await AsyncStorage.setItem(
    '@bar/shoppingList',
    JSON.stringify([
      { id: 's1', ingredientId: 'lime', ownerId: LOCAL_GUEST_OWNER_ID, completed: false, addedAt: 'x' },
      { id: 's2', ingredientId: 'lime', ownerId: ME, completed: true, addedAt: 'x' },
    ]),
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  useRecipesStore.setState({ recipes: [], isLoaded: false });
  useAuthStore.setState({ profile: { id: ME, username: 'me', displayName: 'Me', avatarColorSeed: 'm', createdAt: 'x' }, isLoaded: true });
});

describe('local data adoption', () => {
  it('offers guest and legacy device-only data — never another real account’s data', async () => {
    expect(isAdoptableOwner(LOCAL_GUEST_OWNER_ID, ME, true)).toBe(true);
    expect(isAdoptableOwner(LEGACY_LOCAL_ACCOUNT, ME, true)).toBe(true);
    expect(isAdoptableOwner(OTHER_REAL_ACCOUNT, ME, true)).toBe(false);
    expect(isAdoptableOwner(ME, ME, true)).toBe(false);
    // With the local dev backend, every account id is `user-…` — don't treat those as legacy.
    expect(isAdoptableOwner(LEGACY_LOCAL_ACCOUNT, ME, false)).toBe(false);

    await seed();
    const data = await findAdoptableData(ME, true);
    expect(data.ownerIds).toEqual([LOCAL_GUEST_OWNER_ID, LEGACY_LOCAL_ACCOUNT].sort());
    expect(data).toMatchObject({ recipes: 2, favorites: 2, inventory: 2, journal: 1, shoppingList: 1 });
    expect(totalAdoptable(data)).toBe(8);
  });

  it('adopting moves everything into the account, merges duplicates, and never silently publishes', async () => {
    await seed();
    const data = await findAdoptableData(ME, true);
    await adoptLocalData(ME, data.ownerIds);

    const recipes = useRecipesStore.getState().recipes;
    const mine = recipes.filter((r) => r.ownerId === ME).map((r) => r.id).sort();
    expect(mine).toEqual(['recipe-guest', 'recipe-legacy', 'recipe-mine']);
    expect(recipes.find((r) => r.id === 'recipe-guest')?.visibility).toBe('private');
    expect(recipes.find((r) => r.id === 'recipe-other')?.ownerId).toBe(OTHER_REAL_ACCOUNT);

    // Loaded into the signed-in account's stores:
    expect(useFavoritesStore.getState().favorites.map((f) => f.targetId).sort()).toEqual(['daiquiri', 'negroni']);
    expect(useInventoryStore.getState().entries.map((e) => e.ingredientId).sort()).toEqual(['campari', 'gin']);
    expect(useJournalStore.getState().entries).toHaveLength(1);
    const lime = useShoppingListStore.getState().entries.filter((e) => e.ingredientId === 'lime');
    expect(lime).toHaveLength(1);
    expect(lime[0].completed).toBe(false); // still needed on one list => still needed

    // Nothing left to offer, and nothing was deleted.
    expect(totalAdoptable(await findAdoptableData(ME, true))).toBe(0);
    const raw = JSON.parse((await AsyncStorage.getItem('@bar/favorites')) ?? '[]');
    expect(raw.find((f: { targetId: string }) => f.targetId === 'martini')?.ownerId).toBe(OTHER_REAL_ACCOUNT);
  });

  it('“Not now” is remembered for the same data, but new guest data is offered again', async () => {
    await seed();
    const data = await findAdoptableData(ME, true);
    await rememberAdoptionDeclined(ME, data);
    expect(await wasAdoptionDeclined(ME, data)).toBe(true);
    const more = { ...data, favorites: data.favorites + 1 };
    expect(adoptionSignature(more)).not.toBe(adoptionSignature(data));
    expect(await wasAdoptionDeclined(ME, more)).toBe(false);
  });

  it('guest data stays visible as guest data after signing out (no adoption)', async () => {
    await seed();
    await useAuthStore.getState().logOut();
    await useFavoritesStore.getState().load();
    expect(useFavoritesStore.getState().favorites.map((f) => f.targetId)).toEqual(['negroni']);
  });
});
