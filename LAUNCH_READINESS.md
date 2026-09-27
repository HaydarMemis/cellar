# Cellar — Launch Readiness Report

Generated from a direct, ongoing audit of this codebase across multiple
work sessions. Status glyphs: ✅ done & verified · ⚠️ implemented but needs
external setup, credentials, or human/legal action · ❌ not started ·
🔍 unverified (implemented, but not exercised on real hardware / a real
account / a real payment).

This document does not claim anything is "store ready" that isn't. Where
something needs an Apple/Google/Supabase/RevenueCat credential this
environment doesn't have, or legal review, or a physical device, it is
marked as such below and nowhere claimed as finished.

---

## -3. Onboarding, Profile, Legal, Data Recovery, Keyboard & Media sprint (most recent session) — see chat for the full A–L report

- **Found and fixed the real, root-cause data-loss bug** behind
  "recipes disappearing after updating the app": a validator made stricter
  by the prior sprint (the `email` field added to `AccountRecord`) had no
  upgrade path for existing on-device data, silently emptying
  `@community/accounts` on read, orphaning valid sessions, and causing the
  *new* ownership filters from that same prior sprint to hide (not delete)
  every affected user's recipes. Fixed generally, not with a one-off patch:
  `JsonStore` gained an optional `recover` migration parameter; wired via
  `recoverAccountArray`, which migrates the legacy account shape by
  deriving a placeholder email, or safely refuses to fabricate data for
  entries it doesn't recognize. Proven by
  `src/data/community/__tests__/accountMigration.test.ts`, which simulates
  a real pre-update device and asserts the recipes become visible again
  through the real boot path — not just the storage layer in isolation.
  Full mechanism documented in `DATA_MIGRATION.md`.
- **Built a real first-launch onboarding flow** (`app/onboarding.tsx`,
  `src/state/onboardingStore.ts`) — 3 pages, native paging + dot indicator,
  reduced-motion-aware, device-scoped completion flag defaulting to
  "not completed" (the safe direction). Never gates the app: both "Start
  exploring" and "Sign in" lead straight into the real signed-out
  experience. Verified live in the iOS Simulator on a genuine fresh
  install (uninstalled + reinstalled via `expo run:ios`, confirmed
  `RCTAsyncLocalStorage_V1` was empty beforehand): page 1 renders with the
  correct copy, completing via "Sign in" persists `{"completed":true}` to
  AsyncStorage, and a full app relaunch after that goes straight to Home
  with no onboarding shown again.
- **Reorganized the Profile screen's information architecture**: My
  Cellar now includes a real Shopping List entry (previously absent);
  added a dedicated **Account & Security** screen (`app/account-security.tsx`
  — email display via a new `AuthBackend.getCurrentUserEmail()`, change
  password, sign out); added **Edit Profile** (`app/edit-profile.tsx`,
  reachable from the profile header's self-view) using the
  already-existing but previously-unused `authStore.updateProfile`; moved
  Delete Account out of the Privacy section into its own weighted
  **Danger Zone** section (full-width red row, not a small text link);
  added a **Blocked Users** screen (`app/blocked-users.tsx`) listing and
  unblocking currently-blocked accounts.
- **Built real, substantive legal content** grounded in an actual
  code/data audit — Privacy Policy, Terms of Service, and a new Community
  Guidelines document (`src/content/legal/*.ts`), rendered by real in-app
  screens (`app/legal/privacy.tsx`, `terms.tsx`, `community-guidelines.tsx`)
  via a shared `LegalDocument` component — no new markdown-rendering
  dependency. Wired real tappable links from Profile (replacing
  previously-dead `Text` labels that went nowhere). Every genuinely
  unknown business/legal detail (legal entity name, jurisdiction, support
  email) reads as an explicit `[not yet configured]` placeholder sourced
  from `src/config/legal.ts` env vars — never fabricated. Clearly marked
  in-app as a draft pending legal review.
- **Keyboard-avoidance audit across every `TextInput`-bearing screen**:
  added `KeyboardAvoidingView` to `auth.tsx`, `recipe-editor.tsx`,
  `delete-account.tsx`, `forgot-password.tsx` and `reset-password.tsx`
  (the latter two previously had no scroll or keyboard-avoidance at all —
  a real risk on smaller devices), plus the `JournalLogModal` and
  `ReportModal` bottom sheets; added `keyboardDismissMode="on-drag"` +
  `keyboardShouldPersistTaps="handled"` to the Search tab's result lists
  and the ingredient picker. Scoped per screen, not one global hack.
  🔍 The on-screen software keyboard did not reliably appear in this
  session's Simulator (a hardware-keyboard-passthrough environment quirk,
  not an app bug), so the keyboard-avoidance fix itself could not be
  visually confirmed live this session — it follows the exact
  `KeyboardAvoidingView`/`behavior: 'padding'` pattern already working
  elsewhere in this codebase, but flagging this honestly rather than
  claiming a visual check that didn't actually happen.
