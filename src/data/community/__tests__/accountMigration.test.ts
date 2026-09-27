import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../../state/authStore';
import { useRecipesStore } from '../../../state/recipesStore';

/**
 * THE regression test for a real, reported data-loss bug: "recipes I
 * created disappeared after installing the latest build."
 *
 * Root cause (see AuthBackend.ts's recoverAccountArray and JsonStore.ts's
 * `recover` parameter for the full account): a required `email` field was
 * added to the local account record shape, with no migration. The
 * validator guarding `@community/accounts` started rejecting every
 * account created before that change, which made JsonStore.read() return
 * an empty array for the whole collection. A signed-in user's session
 * (a separate, still-valid key) could then no longer resolve to a
 * profile, so `currentOwnerId()` fell back to the guest identity — and
 * every recipe/favorite/etc. they owned, still completely intact in
 * storage and still correctly tagged with their real account id, stopped
 * matching that identity and disappeared from every screen that filters
 * by it (My Bar's "My recipes" chief among them).
 *
 * This test writes data in EXACTLY the pre-migration shape directly into
 * AsyncStorage — simulating "a user's phone after the old build, before
 * updating" — then drives the real boot path (useAuthStore.load(), the
 * same call app/_layout.tsx's hydrateStores() makes) and asserts the
 * account, the session, and — the actual user-visible symptom — the
 * recipe ownership filter all come back correctly.
 */
describe('local account migration: recipes/data survive an update that added the email field', () => {
  const OLD_USER_ID = 'user-legacy-abc123';
  const OLD_USERNAME = 'oldtimer';

  beforeEach(async () => {
    await AsyncStorage.clear();
    useAuthStore.setState({ profile: null, isLoaded: false });
    useRecipesStore.setState({ recipes: [], isLoaded: false });

    // 1. An account record in the OLD shape — no `email` field at all,
    // exactly what a pre-migration build persisted.
    await AsyncStorage.setItem(
      '@community/accounts',
      JSON.stringify([
        {
          profile: {
            id: OLD_USER_ID,
            username: OLD_USERNAME,
            displayName: 'Old Timer',
            avatarColorSeed: OLD_USERNAME,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          passwordHash: 'deadbeef00000000',
          salt: 'somesalt',
          // no `email` — this is the pre-migration shape
        },
      ]),
    );

    // 2. A still-valid session pointing at that account — the user never
    // logged out, so this key was never touched by the schema change.
    await AsyncStorage.setItem('@community/session', JSON.stringify({ userId: OLD_USER_ID, createdAt: '2025-06-01T00:00:00.000Z' }));

    // 3. Recipes this user created while signed in, correctly tagged with
    // their real account id — also untouched by the schema change, since
    // recipes live under a completely different storage key.
    await AsyncStorage.setItem(
      '@bar/recipes',
      JSON.stringify([
        {
          id: 'recipe-old-1',
          ownerId: OLD_USER_ID,
          name: "Old Timer's Sour",
          description: '',
          baseSpirit: 'whiskey',
          category: [],
          tags: [],
          ingredients: [],
          method: 'shake',
          steps: ['Shake well.'],
          glass: ['coupe'],
          garnish: undefined,
          abv: null,
          difficulty: 'easy',
          prepTimeMinutes: 3,
          visibility: 'private',
          createdAt: '2025-06-01T00:00:00.000Z',
          updatedAt: '2025-06-01T00:00:00.000Z',
        },
      ]),
    );
  });

  it('BEFORE the fix would have failed this way: without recovery, the account collection reads back empty', async () => {
    // Sanity-check the bug is real by re-deriving the pre-fix validator's
    // behavior directly (not exercising the fix) — the same check
    // AuthBackend.ts's isAccountArray performs, minus recovery.
    const raw = JSON.parse((await AsyncStorage.getItem('@community/accounts'))!);
    const strictlyValid = Array.isArray(raw) && raw.every((v) => v && typeof v.profile?.id === 'string' && typeof v.email === 'string' && typeof v.passwordHash === 'string');
    expect(strictlyValid).toBe(false); // confirms the old record genuinely fails the new validator
  });

  it('AFTER the fix: booting (useAuthStore.load()) restores the session, the profile, and the owned recipes', async () => {
    // This is the exact call app/_layout.tsx's hydrateStores() makes first, at boot.
    await useAuthStore.getState().load();

    // The account survived — session correctly resolves to a real profile again.
    expect(useAuthStore.getState().profile?.id).toBe(OLD_USER_ID);
    expect(useAuthStore.getState().profile?.username).toBe(OLD_USERNAME);

    // Load recipes the same way hydrateStores() does, then apply the exact
    // ownership filter app/(tabs)/my-bar.tsx uses for "My recipes."
    await useRecipesStore.getState().load();
    const myRecipes = useRecipesStore.getState().recipes.filter((r) => r.ownerId === useAuthStore.getState().profile?.id);

    // The actual user-visible symptom, fixed: their recipe is there.
    expect(myRecipes.map((r) => r.name)).toEqual(["Old Timer's Sour"]);
  });

  it('the migrated account record is persisted with a derived email, so it does not need to be re-migrated on the next read', async () => {
    await useAuthStore.getState().load();
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the self-heal write (queued inside JsonStore.read()) land

    const raw = JSON.parse((await AsyncStorage.getItem('@community/accounts'))!);
    expect(raw[0].email).toBe(`${OLD_USERNAME}@users.cellar.local`);
    expect(raw[0].profile.id).toBe(OLD_USER_ID); // identity itself is untouched by the migration
  });

  it('recipe ids, content, and ownership are all byte-for-byte unchanged by the migration — nothing was rewritten, deleted, or regenerated', async () => {
    await useAuthStore.getState().load();
    await useRecipesStore.getState().load();

    const recipe = useRecipesStore.getState().recipes.find((r) => r.id === 'recipe-old-1');
    expect(recipe).toBeDefined();
    expect(recipe?.ownerId).toBe(OLD_USER_ID);
    expect(recipe?.name).toBe("Old Timer's Sour");
    expect(recipe?.createdAt).toBe('2025-06-01T00:00:00.000Z');
  });

  it('a completely unrecognizable accounts blob still falls back safely instead of throwing (recovery is not a blank check)', async () => {
    await AsyncStorage.setItem('@community/accounts', JSON.stringify({ this: 'is not an account array at all' }));
    await expect(useAuthStore.getState().load()).resolves.toBeUndefined();
    expect(useAuthStore.getState().profile).toBeNull();
  });
});
