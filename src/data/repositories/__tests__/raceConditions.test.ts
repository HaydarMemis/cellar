import AsyncStorage from '@react-native-async-storage/async-storage';
import { asyncStorageFavoritesRepository } from '../FavoritesRepository';
import { asyncStorageInventoryRepository } from '../InventoryRepository';
import { asyncStorageRecipeRepository } from '../RecipeRepository';

const OWNER = 'test-user';

describe('repository race conditions', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps both favorites when two different items are toggled at the same time', async () => {
    // Reproduces rapidly favoriting two different cocktails from a grid
    // before the first tap's write has committed.
    await Promise.all([
      asyncStorageFavoritesRepository.toggle(OWNER, 'cocktail', 'margarita'),
      asyncStorageFavoritesRepository.toggle(OWNER, 'cocktail', 'daiquiri'),
    ]);

    const all = await asyncStorageFavoritesRepository.getAll(OWNER);
    expect(all.map((f) => f.targetId).sort()).toEqual(['daiquiri', 'margarita']);
  });

  it('keeps every ingredient when several checkboxes are tapped in quick succession', async () => {
    // The "I Have These Ingredients" screen invites exactly this: tapping
    // through a list of checkboxes fast.
    const ingredientIds = ['gin', 'lime-juice', 'tonic-water', 'soda-water', 'mint-leaves'];

    await Promise.all(ingredientIds.map((id) => asyncStorageInventoryRepository.toggle(OWNER, id)));

    const all = await asyncStorageInventoryRepository.getAll(OWNER);
    expect(all.map((e) => e.ingredientId).sort()).toEqual([...ingredientIds].sort());
  });

  it('un-favoriting and re-favoriting different items concurrently settles correctly', async () => {
    await asyncStorageFavoritesRepository.toggle(OWNER, 'cocktail', 'negroni');
    await Promise.all([
      asyncStorageFavoritesRepository.toggle(OWNER, 'cocktail', 'negroni'), // remove
      asyncStorageFavoritesRepository.toggle(OWNER, 'cocktail', 'martini'), // add
    ]);

    const all = await asyncStorageFavoritesRepository.getAll(OWNER);
    expect(all.map((f) => f.targetId)).toEqual(['martini']);
  });

  it('favorites are isolated per owner — a second account toggling the same target does not affect the first', async () => {
    await asyncStorageFavoritesRepository.toggle(OWNER, 'cocktail', 'negroni');
    await asyncStorageFavoritesRepository.toggle('other-user', 'cocktail', 'negroni');

    expect((await asyncStorageFavoritesRepository.getAll(OWNER)).map((f) => f.targetId)).toEqual(['negroni']);
    expect((await asyncStorageFavoritesRepository.getAll('other-user')).map((f) => f.targetId)).toEqual(['negroni']);

    // Un-favoriting as the second account must not remove the first account's favorite.
    await asyncStorageFavoritesRepository.toggle('other-user', 'cocktail', 'negroni');
    expect((await asyncStorageFavoritesRepository.getAll(OWNER)).map((f) => f.targetId)).toEqual(['negroni']);
    expect(await asyncStorageFavoritesRepository.getAll('other-user')).toEqual([]);
  });

  it('creating two personal recipes concurrently keeps both', async () => {
    const [a, b] = await Promise.all([
      asyncStorageRecipeRepository.create(minimalRecipeInput('Recipe A')),
      asyncStorageRecipeRepository.create(minimalRecipeInput('Recipe B')),
    ]);

    const all = await asyncStorageRecipeRepository.getAll();
    expect(all.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
    expect(all.map((r) => r.name).sort()).toEqual(['Recipe A', 'Recipe B']);
  });
});

function minimalRecipeInput(name: string) {
  return {
    name,
    description: '',
    baseSpirit: 'gin',
    category: [],
    tags: [],
    ingredients: [],
    method: 'stir' as const,
    steps: ['Stir.'],
    glass: ['rocks' as const],
    abv: null,
    difficulty: 'easy' as const,
    prepTimeMinutes: 3,
  };
}
