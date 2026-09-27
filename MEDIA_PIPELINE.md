# Cellar — Media Pipeline

Two entirely separate media pipelines exist in this app. They must stay
separate: one is licensing-sensitive catalog content, the other is a user's
own content.

## 1. Built-in catalog photography — MEDIA DATASET REQUIRED

**Status: not sourced.** No licensed cocktail-photography dataset is
connected to this project, and per this codebase's standing rule, it never
will be filled in by hotlinking, scraping, or otherwise using images
without a clear license and attribution trail. This is stated here
explicitly rather than left silently unsolved.

### What exists today

- `Cocktail.imageUrl` / `Cocktail.thumbnailUrl` (`src/domain/types.ts`) —
  optional fields, present in the data model since the app's first sprint,
  intentionally unset for every one of the 251 built-in cocktails.
- The visual identity for catalog cocktails is therefore **not** a photo —
  it's a designed abstract treatment (a per-cocktail gradient keyed off
  base spirit/category, plus a line-art glass icon), rendered by
  `DrinkCard`/the cocktail detail screen whenever `imageUrl` is absent.
  This was a deliberate product decision from the original MVP plan, not a
  placeholder-while-nobody-was-looking: it was designed to read as
  editorial/menu-like rather than as a broken image state.
- `src/domain/mediaManifest.ts` — the `CocktailMediaEntry` type every
  catalog cocktail's photo metadata must eventually satisfy:
  `{ cocktailId, imageUrl, thumbnailUrl, source, license, attribution,
  credit, aspectRatio, status }`. `status` is `'missing' | 'pending-review'
  | 'approved'`; `isMediaEntryValid()` refuses to let an entry claim
  `'pending-review'` or `'approved'` without a real `imageUrl` + `source` +
  `license` (and `attribution` too, if the license requires credit) —
  enforced by a dedicated test (`src/data/catalog/__tests__/mediaManifest.test.ts`),
  so a future edit can't silently flip a status flag without doing the
  actual licensing work.
- `src/data/catalog/mediaManifest.ts` — the real manifest, derived
  automatically from the live catalog (`cocktails.map(...)`, not a
  hand-maintained list that can drift out of sync). Every entry currently
  reports `status: 'missing'`, honestly, because that's the true state.

### Wired in (release-candidate sprint)

`DrinkVisual` now reads catalog photography from the manifest: an entry is
shown only when its status is `approved` AND `isMediaEntryValid` passes (real
imageUrl + source + license + attribution where required). Everything else
keeps the designed spirit-tone hero. Adding licensed photos is therefore a
data-only change to `overrides` in `src/data/catalog/mediaManifest.ts`.

### Previously: what this was NOT wired into

Nothing in the UI currently reads from this manifest — `DrinkCard` and the
cocktail detail screen still read `cocktail.imageUrl` directly, exactly as
before this sprint. The manifest exists as the **production data
structure** the moment real photography becomes available, not as a
behavior change today. This is deliberate: adding a data structure nobody
depends on yet carries zero regression risk to the working "no photo"
visual treatment.

### How to actually fill this in, when ready

1. Source real photography with a clear license: commission original
   shots (cleanest option, `license: 'original'`), license a stock set
   (`license: 'licensed'`, keep the license terms on file), or use
   genuinely CC0/CC-BY/CC-BY-SA images with real attribution tracked in
   the `attribution` field.
2. Upload each image somewhere Cellar's build can reference by a stable
   `https://` URL (a dedicated Storage bucket, e.g. a `catalog-media`
   bucket alongside the existing `recipe-media` one, is the natural home —
   not the `recipe-media` bucket itself, which is owner-scoped for user
   content).
3. Add an entry to `overrides` in `src/data/catalog/mediaManifest.ts`
   keyed by the cocktail's id, with every required field filled in and
   `status` set to `'pending-review'` first (a human sign-off step) before
   `'approved'`.
4. Only then wire `getCocktailMedia(id)?.imageUrl` into `DrinkCard`/the
   detail screen as the preferred source, falling back to the existing
   abstract treatment for any cocktail still at `'missing'` — the fallback
   path must never be removed, since photography will likely roll out
   gradually, not for all 251 cocktails at once.

## 2. User-generated recipe media — real, working, already shipped

Unlike the catalog, this pipeline is genuinely built and production-shaped
— reused as-is this sprint, not rebuilt.

- A user attaches a photo/video to their own `PersonalRecipe` via
  `expo-image-picker`, stored initially as a local device URI
  (`file://`/`ph://`/`content://` depending on platform).
- `src/data/supabase/mediaUpload.ts`'s `uploadRecipeMedia()` uploads that
  local file to the `recipe-media` Supabase Storage bucket under
  `<ownerId>/<recipeId>/<kind>` (fixed filename per kind, `upsert: true` —
  replacing a photo genuinely replaces the object rather than
  accumulating orphans) the moment a recipe is published, returning the
  real public HTTPS URL that gets written into `recipes.photo_url`/
  `video_url`. `isRemoteMediaUrl()` is what `publishRecipe` uses to decide
  whether there's anything left to upload at all (an already-`https://`
  value is left alone).
- `removeRecipeMedia()` cleans up every object under a recipe's prefix
  when it's unpublished or deleted, so Storage doesn't accumulate orphaned
  files.
- Storage RLS policies (see `supabase/migrations/20260922000400_recipe_media_storage.sql`)
  only allow a user to write under their own uid prefix — `mediaUpload.ts`
  doesn't need to re-check ownership itself, the database enforces it.
- **A local `file://` URI is never written into a production recipe
  record** — this was a real, previously-fixed bug (see
  `LAUNCH_READINESS.md`'s "-1." section); re-verified this sprint, still
  correct, still covered by `src/data/supabase/__tests__/mediaUpload.test.ts`.
- A private recipe's photo simply stays local (never uploaded) until the
  recipe is published — consistent with the Privacy Policy's description
  of photo handling (see `src/content/legal/privacyPolicy.ts`).

## Summary for anyone picking this up later

If you're looking for "why don't cocktails have real photos" — the answer
is `MEDIA DATASET REQUIRED`, documented here rather than silently punted.
If you're looking for "how does a user's own recipe photo get uploaded" —
that pipeline is real and already works; don't rebuild it.