- **Documented the built-in cocktail photography gap explicitly** rather
  than leaving it silently unsolved: `src/domain/mediaManifest.ts` +
  `src/data/catalog/mediaManifest.ts` define the real data structure every
  cocktail's photo will need (source/license/attribution/status), derived
  automatically from the live catalog, currently 100% honest
  `status: 'missing'` for all 251 cocktails — **MEDIA DATASET REQUIRED**,
  stated plainly. Not wired into any rendering code (zero behavior
  change to the existing, working abstract-visual-identity treatment).
  Re-verified the existing user-generated recipe media pipeline
  (`mediaUpload.ts`/the `recipe-media` bucket) is unchanged and still
  correct. Full detail in `MEDIA_PIPELINE.md`.
- Added `AuthBackend.getCurrentUserEmail()` (both local and Supabase
  implementations) — the one new backend method this sprint needed, for
  Account & Security to show a user their own sign-in email (never
  exposed on the public profile, by design).
- `DATA_MIGRATION.md` (new) and `MEDIA_PIPELINE.md` (new) document the
  migration mechanism and both media pipelines respectively, for anyone
  picking this up later.
- Test suite: 352 passing / 35 suites at this sprint's start → **385
  passing, 38 suites**, zero weakened or deleted. New coverage this
  sprint: `jsonStore.test.ts`'s `recover` block, `accountMigration.test.ts`
  (5 tests), `onboardingStore.test.ts` (6 tests), an `AuthBackend`
  `getCurrentUserEmail` test, `mediaManifest.test.ts` (6 tests), and the
  `newNamespaces.test.ts` i18n-parity check extended to 5 new locale
  namespaces (`onboarding`, `legal`, `blockedUsers`, `editProfile`,
  `accountSecurity`). `tsc --noEmit`, `expo lint`, and both iOS/Android
  `expo export` all clean, re-verified after every meaningful change.
- **Not done this sprint** (see the final A–L report in-conversation for
  the complete, honest breakdown): full `returnKeyType`/`onSubmitEditing`
  Next-field-chaining across multi-field forms (auth, recipe editor) —
  the higher-impact "keyboard never covers a control" fix was prioritized
  over this lower-risk refinement; a formal Build-A/Build-B upgrade QA
  script as a standalone document; a dedicated security/performance
  re-audit pass beyond what this sprint's own changes required; real-device
  verification (categorically impossible from this environment, as in
  every prior session).

---

## -2. Real authentication & first-launch lifecycle sprint (prior session) — see chat for the full A–L report

Focus: making the actual authentication lifecycle (not the app's overall
gating — Cellar's local-first "browse without an account" architecture
was deliberately preserved, per this sprint's own instruction to keep the
existing architecture where reasonable) genuinely production-real. Full
detail in-conversation; headline results:

- **Auth switched from username+placeholder-email to real email/password.**
  Every account previously authenticated against a derived
  `${username}@users.cellar.app` address nobody could receive mail at —
  meaning email verification and password reset were structurally
  impossible to build honestly. Sign-up now collects a real email;
  sign-in uses email (not username) to match how Supabase Auth actually
  authenticates. Username remains the public handle, stored only in
  `profiles`, never used as the auth credential.
- **Built real email verification and password reset end-to-end**: a
  `SignUpOutcome` third state (`'pending-confirmation'`) detected directly
  from Supabase's actual response (never assumed from a dashboard
  setting this code can't see), a resend-confirmation flow, and a full
  password-reset flow — `app/forgot-password.tsx` (anti-enumeration:
  always the same "check your email" outcome) and `app/reset-password.tsx`
  (a real deep-link handler for `cellar://reset-password`, parsing
  Supabase's recovery tokens with `expo-auth-session`'s `QueryParams`,
  establishing a session via `setSession`, with an 8-second fallback so
  the screen can never trap the user on a "checking" state forever).
