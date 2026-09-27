# Cellar — Local Data Migration & Recovery

How Cellar's on-device AsyncStorage data survives an app update, why a real
data-loss bug happened once, and the mechanism that now prevents it from
happening silently again.

## The storage model

Every persisted collection is one `JsonStore<T>` instance
(`src/data/storage/jsonStore.ts`) wrapping one AsyncStorage key — e.g.
`@bar/recipes`, `@bar/favorites`, `@community/accounts`, `@app/onboarding`.
Each store is constructed with:

```ts
new JsonStore<T>(key, isValidShape, fallback, recover?)
```

- `isValidShape` — a runtime type guard. `read()` parses the stored JSON and
  only returns it if this guard passes.
- `fallback` — what's returned if nothing is stored yet, or if the stored
  value fails validation and there's no `recover` (or `recover` also fails).
- `recover` (optional, added this sprint) — a migration function, tried
  only when `isValidShape` rejects the stored value. If it returns a value
  that itself passes `isValidShape`, that value is persisted back
  (self-healing) and returned; otherwise the store falls back exactly as it
  always did.

This is a **per-key, shape-based migration model**, not a single global
`storageVersion: N` counter. That was a deliberate choice, not an oversight
— see "Why not a global version number" below.

## The bug this mechanism was built to fix

A prior sprint added a required `email: string` field to the local auth
backend's `AccountRecord` shape (to support real email/password auth).
`isAccountArray`, the validator for `@community/accounts`, was updated to
require that field — correctly rejecting the new invalid shape, but with no
way to accept the *old*, pre-existing shape (`{profile, passwordHash, salt}`,
no email) that every already-signed-up user's device still had on disk.

