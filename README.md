# Cellar

Cellar is a cocktail and home-bar app for iOS and Android. It is built with Expo, React Native, TypeScript and Supabase.
It combines a curated cocktail catalog with tools for the drinks you can make from what you already have. It also has an optional community layer where people publish and discover each other's recipes.

The app is **local-first**: browsing, search, "what can I make" matching, My Bar, favorites, the tasting journal, the shopping list and private recipes all work without an account or a network connection. An account (Supabase) is only needed for community features.

> **Status:** release candidate. The app code, database migrations and Edge Functions are complete and pass the local checks listed under [Testing](#testing). The external services (Apple, Google, RevenueCat, SMTP, store listings) still need dashboard configuration, and several flows still need testing on physical devices. See [Release status](#release-status). The app has not been published to the App Store or Google Play.

---

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Architecture](#architecture)
- [Authentication](#authentication)
- [Backend (Supabase)](#backend-supabase)
- [Security](#security)
- [Premium and subscriptions](#premium-and-subscriptions)
- [Media pipeline](#media-pipeline)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [iOS and Android](#ios-and-android)
- [Release status](#release-status)
- [Known limitations](#known-limitations)
- [Screenshots](#screenshots)
- [Documentation](#documentation)
- [License](#license)

---

## Features

**Catalog and discovery** (no account needed)
- A built-in catalog of **251 cocktails** and **176 ingredients**, including **17 homemade ingredients** (syrups, infusions) with their own recipes.
- Exact measurements with household approximations, unit preferences (ml / oz), serving scaling, and ingredient substitutions.
- Search plus filters by base spirit, taste, style, difficulty, preparation time and alcohol-free.
- Discovery dimensions (by spirit, taste and style), curated collections, related drinks, and ingredient detail pages.
- "What can I make?": exact matches from your bar, matches that rely on a substitute, and "almost there" drinks that are one ingredient away.

**Personal tools** (stored on the device, per account)
- **My Bar:** your ingredient inventory.
- **Favorites**, a **tasting journal** (rating and notes), and a **shopping list** generated from missing ingredients.
- **Personal recipes:** ingredients, method, glass, garnish, steps, prep time, ABV and a photo.

**Community** (requires an account)
- Publish a personal recipe publicly, and edit or unpublish it later.
- A **Discover** feed backed by Supabase, with keyset pagination, pull-to-refresh, and loading, empty and error states. A full "See all" feed has infinite scroll.
- **Creator profiles**, **likes**, **follows**, **blocking** and **reporting** (spam, inappropriate, harassment, copyright, other).
- Sharing catalog cocktails and published recipes (a text version plus a `cellar://` deep link).

**Accounts**
- Email/password with email confirmation, resend, forgot/reset password and change password.
- Sign in with Apple (iOS) and Google Sign-In (iOS and Android). The code is implemented; the buttons appear only when the provider is configured for the build.
- In-app account deletion. When deleting, the app asks whether to keep the device's local data as guest data.
- After signing in, the app offers once to move guest data (or data from the pre-Supabase device-only accounts) into the account.

**Other**
- A three-page onboarding that respects the Reduce Motion setting.
- A Premium tier through RevenueCat (see [Premium](#premium-and-subscriptions)).
- **English and Turkish** UI, catalog content and legal documents. The Turkish dictionary is type-checked against the English one, so no key can be missing.
- Light and dark mode.

---

## Technology stack

| Area | Technology |
|---|---|
| App | React Native 0.86, Expo SDK 57, TypeScript (strict), Expo Router (file-based routing) |
| State | Zustand stores |
| Local persistence | AsyncStorage through a small versioned `JsonStore` with validation and legacy-shape recovery |
| Backend | Supabase: Postgres, Row Level Security, Auth, Storage, Edge Functions (Deno) |
| Auth providers | Supabase Auth (email/password), `expo-apple-authentication`, `@react-native-google-signin/google-signin` |
| Billing | RevenueCat (`react-native-purchases`) over StoreKit / Google Play Billing |
| Media | `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`, `expo-image` |
| Crash reporting | Sentry (`@sentry/react-native`), active only when a DSN is configured |
| Testing | Jest (`jest-expo`), plus an embedded-Postgres (PGlite) harness for migrations and RLS |
| Build / release | EAS Build and EAS Submit (`eas.json` profiles: development, preview, production) |
| CI | GitHub Actions: typecheck, lint, Jest, database/RLS checks |

UI components are hand-built (`src/ui/components`); no UI kit is used.

---

## Architecture

```
app/ (Expo Router screens)
  │  read state, call store actions
  ▼
src/state (Zustand stores: auth, recipes, favorites, inventory, journal,
  │        shopping list, community, moderation, discover feed, entitlements)
  ▼
src/data (backend-agnostic interfaces + implementations)
  ├─ repositories/   local-first AsyncStorage repositories (per-owner scoping)
  ├─ community/      AuthBackend / CommunityBackend / ModerationBackend interfaces
  │                  + an on-device implementation used in development and tests
  ├─ supabase/       Supabase implementations of those interfaces, the remote
  │                  recipe backend and the media upload module
  └─ purchases/      PurchaseService interface: RevenueCat | dev stand-in | unavailable
src/domain (pure logic: matching, search, substitutions, scaling, UUIDs, …)
```

**Local-first data.** Favorites, inventory, journal, shopping list and personal recipes live in AsyncStorage. Every entry carries an `ownerId`: the signed-in account's id, or a guest id when signed out. Stores load only the current identity's data, so two accounts on one device never see each other's data. Signing out clears the in-memory state without deleting anything from storage.

**Backend selection.** `src/data/community/index.ts` picks the Supabase implementations when `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set. Otherwise it uses the on-device implementations, and only in development builds: a release build without Supabase configuration shows "accounts unavailable" rather than creating device-only accounts.

**Publishing.** Only recipes the user explicitly marks public are sent to Supabase; private recipes never leave the device. Publishing, editing and unpublishing go through `recipesStore`:
- If the backend call fails, the local recipe is kept and marked `pendingSync`.
- Pending changes are retried on sign-in, when the app returns to the foreground, and when connectivity returns (`BackgroundSync`).
- A published recipe is unpublished on the server *before* it is deleted locally, so a public copy can't be orphaned.

**IDs.** New recipes get v4 UUIDs, matching the `uuid` primary key in Postgres. Recipes created before that change keep their original local ids; when published they map to a deterministic UUID (RFC 4122 v5), so no stored data is rewritten. See [`DATA_MIGRATION.md`](DATA_MIGRATION.md).

**Discover feed.** `discoverFeedStore` reads public recipes with a composite `(created_at, id)` keyset cursor. It ignores stale responses when requests overlap and caches recipes by id, so recipe and creator screens can resolve other people's recipes.

**Session handling.**
- The Supabase session is persisted in AsyncStorage.
- Token auto-refresh runs only while the app is in the foreground (an `AppState` listener).
- A session ended by the backend (revoked or expired refresh token) signs the app out locally.
- The last resolved profile is cached, so an offline cold start keeps the user signed in.

---

## Authentication

| Flow | Implementation |
|---|---|
| Email/password sign-up | Supabase Auth, with password confirmation. An address that already has an account gets the same "check your email" answer as a new one (no account enumeration). The username and display name are stored in the user's metadata, and the profile row is created on first sign-in. Row Level Security prevents creating it while the email is still unconfirmed. |
| Email confirmation | The confirmation link opens `cellar://auth-callback`, which establishes the session. Unconfirmed sign-ins go to a "check your inbox / resend" screen. Auth emails use the bilingual templates in `supabase/templates/` (language from the account's saved app locale). |
| Password reset | Recovery link → `cellar://reset-password` → set a new password. The app switches to the account from the link. |
| Change password | Account & Security screen. Supabase's "reauthentication needed", weak-password and same-password errors get specific messages. |
| Sign in with Apple | Apple's own `AppleAuthenticationButton`, native Apple sheet with a SHA-256 nonce → `signInWithIdToken`. The button appears only when `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=true`. |
| Google Sign-In | Native Google SDK → ID token → `signInWithIdToken`. The button appears only when the Google client ids are configured. |
| Account deletion | `delete-account` Edge Function (see below). Accounts that use Apple re-confirm with Apple so the grant can be revoked. |
| Existing accounts | Duplicate email and username are detected. First-time social sign-in creates a profile with a collision-safe username. |
| Session restore | The stored session is restored on launch. If the network is slow or offline, the app starts within a few seconds with the stored identity and cached profile, and reconciles once the network returns. A session the server rejects (account deleted elsewhere, revoked refresh token) signs the device out. Sign-out ends only this device's session. |

**External setup is still required** before Apple and Google sign-in work: provider configuration in the Supabase dashboard, an Apple Developer capability and key, and Google Cloud OAuth clients. Email delivery also needs a custom SMTP provider in Supabase. These flows are implemented and covered by unit tests with mocked providers, but have **not** been verified end to end against the real providers. See [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md).

---

## Backend (Supabase)

**Migrations** (`supabase/migrations/`, nine files, applied in order):

| Area | What it defines |
|---|---|
| Tables | `profiles`, `recipes`, `likes`, `follows`, `blocks`, `reports`, `subscribers` |
| Integrity | Foreign keys with cascades. A deleted reporter's reports are kept anonymously (`SET NULL`). Unique constraints prevent duplicate likes, follows and open reports. Check constraints bound text and array sizes, validate the recipe method, glass and ingredient shape, and require media URLs to point at the owner's own `recipe-media` object. |
| Server-owned fields | Triggers set `created_at`/`updated_at` on the server (recipes, profiles, likes, follows, blocks, reports) and make a recipe's `id` and `owner_id` immutable, so a client can't reorder the Discover feed. |
| Blocking | `SECURITY DEFINER` helper functions, so the like and follow policies can see a block that the blocked user's own RLS view can't. Blocking someone also removes existing follows and likes between the two accounts. |
| Reports | A trigger forces new reports to `open`, rejects missing or self targets and limits each reporter to 20 reports per hour. |
| Aggregation | `recipe_like_counts(uuid[])` computes like counts in the database. |
| Storage | A public `recipe-media` bucket: 25 MB limit, image/video MIME allowlist, writes limited to exactly `<uid>/<recipeId>/photo|video`, and listing limited to the owner's own folder. |

**Row Level Security** is enabled on every table:
- Profiles and published recipes are publicly readable.
- Writes are allowed only for the owning `auth.uid()`.
- Block lists and reports are readable only by their owner.
- `subscribers` has no client write policy, so Premium state can only be written by the webhook using the service role.

**Edge Functions** (`supabase/functions/`):
- `delete-account` verifies the caller's JWT (users can only delete themselves). It then:
  - removes all of the user's Storage media (paginated);
  - optionally revokes Sign in with Apple using an ES256 client secret;
  - deletes the auth user, which cascades to the user's data;
  - asks RevenueCat to delete the customer record (best-effort).
  - If media cleanup fails, the account is **not** deleted and the app can retry; a retry after a successful deletion returns success.
- `revenuecat-webhook` authenticates RevenueCat with a shared secret compared in constant time. Each event is treated as a signal: the function re-reads the subscriber from the RevenueCat REST API and stores the current `premium` state in `public.subscribers` through an ordered, service-role-only upsert. This handles refunds, transfers, product changes, lifetime purchases and aliases correctly, ignores stale events, and returns an error (so RevenueCat retries) on any database or API failure. Sandbox events are ignored unless `ALLOW_SANDBOX_EVENTS=true`.
  - JWT verification is disabled in `supabase/config.toml` because RevenueCat does not send a Supabase JWT.

---

## Security

- **Server-side enforcement:** ownership, blocking and uniqueness are enforced by RLS and constraints, not only in the client. The client still validates input (length limits that mirror the database constraints, email and username formats).
- **Secrets:** only public values are used by the app: the Supabase URL and anon key, RevenueCat public SDK keys, the Google client ids and the Sentry DSN, all as `EXPO_PUBLIC_*`. The service-role key, the RevenueCat webhook secret, the RevenueCat secret API key and the Apple private key exist only as Edge Function secrets. `.env*` files, signing keys and store credentials are git-ignored.
- **Account isolation:** local stores are scoped by owner. Social caches (likes, follows, blocks) and Premium state are reset on every identity change. Unit tests cover cross-account leakage.
- **Premium can't be granted by the client:** a release build without billing configured can never grant Premium (see below), and the `subscribers` table rejects client writes (covered by the RLS checks).
- **Crash reporting:** Sentry events drop request bodies, headers and cookies, keep only an opaque user id, and redact context keys that look like credentials.
- **Verification:** the RLS and constraint logic is exercised by 112 adversarial checks, plus a drift check that `schema.sql` matches the migrations, against the real migrations in an embedded Postgres (`npm run test:rls`). This checks the SQL, not the hosted project. Earlier development sprints also ran checks against a hosted project ([`LAUNCH_READINESS.md`](LAUNCH_READINESS.md)); the two latest migrations have not yet been applied to or verified against a hosted project.

---

## Premium and subscriptions

Premium unlocks unlimited personal recipes (free tier: 12), recipe scaling, shopping lists and the tasting journal. The catalog, search, matching and favorites are always free.

`src/data/purchases/index.ts` selects one implementation of the `PurchaseService` interface:

| Build | Service | Behavior |
|---|---|---|
| RevenueCat key configured | `revenueCatPurchaseService` | Real purchases through StoreKit / Play Billing. Prices come from the store (localized). Includes restore, account identification (`Purchases.logIn` with the Supabase user id), store-pushed status updates, intro offers shown only when the user is eligible (with duration and the price after), "Manage subscription" via the store's management URL, and error mapping (cancelled, pending, network, not allowed, already owned, belongs to another account, store problem, paid but not yet activated). RevenueCat `test_` keys are ignored in release builds. |
| Development build, no key | `devPurchaseService` | A local test entitlement for exercising gated UI; labelled as a development build in the paywall. |
| Release build, no key | `unavailablePurchaseService` | The paywall shows "purchases unavailable". It can never grant Premium. |

When the store can't be reached, the last known status of the **same** account is kept instead of downgrading a paying user. Premium never carries over to a different account: if switching the RevenueCat identity fails, the new account is shown as free and purchases are refused until the switch succeeds. The RevenueCat webhook keeps a server-side mirror in `subscribers` for future server-side checks; the app itself reads entitlements from the RevenueCat SDK.

External setup (RevenueCat project, `premium` entitlement, store products, webhook secret) is listed in [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md). No real purchase has been made yet.

---

## Media pipeline

1. **Selection:** the system photo picker (PHPicker on iOS, the Android Photo Picker), with no library-wide permission prompt.
2. **Processing:** `expo-image-manipulator` scales the longest edge to 1600 px (never upscaling) and re-encodes as JPEG at quality 0.8, which also converts HEIC.
3. **Persistence:** the result is copied into the app's documents directory, because the picker returns a cache file the OS may purge. It is stored as a path relative to that directory (older absolute paths are re-resolved), so photos survive iOS container moves on update or restore. If processing fails, the photo is refused rather than storing the unprocessed original (which may contain location metadata).
4. **Upload on publish:** the photo is uploaded to `recipe-media/<ownerId>/<recipeId>/photo`. The public URL gets a `?v=` version so a replaced photo isn't served from cache. The uploaded URL is remembered, so an edit that doesn't change the photo isn't uploaded again.
5. **Cleanup:**
   - Removing the photo from a published recipe deletes the stored object.
   - Unpublishing or deleting a recipe removes its media folder.
   - Replaced or deleted local copies, and photos picked but abandoned in the editor, are removed from the device.
   - Account deletion removes all of the user's media.
6. **Display:** `expo-image` with a disk cache. A photo that fails to load falls back to the designed spirit-tone artwork.

Catalog photography is intentionally absent. Each of the 251 catalog cocktails has an entry in a licensing manifest (`status: missing`). A photo appears only once an entry is marked approved with source, license and attribution recorded. See [`MEDIA_PIPELINE.md`](MEDIA_PIPELINE.md).

---

## Testing

```bash
npm test              # Jest unit/integration tests
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint (ESLint)
npm run test:rls      # all migrations applied to PGlite + adversarial RLS/constraint checks
npm run verify        # tests + typecheck + lint
```

Most recent local run: **59 Jest suites / 622 tests passing**, TypeScript clean, lint clean (0 warnings), **112/112** RLS and constraint checks passing, `schema.sql` drift check clean, and `deno check` clean for the Edge Functions. `expo export` for iOS and Android also succeeds. CI runs the same checks on every push and pull request (`.github/workflows/ci.yml`).

The Jest suites cover:
- domain logic: matching, search, filters, substitutions, scaling, UUIDs;
- persistence and legacy-data recovery;
- account scoping and cross-account isolation;
- guest-to-account data migration;
- recipe publishing, including offline pending-sync;
- media upload, replace and delete;
- the Discover feed (pagination races);
- likes, follows and blocks;
- the purchase and entitlement logic;
- social sign-in state handling;
- account deletion;
- legal-document parity between English and Turkish.

External services (Supabase, Apple, Google, RevenueCat) are mocked in Jest.

---

## Project structure

```
app/                      Expo Router screens (tabs, cocktail/recipe detail, editor, auth, legal, …)
src/
  config/                 legal/business configuration read from env
  content/legal/          Privacy Policy, Terms, Community Guidelines (EN/TR)
  data/
    catalog/              cocktail + ingredient catalog, media licensing manifest
    community/            backend interfaces + on-device implementations (dev/tests)
    purchases/            PurchaseService: RevenueCat / dev / unavailable
    repositories/         AsyncStorage repositories (owner-scoped)
    storage/              JsonStore (validated, recoverable persistence)
    supabase/             Supabase client, auth, social, moderation, recipes, media upload
  domain/                 pure business logic (matching, search, scaling, uuid, …)
  i18n/                   typed EN/TR dictionaries and translation helpers
  lib/                    crash reporting
  state/                  Zustand stores and cross-store flows (account scope, adoption)
  theme/                  colors, typography, spacing
  ui/components/          hand-built UI components
supabase/
  migrations/             SQL migrations (source of truth for the schema)
  functions/              Edge Functions: delete-account, revenuecat-webhook
  tests/rls-pglite/       embedded-Postgres RLS/constraint test harness
  schema.sql              human-readable snapshot of the migrations
scripts/export-legal.ts   exports legal documents for web hosting
legal/generated/          exported legal documents (EN/TR)
```

---

## Getting started

Requirements: Node.js 22 and npm. Building native binaries requires Xcode or Android Studio, or EAS Build.

```bash
npm install
cp .env.example .env.local     # optional: fill in values (see below)
npx expo start                 # starts the dev server
```

With no environment variables set, the app runs fully on-device: catalog, My Bar, personal tools and a development-only local account backend.

Several features depend on native modules that Expo Go does not include: Sign in with Apple, Google Sign-In, RevenueCat and image manipulation. For those, use a development build:

```bash
npx expo run:ios               # or: npx expo run:android
# or with EAS:
eas build --profile development --platform ios
```

To use your own Supabase project, apply the schema with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
supabase functions deploy delete-account
supabase functions deploy revenuecat-webhook
```

---

## Environment variables

All client variables are `EXPO_PUBLIC_*` and are embedded in the app bundle, so **none of them may be secret**. `.env.local` is git-ignored. For EAS builds, set them as EAS environment variables; `eas.json` maps each build profile to an environment. [`.env.example`](.env.example) documents every variable.

| Group | Variables |
|---|---|
| Supabase | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Apple | `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED` |
| Google | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` |
| RevenueCat | `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` |
| Sentry | `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_APP_ENV`. Build-time only: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (secret) |
| Legal / support | `EXPO_PUBLIC_LEGAL_ENTITY_NAME`, `EXPO_PUBLIC_LEGAL_ENTITY_ADDRESS`, `EXPO_PUBLIC_LEGAL_JURISDICTION`, `EXPO_PUBLIC_LEGAL_DATA_REGION`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_LEGAL_REVIEWED`, `EXPO_PUBLIC_LEGAL_EFFECTIVE_DATE`, `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL`, `EXPO_PUBLIC_ACCOUNT_DELETION_URL` |

The server-side secrets are set with `supabase secrets set` and never in any env file:
- `REVENUECAT_WEBHOOK_AUTH_HEADER`, `REVENUECAT_SECRET_API_KEY` (and optionally `ALLOW_SANDBOX_EVENTS=true` on a staging project only)
- `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID`, `APPLE_PRIVATE_KEY`
- Supabase's own `SUPABASE_SERVICE_ROLE_KEY`

---

## iOS and Android

- Bundle id / package: `com.ecclesia.coctail`. URL scheme: `cellar`.
- iOS: iPhone only (`supportsTablet: false`). Photo library usage string only, with no camera or microphone permission. The Sign in with Apple entitlement is set.
- Android: adaptive icon. Camera, microphone, broad storage, media and overlay (`SYSTEM_ALERT_WINDOW`) permissions are explicitly blocked.
- Native projects are generated by Expo prebuild (continuous native generation). `ios/` and `android/` are not committed.
- `app.config.js` adds the Google Sign-In URL scheme and the Sentry build plugin only when their environment variables are present.
- EAS profiles:
  - `development`: dev client (`expo-dev-client`).
  - `preview`: internal distribution; APK on Android.
  - `production`: store distribution, AAB, auto-incremented build numbers, versions managed remotely.

No store build has been submitted yet.

---

## Release status

| Area | Implemented in code | Verified locally | Needs external configuration | Needs verification |
|---|---|---|---|---|
| Catalog, search, matching, personal tools | ✅ | ✅ unit tests | none | device QA |
| Local data scoping, migration, guest adoption | ✅ | ✅ unit tests | none | device upgrade test |
| Supabase schema, RLS, constraints | ✅ | ✅ PGlite (112 checks + drift) | apply the two latest migrations | hosted project |
| Email auth (confirm, reset, change password) | ✅ | ✅ unit tests (mocked) | custom SMTP, redirect URLs | real inbox + device |
| Sign in with Apple | ✅ | ✅ unit tests (mocked) | Apple Developer, Supabase provider, secrets | device |
| Google Sign-In | ✅ | ✅ unit tests (mocked) | Google Cloud OAuth clients, Supabase provider | device (iOS + Android) |
| Publishing, Discover, likes, follows, blocks, reports | ✅ | ✅ unit tests | none | hosted project + device |
| Photos (process, upload, replace, delete) | ✅ | ✅ unit tests | none | device |
| Premium (RevenueCat) | ✅ | ✅ unit tests (mocked SDK) | RevenueCat, App Store Connect, Play Console | sandbox purchases |
| Edge Functions | ✅ | ✅ Deno type-check | deploy + secrets (incl. `REVENUECAT_SECRET_API_KEY`) | hosted project |
| Legal documents (EN/TR) | ✅ drafts | ✅ parity tests | business details, legal review, hosting | lawyer review |
| Crash reporting (Sentry) | ✅ | n/a | Sentry DSN (optional) | production build |

The full checklist, including every dashboard step, is in [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md).

---

## Known limitations

These are accepted for 1.0 and documented in [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md):

- Private recipes, favorites, My Bar, the journal and the shopping list are device-local by design and do not sync across devices.
- A published recipe can only be edited on the device that created it.
- No profile photos (avatars are generated monograms).
- No per-user rate limiting on likes and follows beyond uniqueness constraints (reports are limited to 20 per hour).
- Reports are reviewed in the Supabase dashboard; there is no moderation back-office.
- Catalog photography is not yet sourced (licensing manifest in place).
- The iPad is not supported (it runs in iPhone compatibility mode).

---

## Screenshots

Screenshots will be added once the first TestFlight / internal-testing build is available.

| Home | Cocktail detail | My Bar | Discover | Recipe editor |
|---|---|---|---|---|
| _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |

---

## Documentation

- [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md): release steps, external configuration, device test plan and known limitations.
- [`DATA_MIGRATION.md`](DATA_MIGRATION.md): local data recovery, recipe id mapping, guest-data adoption and pending sync.
- [`MEDIA_PIPELINE.md`](MEDIA_PIPELINE.md): catalog photography licensing and the user media pipeline.
- [`LAUNCH_READINESS.md`](LAUNCH_READINESS.md): the historical engineering log of earlier audits and fixes.
- [`supabase/schema.sql`](supabase/schema.sql): a readable snapshot of the database schema.

---

## License

The `LICENSE` file currently in the repository is the MIT license inherited from the Expo project template, and its copyright line names Expo (650 Industries). It was not written for Cellar, and the author has not yet chosen a license for Cellar's own code. Until a Cellar-specific license is added, please contact the author before reusing the code.
