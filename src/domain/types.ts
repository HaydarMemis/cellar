export type Difficulty = 'easy' | 'medium' | 'hard';

export type PreparationMethod =
  | 'shake'
  | 'stir'
  | 'build'
  | 'blend'
  | 'muddle'
  | 'layer';

export type Unit =
  | 'ml'
  | 'cl'
  | 'oz'
  | 'dash'
  | 'tsp'
  | 'barspoon'
  | 'piece'
  | 'leaf'
  | 'rinse';

/**
 * Controlled vocabulary, like Difficulty/PreparationMethod — a cocktail's
 * glass is one or more of these ids (more than one for an "either/or" catalog
 * entry, e.g. Margarita's "rocks or coupe"). Labels live in i18n vocab, never
 * here, so this stays language-independent.
 */
export type GlassType =
  | 'rocks'
  | 'coupe'
  | 'martini'
  | 'collins'
  | 'highball'
  | 'copper-mug'
  | 'julep-cup'
  | 'hurricane'
  | 'flute'
  | 'wine-glass'
  | 'irish-coffee-glass'
  | 'pint-glass'
  | 'tiki-mug'
  | 'nick-and-nora'
  | 'snifter'
  | 'shot'
  | 'mug'
  | 'other';

/** A personal recipe is either kept on-device only, or published to Discover. */
export type Visibility = 'private' | 'public';

export type IngredientCategory =
  | 'spirit'
  | 'liqueur'
  | 'vermouth'
  | 'wine'
  | 'mixer'
  | 'juice'
  | 'produce'
  | 'sweetener'
  | 'syrup'
  | 'bitters'
  | 'garnish'
  | 'other';

/** Presentation-agnostic flavor tags for the ingredient encyclopedia — labels live in i18n vocab, never here. */
export type FlavorNote =
  | 'sweet'
  | 'sour'
  | 'bitter'
  | 'herbal'
  | 'spicy'
  | 'smoky'
  | 'fruity'
  | 'floral'
  | 'nutty'
  | 'rich'
  | 'citrus'
  | 'earthy';

/**
 * A real, usable DIY recipe for a homemade ingredient (e.g. simple syrup).
 * Deliberately reuses RecipeIngredient[]/steps[] — the exact shape a
 * Cocktail already uses — so the ingredient encyclopedia can render it with
 * the same components instead of inventing a parallel data shape.
 */
export interface HomemadeRecipe {
  yield: Amount;
  ingredients: RecipeIngredient[];
  /** English source; Turkish overlay lives in i18n (see ingredientContent.ts), same pattern as cocktail catalog overlays. */
  steps: string[];
  storageNote: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  isAlcoholic: boolean;
  flavorProfile?: FlavorNote[];
  /** English source; Turkish overlay lives in i18n. Optional so existing entries don't need a value on day one. */
  description?: string;
  isHomemade?: boolean;
  homemadeRecipe?: HomemadeRecipe;
}

export interface Amount {
  value: number;
  unit: Unit;
}

export interface RecipeIngredient {
  ingredientId: string;
  /** null for instructions like "top with soda" or "rinse the glass" */
  amount: Amount | null;
  note?: string;
  isOptional: boolean;
  isGarnish: boolean;
}

export interface Cocktail {
  id: string;
  name: string;
  description: string;
  baseSpirit: string;
  category: string[];
  tags: string[];
  ingredients: RecipeIngredient[];
  method: PreparationMethod;
  steps: string[];
  glass: GlassType[];
  garnish?: string;
  abv: { approx: number } | null;
  difficulty: Difficulty;
  prepTimeMinutes: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  similarCocktailIds: string[];
}