- **Comprehensive Supabase Auth error mapping** (`mapAuthError` in
  `SupabaseAuthBackend.ts`) — invalid credentials, email already
  registered, weak password, email not confirmed, rate limited, network
  error — every one localized in TR/EN, never a raw `AuthApiError` string
  shown to a user.
- **Made first-login profile creation genuinely idempotent** (upsert with
  `onConflict: 'id'`, not a bare insert) and added a defensive fallback
  profile-creation path in `logIn` for the edge case of an authenticated
  user with no profile row yet.
- **Found and fixed a real, serious data-isolation bug** matching this
  sprint's own explicit warning ("Cellar contains local-first data — audit
  local stores for account-scoping problems"): favorites, ingredient
  inventory, the tasting journal, and the shopping list were a single
  global blob per device, not scoped per signed-in account at all — User
  B, signing in after User A signed out on the same phone, saw User A's
  favorites, inventory, tasting notes, and shopping list. Fixed by
  extending the `ownerId`/`LOCAL_GUEST_OWNER_ID` convention (which
  `PersonalRecipe` already had) to all four stores, with account-deletion
  reassignment (data survives, no longer attributed to a deleted account)
  mirroring the existing recipes behavior. 6 dedicated regression tests
  exercise this end-to-end through real store actions, not just the
  repository layer.
- **Found and fixed a second real bug the same audit surfaced**: My Bar's
  "My recipes" tab, and the cocktail detail screen's Edit/Delete buttons,
  showed/allowed acting on *any* locally-stored recipe regardless of
  owner — so switching accounts could expose another account's private
  recipes, or even let you edit/delete them. Fixed at both the UI layer
  (ownership-gated buttons) and the repository layer (`RecipeRepository
  .update`/`remove` now verify ownership before writing — defense in
  depth, not just UI hiding, per this sprint's own "the backend remains
  authoritative" instruction).
- Session restore, sign-up, sign-in, and log-out all now correctly
  reload/clear the four account-scoped stores at the right moments (see
  `src/state/accountScope.ts`), including on a cold-start session restore
  — not just on an explicit sign-in action.
- RevenueCat/Google/Apple sign-in flows, error-code plumbing, and the
  existing offline-first local dev backend all continue to work exactly
  as before — verified via 6 live Simulator renders (auth, forgot-
  password, reset-password's timeout-fallback state, My Bar, cold boot,
  home) with no crashes.
- Test suite: 340 → **352 passing**, 35 suites, zero weakened or deleted.
  `tsc`, `expo lint`, and both iOS/Android `expo export` all clean
  throughout, re-verified after every meaningful change, not just once at
  the end.
- New external setup this adds to the blocker table: `cellar://reset-password`
  and `cellar://` must be added to Supabase's Auth -> Redirect URLs
  allow-list for password reset/email confirmation to actually deliver
  once a live project exists (see `.env.example`).

---

## -1. Production backend hardening sprint (prior session) — see chat for the full A–J report

Scope: Apple Developer enrollment is blocked, so this session worked
entirely on backend correctness, security, and data integrity —
everything reachable without external credentials. Summary (full detail
in-conversation):

- **Migrated the schema to `supabase/migrations/*.sql`** (source of
  truth; `supabase/schema.sql` is now a generated snapshot) — 6 migrations:
  the original baseline, recipe validation + a database-enforced
  `visibility = 'public'` invariant, block-aware RLS on likes/follows,
  report retention + duplicate-report throttling, the `recipe-media`
  storage bucket + RLS, and a server-side `subscribers` entitlement table.
- **Closed a real RLS gap**: blocking was purely client-side filtering —
  nothing stopped a blocked user from still liking/following the blocker
  via a direct API call. New INSERT policies on `likes`/`follows` check
  for a block in either direction and reject the interaction server-side.
- **Found and fixed a real backend bug this same hardening surfaced**:
  `SupabaseCommunityBackend`'s insert/delete calls discarded their error
  results entirely — so a like/follow rejected by the new block-aware RLS
  would have shown as "succeeded" in the UI. Fixed to check and throw,
  with `communityStore`/`moderationStore` now rolling back their
  optimistic updates on failure instead of drifting out of sync.
- **Fixed a real, previously-dormant bug**: publishing a recipe wrote the
  *local device* file:// photo/video URI straight into the database —
  meaningless on any other device. Built `src/data/supabase/mediaUpload.ts`
  (real Supabase Storage upload, `expo-file-system`'s current File API,
  owner-scoped storage paths/RLS) and wired it into `publishRecipe`.
- **Built the RevenueCat webhook architecture** end-to-end (`supabase/
  functions/revenuecat-webhook`) so server-side entitlement state exists
  at all — previously there was none. Wired `Purchases.logIn`/`logOut`
  into `authStore` so webhook events can actually be attributed to a real
  account. The `subscribers` table has no write policy for any client
  role — entitlement state cannot be modified by the app itself.
- **Hardened `delete-account`**: a malformed JSON body previously threw
  an unhandled exception instead of a clean error response — fixed, plus
  input validation and idempotent handling of a double-delete.
- **Reports now survive their reporter deleting their account** (`ON
  DELETE SET NULL` instead of `CASCADE`) — moderation evidence isn't lost
  just because the reporter later deletes their own account. A partial
  unique index throttles duplicate open reports.
- **Fixed a real over-fetching pattern**: Discover fetched up to 200
  profiles to resolve a handful of recipe authors. Added
  `AuthBackend.getProfilesByIds` (both local and Supabase
  implementations) scoped to exactly the authors actually needed.
- Added CHECK constraints validating recipe content server-side (name/
  description length, prep time bounds, ingredient/step count bounds) —
  the backend no longer trusts client-side validation alone.
- Shared CORS handling added to both Edge Functions.
- Full repo-wide secret search: no hardcoded credentials, no service-role
  key in client code, `.env.example` documents client vars only with
  server secrets clearly separated to their own (never-committed) home.
- Test suite: 319 → **340 passing**, 34 suites, zero weakened/deleted.
  `tsc`, `expo lint`, and both iOS/Android `expo export` all clean.

---

## 0. Release Candidate audit (prior session) — see chat for the full A–R report

This session's mandate was: fix the two confirmed-broken features (Shopping
List, Daily/Tasting), find the real root cause of the original filter
"Something went wrong" report, and do a full regression pass. Headline
results (full detail in the A–R report delivered in-conversation):