`JsonStore.read()`'s old behavior was a strict binary: valid shape, or the
empty-array fallback. So on the next read, every existing user's entire
`@community/accounts` collection silently became `[]`. Their `@community/session`
key was untouched and still pointed at their `userId`, but `getProfile()`
could no longer find it, so `useAuthStore.load()` set `profile: null`. Every
piece of app code that asks "who's signed in" (`currentOwnerId()` in
`src/state/authStore.ts`) fell back to the guest identity — and the *new*
ownership filters added in that same sprint (My Bar's `recipes.filter(r =>
r.ownerId === currentOwnerId())`, the cocktail-detail screen's
`isOwnRecipe` check) then hid every recipe that account had ever created.

**Nothing was deleted.** The recipes were still sitting in `@bar/recipes`,
correctly tagged with the real account id, completely intact. They were
orphaned by a validator with no upgrade path, then hidden by a filter that
had no idea the account "no longer existed."

## The fix: `recoverAccountArray`

`src/data/community/AuthBackend.ts` now passes a `recover` function to its
`accountsStore`. It walks the raw persisted array and, for each entry:

- If it already matches the legacy shape (`profile`, `passwordHash`, `salt`,
  no `email`), derives a stable placeholder email
  (`${username}@users.cellar.local`) and keeps every other field —
  including `profile.id`, which is what the still-valid session and every
  owned recipe/favorite/inventory/journal/shopping-list entry key off of.
  This makes a signed-in user whole again with zero action on their part.
- If an entry doesn't match even the *legacy* shape — genuinely
  unrecognizable data — it's left out of the recovered array rather than
  fabricated. `recover` returns `undefined` in that case, and the store
  falls back to its old safe-empty behavior for that key, exactly as
  before this mechanism existed.

Proven by `src/data/community/__tests__/accountMigration.test.ts`, which
writes legacy-shaped data directly into `@community/accounts`,
`@community/session`, and `@bar/recipes` (simulating a pre-update device),
then runs the real `useAuthStore.load()` boot path and asserts the account,
session, and recipe-ownership filter all resolve correctly — the exact
user-visible symptom, not just the storage layer in isolation.

`src/data/storage/__tests__/jsonStore.test.ts` covers the general mechanism
with a synthetic example (recovery succeeds, persists/self-heals, falls
back safely when recovery itself can't make sense of the data, is never
invoked when the stored shape is already current, and stores that don't
pass a `recover` function behave exactly as they did before this existed).

## Which stores have a `recover` function today

| Key | Store | `recover`? |
|---|---|---|
| `@community/accounts` | local auth backend | ✅ `recoverAccountArray` |
| `@bar/recipes`, `@bar/favorites`, `@bar/inventory`, `@bar/journal`, `@bar/shoppingList`, `@bar/settings`, `@bar/locale`, `@app/onboarding`, `@community/session`, `@community/reports`, `@community/blocks`, `@community/likes`, `@community/follows`, `@purchases/devEntitlement` | repositories, settings/locale/onboarding stores, moderation, community, dev purchases | not yet needed — no shape change has ever required one |

Adding a `recover` function to any of these is cheap and additive (a 4th
constructor argument with a safe default of "none"); do it the moment a
future change would otherwise make `isValidShape` reject real, existing
user data — not preemptively for shapes that have never changed.

## Why not a global `storageVersion: N`

A single app-wide version number implies every store moves in lockstep
through the same sequence of migrations, which isn't how this app's storage
actually evolves — `@bar/recipes` and `@community/accounts` change shape on
entirely independent timelines. The per-key `recover` function is more
precise: each store only ever needs to know how to accept *its own*
previous shape, not maintain a shared migration ledger for keys it doesn't
own.

The real limitation of the current design: `recover` handles exactly one
step (old shape → current shape), not an arbitrary chain (v1 → v2 → v3). If
a store's shape needs to change a second time before every device has
upgraded past the first change, `recover` would need to internally detect
and branch between multiple legacy shapes — still possible with this
mechanism (the function receives the raw `unknown` value and can inspect it
however it needs to), just not automatic. If that ever becomes unwieldy for
a specific key, a numbered-version envelope for that one key is the right
scope for the change — not a rewrite of every store.

## The non-negotiable rule this mechanism exists to enforce

**Never solve a stricter validator by resetting the collection.**
`AsyncStorage.clear()`, or any per-key equivalent (`store.write(fallback)`
called unconditionally on a validation failure), silently discards real
user data and must never be used as a migration shortcut. If a shape
change is intentional, write a `recover` function. If recovery is
genuinely impossible for a given malformed entry, that entry is dropped
individually and the rest of the collection is preserved — never the whole
collection reset because one entry didn't parse.

## Onboarding's storage is deliberately NOT account-scoped

`@app/onboarding` (`src/state/onboardingStore.ts`) is a device-level flag,
not part of `src/state/accountScope.ts`'s reload/clear cycle on sign-in,
sign-out, or account switch. Onboarding is about whether *this device* has
seen the intro, not who's currently signed in — reload/clearing it on
every account switch would show the intro again to a returning user on a
shared or reused device, which is not the intended behavior.

## Recipe ids vs. the Supabase `recipes.id` uuid column (Sept 2026)

Found in the release-hardening sprint: personal recipes were created with
`generateId('recipe')` (`recipe-<time>-<random>`), but `public.recipes.id`
is `uuid`. Every publish from the app was rejected by Postgres
(`22P02 invalid input syntax for type uuid`) — reproduced against the real
migrations in `supabase/tests/rls-pglite`. Unit tests mocked the backend, so
this never surfaced.

The fix is deliberately **non-destructive**:

- New recipes get a real v4 UUID (`src/data/newUuid.ts`).
- Existing recipes keep their local `recipe-…` id on device. Nothing is
  rewritten, so favorites / journal entries / shopping-list references to
  those ids stay valid.
- When a legacy recipe is published, `remoteRecipeId()` (`src/domain/uuid.ts`)
  derives a deterministic RFC 4122 v5 UUID from its local id under a fixed
  Cellar namespace. The same local recipe always maps to the same remote
  row (publish → edit → republish → unpublish), and to the same Storage
  prefix `<owner>/<remoteId>/…`.
- `matchesRecipeId()` lets screens reached from Discover (which carry the
  remote id) resolve back to the local record, so the author still edits the
  real local recipe. **Never change `CELLAR_RECIPE_NAMESPACE`** — it would
  re-key every already-published legacy recipe.

Upgrade test: `src/state/__tests__/productionHardening.test.ts`
("UPGRADE: a legacy recipe-… recipe stays intact…").

## Cached profile for offline cold starts

`@auth/lastProfile` holds the last successfully resolved profile for the
signed-in session. It is only applied when its id equals the restored
session's user id, and is removed on log-out, account deletion and
backend-ended sessions. Without it, an offline cold start treated a
signed-in user as a guest (their account-scoped data "disappeared" and new
recipes were stamped guest-owned).

## Guest and legacy device-only data after sign-in (adoption)

Every personal store is scoped by `ownerId`. Two kinds of on-device data are
invisible to a signed-in account: guest data (`LOCAL_GUEST_OWNER_ID`) and data
from the pre-Supabase device-only account system (non-uuid `user-…` ids, which
no Supabase session can ever match). `src/state/localDataAdoption.ts` finds
both, and `LocalDataAdoptionPrompt` (mounted in `app/_layout.tsx`) asks once
after any sign-in whether to add it to the account:

- **Add to my account** → recipes, favorites, My Bar, journal and shopping
  list move to the account, merged without duplicates. Adopted recipes become
  **private** (nothing is silently published).
- **Not now** → nothing moves; the data stays guest-owned and visible when
  signed out. The decision is remembered for that exact data; new guest data
  is offered again later.
- Data owned by another real (uuid) account on the device is never offered.

Tests: `src/state/__tests__/localDataAdoption.test.ts`.

## Pending publish state

`PersonalRecipe.pendingSync` ('publish' | 'unpublish') records a backend sync
that failed (offline, server error). It is persisted, retried automatically on
sign-in, foreground and reconnect (`BackgroundSync`), and cleared once the
backend confirms. A recipe is never deleted locally while a public copy might
still exist remotely.