export interface PersonalRecipe {
  id: string;
  name: string;
  description: string;
  baseSpirit: string;
  category: string[];
  tags: string[];
  ingredients: RecipeIngredient[];
  method: PreparationMethod;
  steps: string[];
  glass: GlassType[];
  garnish?: string;
  abv: { approx: number } | null;
  difficulty: Difficulty;
  prepTimeMinutes: number;
  /** A registered account id, or LOCAL_GUEST_OWNER_ID for recipes created without signing in. */
  ownerId: string;
  visibility: Visibility;
  /**
   * Set when mirroring this recipe's public state to the backend failed
   * (offline, server error): 'publish' = should be public remotely but isn't
   * yet; 'unpublish' = was made private/deleted locally but may still be
   * public remotely. Retried automatically (recipesStore.retryPendingSync);
   * cleared once the backend confirms. Never set for guest recipes.
   */
  pendingSync?: 'publish' | 'unpublish';
  /**
   * The public URL the current local photo was last uploaded to, so an edit
   * that doesn't change the photo doesn't upload it again. Only valid while
   * `photoUri === publishedPhoto.localUri`.
   */
  publishedPhoto?: { localUri: string; url: string };
  /**
   * Server-confirmed publication state:
   * - an ISO timestamp: the backend confirmed the last publish (it exists remotely);
   * - null: known NOT to exist remotely (never published, or unpublish confirmed);
   * - undefined: unknown (recipes stored before this field existed) — see
   *   isPossiblyOnServer() in recipesStore for how that is inferred.
   */
  publishedAt?: string | null;
  /**
   * Set when the backend REJECTED a publish/unpublish for a reason retrying
   * can't fix (constraint violation, unsupported/missing photo, permission).
   * Such a recipe is NOT pendingSync — it isn't retried automatically — and
   * stays saved locally; saving it again re-attempts. `reason` is a
   * SyncErrorReason code (src/data/syncErrors.ts), translated by the UI.
   */
  syncError?: { op: 'publish' | 'unpublish'; reason: string; field?: string; at: string };
  /**
   * The recipe's photo. A photo this app stored itself is kept as a
   * container-relative reference (`recipe-photos/<file>.jpg`); older recipes
   * may hold an absolute file:// URI from a previous app container. Always
   * go through resolveLocalPhotoUri() (src/data/localMedia.ts) before
   * rendering, reading or deleting it. Published recipes from the backend
   * hold an https URL.
   */
  photoUri?: string;
  /**
   * A short looping video for the recipe (Discover feed cards render this
   * instead of the static photo when present). No upload flow produces this
   * yet — it exists so Discover's media architecture already branches
   * correctly the moment one does, rather than needing a data-model change
   * later. Always undefined today; never fabricate a value here.
   */
  videoUri?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type FavoriteTargetType = 'cocktail' | 'recipe';

export interface FavoriteEntry {
  id: string;
  targetType: FavoriteTargetType;
  targetId: string;
  /** LOCAL_GUEST_OWNER_ID when favorited without signing in — same convention as PersonalRecipe.ownerId, so this device's data is isolated per signed-in account (see src/state/accountScope.ts). Optional only for backward compatibility with entries persisted before this field existed; missing means LOCAL_GUEST_OWNER_ID. */
  ownerId?: string;
  createdAt: string;
}

export interface IngredientInventoryEntry {
  ingredientId: string;
  /** See FavoriteEntry.ownerId — same account-isolation convention, same backward-compatibility rule (missing = LOCAL_GUEST_OWNER_ID). */
  ownerId?: string;
  addedAt: string;
}

/**
 * A persisted line item on the user's shopping list — distinct from
 * `ShoppingListItem` in src/domain/shoppingList.ts, which is a
 * *derived/computed* "what does this recipe still need" projection with no
 * identity of its own. This is the actual stored entity: one row per
 * ingredient the user has added, independent of which recipe(s) it came
 * from, so it survives across app restarts and can be checked off.
 */
export interface ShoppingListEntry {
  id: string;
  ingredientId: string;
  completed: boolean;
  /** See FavoriteEntry.ownerId — same account-isolation convention, same backward-compatibility rule (missing = LOCAL_GUEST_OWNER_ID). */
  ownerId?: string;
  addedAt: string;
}

/** Union used anywhere both catalog and personal items are displayed together. */
export type DrinkSource =
  | { kind: 'cocktail'; item: Cocktail }
  | { kind: 'recipe'; item: PersonalRecipe };

export function drinkId(source: DrinkSource): string {
  return source.item.id;
}

export function drinkName(source: DrinkSource): string {
  return source.item.name;
}

/**
 * Owner id used for personal recipes created without a signed-in account —
 * kept as the exact string already persisted by every pre-Phase-6 install,
 * so widening `ownerId` from a literal to `string` needs no data migration.
 */
export const LOCAL_GUEST_OWNER_ID = 'local-user';

// ---------------------------------------------------------------------------
// Accounts & profiles
//
// This app remains fully usable offline with zero account (personal recipes,
// favorites, inventory, journal). An account is only required to publish a
// recipe to Discover or to follow another creator. There is no live remote
// backend in this build — accounts, sessions, likes and follows are real,
// working, on-device data behind the same interface a hosted backend would
// implement later (see src/data/community). Because there is no server, the
// only creators that can ever appear are accounts created on this device.
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarColorSeed: string;
  /**
   * Optional profile photo: the public, cache-busted (`?v=<ms>`) URL of the
   * user's own `avatars/<id>/avatar` Storage object (see
   * src/data/supabase/avatarUpload.ts). Absent = the monogram avatar.
   */
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Community (publishing, likes, follows) — see src/data/community for the
// backend interface these are read/written through.
// ---------------------------------------------------------------------------

export interface LikeEntry {
  id: string;
  userId: string;
  recipeId: string;
  createdAt: string;
}

export interface FollowEntry {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Tasting journal — a Premium feature; see src/domain/entitlements.ts.
// ---------------------------------------------------------------------------

export interface JournalEntry {
  id: string;
  drinkKind: 'cocktail' | 'recipe';
  drinkId: string;
  /** Denormalized so a journal entry still reads sensibly if the source recipe is later deleted. */
  drinkName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  note?: string;
  /** See FavoriteEntry.ownerId — same account-isolation convention, same backward-compatibility rule (missing = LOCAL_GUEST_OWNER_ID). */
  ownerId?: string;
  madeAt: string;
  createdAt: string;
}