- **Root-caused and fixed a real, 100%-reproducible crash**: Shopping List
  threw "Maximum update depth exceeded" every time it opened, because
  `app/shopping-list.tsx` selected `useInventoryStore((s) => s.asIdSet())`
  — a method that allocates a brand-new `Set` on every call. Used directly
  as a Zustand/`useSyncExternalStore` selector, that makes every render's
  snapshot fail an identity check against the previous one, forcing an
  infinite re-render loop. Fixed by selecting the stable `entries` array
  and deriving the Set with `useMemo` (the pattern already used correctly
  elsewhere). Confirmed via a clean app relaunch + re-navigation, not just
  code review.
- **Rebuilt Shopping List as a real, persistent feature** — it was
  previously a single-recipe, non-persistent, read-only projection with no
  add/remove/complete/clear support at all. Now backed by
  `ShoppingListRepository` + `useShoppingListStore` (AsyncStorage-backed,
  full CRUD, premium-gated per the existing product spec), with 19 new
  regression tests.
- **Found and fixed a second, independent instance of the exact same crash
  class** in `app/(tabs)/search.tsx`: the "results" list (numColumns=2)
  and the "discovery" list (no numColumns) are two different `FlatList`s
  conditionally rendered at the same tree position — React Native
  explicitly forbids changing `numColumns` on an existing FlatList
  instance. This is the most likely real root cause of the original
  filter/search-area "Something went wrong" reports: a render-time
  invariant invisible to any amount of domain-level logic testing (which
  is exactly why the earlier investigation couldn't reproduce it). Fixed
  with distinct `key` props on both lists — the same fix applied
  defensively to `app/(tabs)/my-bar.tsx` (3 lists, also a live, confirmed
  crash on the Recipes/Favorites ↔ Journal toggle) and
  `app/browse/[dimension].tsx` (2 lists, not currently reachable live but
  fixed defensively).
- **Fixed "Daily" = the Tasting Journal** (Turkish "Günlük" literally means
  both "journal" and "daily," which is why the user knew it by that name).
  It wasn't crashing, but two real gaps matched "feels broken": tapping an
  entry did nothing (no navigation to the logged drink — a dead tap), and
  there was no way to edit a logged entry at all, only delete it. Added
  `JournalRepository.update`, wired an edit mode into `JournalLogModal`,
  and added tap-to-open / long-press-for-actions to each entry row.
- **Found and fixed a real localization gap**: 68 ingredient-note
  occurrences (32 distinct English phrases like "top with soda water",
  "or 1 sugar cube") across the catalog were never translated — the
  Turkish content overlay only covered description/steps/garnish, not
  per-ingredient notes. Added `src/i18n/ingredientNotes.ts` with all 32
  translations plus a data-integrity test that fails if a future catalog
  addition introduces an untranslated note.
- Full verification after every change, not just at the end: `tsc`,
  `expo lint`, and `jest` all clean throughout; test suite grew from the
  297-test baseline to **319 passing tests**, zero weakened/deleted. Final
  `expo export` for both iOS and Android succeeded cleanly.

---

## 1. Prior session's final report (A–X)

### A. Crash / "Something went wrong" investigation — ✅
Traced the reported filter crash through UI → state → `matchesFilters` →
repository → render for all 251 cocktails × every filter value
(exhaustive, zero throws), reviewed the code path statically, and
rendered `/filters` live in the iOS Simulator — no crash reproduced by any
method. Hardened regardless: `ErrorBoundary` now localizes its fallback
safely (no hook usage in a class component), reports through
`src/lib/crashReporting.ts`, and every new module added this phase
(Supabase, social auth, RevenueCat, moderation) fails closed into a typed
error result rather than throwing into a screen. 🔍 Real-device crash
reproduction was never possible in this environment (no physical device
attached) — if the original crash report came from a real device, it
remains formally unverified; see item R.

### B. Ara / Search redesign — ✅
Four large horizontal discovery cards (spirit / style / taste /
**preparation method** — the required 4th dimension) replace the old
stacked browse-by rows; smaller collections stay below as a visually
distinct secondary section. Verified live in the simulator (TR strings,
correct counts).

### C. Filter system modernization — ✅
Live result count, per-filter removal chips, Clear All, zero-results
messaging, documented OR-within/AND-across semantics, 10 new adversarial
tests (empty catalog, malformed values, over-constrained → 0 results, no
throw). 297/297 tests passing. Verified live.

### D. Navigation / stability — ✅ (as audited)
No newly introduced navigation regressions found; every new screen
(`browse/[dimension]`) is registered in `app/_layout.tsx`. Full `tsc`,
`expo lint`, and `jest` pass after every change made this session (run
repeatedly, not just once at the end).

### E. Data integrity & matching — ✅ (carried forward + reverified)
`dataIntegrity.test.ts` and `matching.test.ts` continue to pass;
"can-make-now" vs "can-make-with-substitute" tiering was already
correctly disclosed in the matching UI from the prior phase. Not
re-litigated from scratch this session — reverified, not rebuilt.

### F. Authentication — ⚠️
Real architecture, not a stub: email/password via Supabase Auth (passwords
never touch local storage in the real backend), **Apple Sign In** and
**Google Sign In** both fully implemented
(`src/data/supabase/SupabaseSocialAuthProvider.ts`) using the correct
nonce-hashing flow for `signInWithIdToken`. Gated entirely behind
`isSupabaseConfigured` — with no Supabase project connected (this
environment's actual state), the app correctly and honestly falls back to
the local on-device auth, which is explicitly labeled in-app as
device-only ("Bu hesap yalnızca bu cihazda yaşar…"). **Blocked on:**
a real Supabase project, a real Apple "Sign In with Apple" capability +
Services ID, and a real Google Cloud OAuth client — none of which this
environment has credentials for. See the blocker table.

### G. Backend — ⚠️
Supabase schema (`supabase/schema.sql`) with RLS on every table, a real
`AuthBackend`/`CommunityBackend`/`ModerationBackend`/`RemoteRecipeBackend`
implementation, and a service-role-isolated account-deletion Edge
Function — all code-complete and verified to compile/lint/pass tests, but
**never run against a live Supabase project** (none exists). 🔍

### H. Offline-first — ✅
Catalog, search, filters, matching, homemade recipes, favorites, and My
Bar all continue to work with zero backend regardless of Supabase state
(this was true before this session and remains true — verified via the
local-backend fallback path, which is what actually ran in every live
check this session).

### I. Premium / billing — ⚠️
Real RevenueCat integration (`RevenueCatPurchaseService.ts`) wraps
StoreKit/Play Billing, reads `monthly`/`annual`/`lifetime` offering
packages, maps entitlements, and handles cancel/restore/failure paths —
dynamically loaded so it never touches Expo Go. Gated behind
`EXPO_PUBLIC_REVENUECAT_*` env vars; unset (current state), the app
correctly runs on the pre-existing local dev purchase stand-in, which is
never presented to the user as a real transaction. **Never sandbox-tested
against a real store** — cannot be, without real App Store Connect /
Play Console products and a device. 🔍

### J. Discover / community — ⚠️
Feed, likes, follows, creator profiles all functional on the local
backend today; `RemoteRecipeBackend` exists for real pagination but is
deliberately not wired into the Discover screen yet (see its own doc
comment) to avoid regressing a working feature with something untestable
in this environment.

### K. UGC safety / moderation — ✅ (newly built this session)
Was previously **missing entirely** — flagged and fixed this session.
Real report (5 reasons + free-text) and block/unblock flows, backed by
`ModerationBackend` (local JsonStore + Supabase `reports`/`blocks` tables
with RLS), wired into both the creator profile ("…" menu) and each
Discover feed card (overflow → report recipe). Blocking is immediately
effective client-side (blocked users' recipes filtered out of Discover).
Reporting is honest about what happens to a report: local builds tell the
user plainly that there's no moderation team yet to receive it; Supabase
builds say it's been submitted for review. 🔍 Not exercised end-to-end
live (no seeded published recipe existed in this dev environment to
report) — verified via `tsc`/`lint`/`jest` and partial live rendering only.

### L. Account deletion / privacy — ✅
Fully in-app (Profile → Delete Account), no email-support requirement.
Deletes auth identity + profile + published recipes + likes + follows +
(newly wired this session) moderation data, via a service-role-isolated
Edge Function when Supabase is active, or the equivalent local cleanup
otherwise. `accountDeletion.test.ts` passes.

### M. Media architecture — ✅ (carried forward)
Remote URL + local fallback + placeholder handled by `RecipeMedia`; no
licensed photography fabricated or claimed.

### N. Design system / visual polish — ✅ (carried forward + this session's additions follow the existing tokens, no new ad-hoc styling system introduced)

### O. Accessibility — 🔍
No regression introduced; not independently re-audited this session
beyond what the prior phase covered. Should get a dedicated pass with
VoiceOver/TalkBack on a real device before submission.

### P. Performance — 🔍
No profiling tooling run this session (no device attached). Nothing done
this session is algorithmically expensive (client-side filters over ~250
records, a handful of new Supabase queries scoped by indexed columns).

### Q. Localization — ✅
Every new string this session shipped in both `en` and `tr` — no
untranslated new UI surface.

### R. Real-device QA — ❌ (cannot be done from here)
Everything in this report was verified via `tsc`, `expo lint`, `jest`
(297/297 passing throughout), and live rendering in the **iOS Simulator**
only. No physical device, no TestFlight build, no real purchase, no real
Apple/Google/Supabase credential was available in this environment. This
is the single biggest gap between "code complete" and "store ready" —
see the blocker table.

### S. Store configuration (bundle ID, EAS, signing) — ⚠️
`com.ecclesia.coctail` kept unchanged everywhere (iOS, Android, unaffected
by anything this session touched). `eas.json` created with
development/preview/production build profiles and a `submit.production`
section whose Apple/Google fields are explicit placeholders
(`REPLACE_WITH_…`) — never fabricated IDs.

### T. Apple Developer / App Store Connect — ❌ (external, see plan below)
No Apple Developer account exists per the user's own statement. Cannot be
progressed from inside this codebase — see the step-by-step plan below.

### U. Google Play Console — ❌ (external)
Not started; lower priority per the user's own instructions (iOS first).

### V. Privacy declarations — ⚠️
`legal/PrivacyPolicy.md` and `legal/Terms.md` drafted from a real,
code-derived SDK/data inventory (Supabase, RevenueCat, Apple/Google
sign-in, `expo-image-picker`; explicitly **no** analytics/ad/tracking SDK
in this build — see `NoOpAdProvider.ts`). Marked throughout as drafts
needing legal review — no legal text invented as final. Not yet hosted
anywhere public (needed before App Store Connect submission, which
requires a live URL).

### W. Brand ("Cellar") — 🔍
An informal collision check was done in an earlier phase (WebSearch,
app-store-name level only). Full Section 21 scope (domain availability,
social handles, formal trademark search) was **not** performed this
session — that requires live web/registry access and, for trademark,
genuinely qualified legal search, which this environment cannot certify
as exhaustive. Flagged as unverified, not silently assumed clear.

### X. Testing / build verification — ✅
Every change in this session was followed by `npx tsc --noEmit`,
`npx expo lint`, and `npx jest` (31 suites / 297 tests), all clean, plus a
live re-render check in the iOS Simulator after every meaningfully risky
change (backend wiring, social auth, billing, moderation). No lint rule
was disabled and no test was weakened to get a pass.

---

## 2. Launch blocker table

| Item | Status | Who/what blocks it | Exact next action |
|---|---|---|---|
| Apple Developer account | ❌ | Apple (identity verification, $99/yr) | Enroll at developer.apple.com — see plan below |
| App Store Connect app record | ❌ | Requires the above | Create after enrollment |
| Bundle ID / App ID | ⚠️ done in code | `com.ecclesia.coctail` already set | Register the same string in Apple Developer once enrolled |
| Certificates & provisioning | ❌ | Requires Apple Developer account | `eas credentials` after enrollment (EAS can generate these) |
| EAS project | ⚠️ config-ready | `eas.json` exists; no EAS project linked yet | `eas init` / `eas build:configure` |
| Production build | ❌ | Needs EAS project + credentials | `eas build --profile production` |
| TestFlight | ❌ | Needs a production build + ASC record | Upload via `eas submit`, add test account |
| Sign in with Apple | ⚠️ code-ready | Needs the capability enabled in Apple Developer + Supabase Auth provider config | Enable capability, add Services ID/key to Supabase dashboard |
| Google Sign In | ⚠️ code-ready | Needs Google Cloud OAuth clients + Supabase provider config | Create clients, set `EXPO_PUBLIC_GOOGLE_*` env vars |
| Backend (Supabase) | ⚠️ code-ready | No live project | Create project, `supabase db push` (applies `supabase/migrations/*.sql` in order), deploy `delete-account`, set env vars, add `cellar://reset-password` + `cellar://` to Auth -> Redirect URLs (required for password reset/email confirmation to work) |
| RevenueCat webhook | ⚠️ code-ready | No live RevenueCat/Supabase project | Deploy `supabase functions deploy revenuecat-webhook`, `supabase secrets set REVENUECAT_WEBHOOK_AUTH_HEADER=<random>`, add the webhook URL + same header value in the RevenueCat dashboard |
| Payments (RevenueCat) | ⚠️ code-ready | No RevenueCat project / store products | Create project + entitlement `premium` + 3 products, set env vars |
| Privacy Policy / Terms / Community Guidelines | ⚠️ drafted, now real in-app screens | Needs legal review, real business details (`src/config/legal.ts` env vars), and public hosting | Have a lawyer review `src/content/legal/*.ts`, fill in `EXPO_PUBLIC_LEGAL_ENTITY_NAME`/`EXPO_PUBLIC_LEGAL_JURISDICTION`/`EXPO_PUBLIC_SUPPORT_EMAIL`, host publicly at the `EXPO_PUBLIC_*_URL` vars, link in App Store Connect |
| Account deletion | ✅ | — | Already in-app, no action needed |
| UGC moderation | ✅ (functionally) | — | Built this session; recommend a live QA pass with a seeded published recipe |
| Built-in cocktail photography | ❌ MEDIA DATASET REQUIRED | No licensed photo source connected — never hotlinked/scraped as a workaround | Source real, licensed photography (commissioned or a licensed stock set); see `MEDIA_PIPELINE.md` for the exact manifest fields and rollout steps |
| Screenshots | ❌ | Needs a real device/simulator pass with real content | Capture per the screenshot plan below once seed content exists |
| App Store metadata | ⚠️ draft below | Needs final copy decision + screenshots | Fill in the draft below, no fabricated claims |
| Privacy "Nutrition Label" declarations | ⚠️ inventory ready | Needs ASC form filled from the SDK inventory in this doc | Transcribe section V into App Store Connect's privacy questionnaire |
| Crash monitoring | ❌ | No Sentry (or equivalent) account | `npx expo install @sentry/react-native`, wire into `crashReporting.ts` (one file, seam already built) |
| Real-device QA | ❌ | No physical device in this environment | Manual pass on a real iPhone before submission |
| App Review | ❌ | Requires a submitted build | Provide a test account in review notes (once auth is live) |
| Google Play | ❌ | Deprioritized per explicit instruction | Revisit after iOS ships |

---

## 3. Apple Developer → App Store: step-by-step

Tags: **[USER]** = only a human with Apple/legal authority can do this ·
**[CODE]** = already done or doable from this repo · **[APPLE]** = Apple's
own process time, not compressible.

1. **[USER]** Create/confirm an Apple ID for the developer account.
2. **[USER]** Enroll at developer.apple.com — choose Individual or
   Organization (Organization needs a D-U-N-S number; slower). Pay the
   $99/year fee.
3. **[APPLE]** Identity verification — can take anywhere from minutes to
   several business days; not something to plan a launch date around.
4. **[USER]** Accept the Apple Developer Program License Agreement.
5. **[USER]** In App Store Connect: accept the current Paid/Free Apps
   agreement, enter tax and banking info (required even for a free app
   with in-app purchases).
6. **[USER]** Register the App ID `com.ecclesia.coctail` in the Apple
   Developer portal, enabling the "Sign In with Apple" capability.
7. **[CODE]** Already declared: `app.json`'s `ios.usesAppleSignIn: true`
   and the `expo-apple-authentication` config plugin.
8. **[USER]+[CODE]** Run `eas credentials` (after `eas init`) to generate
   a distribution certificate and provisioning profile — EAS automates
   the mechanics, but the Apple Developer account has to exist first.
9. **[USER]** Create the app record in App Store Connect (name, primary
   language, bundle ID, SKU).
10. **[CODE]** `eas build --profile production --platform ios`.
11. **[USER]+[CODE]** `eas submit --platform ios` to upload to TestFlight.
12. **[USER]** Add internal/external testers in TestFlight; provide a
    real test account once Supabase auth is live (App Review requires
    one if the app has login).
13. **[USER]** Fill in App Store Connect metadata (draft below),
    screenshots, privacy declarations, age rating.
14. **[USER]** Submit for App Review.
15. **[APPLE]** Review time is Apple's own SLA — typically 24–48h but not
    guaranteed; do not promise a launch date against it.
16. **[USER]** Release (manual or automatic) once approved.

No step above is compressible into "1–2 days" end-to-end — steps 3 and 15
alone are outside anyone's direct control.

---

## 4. App Store Connect metadata — draft (fill in, don't fabricate)

- **Name:** Cellar
- **Subtitle:** [≤30 chars — e.g. "Cocktails & your home bar" — decide once final feature set is locked]
- **Category:** Food & Drink
- **Age rating:** Likely 17+ (alcohol references) — confirm via Apple's actual age-rating questionnaire, don't self-assign
- **Description / keywords / promotional text:** Not drafted here — needs real product copy, not placeholder marketing claims
- **Support URL / Marketing URL:** [needs real hosting]
- **Privacy Policy URL:** [needs `legal/PrivacyPolicy.md` reviewed, finalized, and hosted]
- **App Review notes:** Once auth is live, include a real test account (username/password) and one line explaining the ingredient-matching feature, since it's the app's least self-explanatory mechanic

## 5. Screenshot plan

Real UI only, captured from the Simulator or a real device once seed
content exists (a handful of published recipes, so Discover isn't empty):
1. Search/discovery — the 4 large dimension cards
2. Cocktail detail — the ingredient/method layout
3. "I have these ingredients" matching result
4. Filters — active chips + live result count
5. Discover feed — a published recipe card
6. Premium paywall — plan comparison

No composited marketing graphics claimed as "real UI" — plain captures
only, per the anti-fabrication rule.

---

## 6. What changed this session (for the record)

Real Supabase backend wiring verified stable; real Apple/Google Sign-In
(`SupabaseSocialAuthProvider.ts`); real RevenueCat billing
(`RevenueCatPurchaseService.ts`); a previously-nonexistent UGC moderation
system (report + block, local and Supabase-backed, wired into Discover
and creator profiles); `eas.json`; `.env.example`; draft
`legal/PrivacyPolicy.md` and `legal/Terms.md`; this report. Every change
was verified with `tsc` + `expo lint` + `jest` (297/297) and a live
Simulator check before moving to the next item.
