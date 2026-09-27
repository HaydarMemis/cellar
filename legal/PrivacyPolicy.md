> **Superseded draft.** The current Privacy Policy is maintained in code at `src/content/legal/privacyPolicy.ts` (English and Turkish) and exported for hosting with `npm run legal:export` to `legal/generated/`. This file is kept for history only.

# Cellar — Privacy Policy (DRAFT)

> **This is not legal advice and is not a finished legal document.** It is a
> factually accurate draft of what Cellar actually does with data, generated
> from a direct audit of the codebase (see the SDK/data inventory in
> `LAUNCH_READINESS.md`). It must be reviewed — and very likely revised —
> by a qualified lawyer before publication, and every `[bracketed]` field
> filled in with a real value. Do not publish this as-is.

**Last updated:** [DATE — set when this is finalized and published]

## Who this is

Cellar is a cocktail recipe, discovery, and home-bar app published by
[LEGAL ENTITY NAME / YOUR NAME], [ADDRESS OR JURISDICTION].
Contact: [SUPPORT EMAIL].

## What Cellar does without any account

Browsing the built-in cocktail catalog, searching, filtering, ingredient
matching, favorites, My Bar, and personal (private) recipes all work
entirely on your device. This data — your favorites, your inventory, your
private recipes — is stored locally on your device (via encrypted-at-rest
OS storage where the platform provides it) and is **not** sent to us or
anyone else unless you create an account and choose to publish something.

## What we collect if you create an account

Creating an account and/or publishing a recipe sends the following to our
backend (Supabase, see "Sub-processors" below):

- **Account**: a username, display name, and an optional bio.
- **Authentication**: if you sign up with a password, Supabase Auth stores
  a securely hashed credential — we never see or store your raw password.
  If you sign in with Apple or Google, we receive and store the identity
  token's verified result (a stable user ID, and optionally the name/email
  that provider is willing to share — Apple lets you hide your real email
  behind a private relay address, and if you do, that's what we receive).
- **Published (public) recipes**: name, description, ingredients, method,
  steps, and any photo/video you attach — visible to anyone using the app.
- **Social graph**: who you follow, who follows you, and which public
  recipes you've liked — used to compute follower/following/like counts,
  visible to anyone using the app in aggregate (counts), with the specific
  edges (who liked what) governed by database access rules, not exposed
  through the app's UI beyond your own like state.
- **Reports you file**: if you report a recipe or user, we store the report
  content and your account ID (so reports can't be filed anonymously —
  this is a standard anti-abuse measure) — see "Content moderation" below.
- **Purchases**: if you subscribe to Premium, our billing provider
  (RevenueCat, layered over the Apple App Store / Google Play billing
  systems) records your purchase/subscription status and receipt data. We
  do not receive or store your payment card details — Apple/Google handle
  that directly.

## Photo library access

If you attach a photo to your own recipe, the app requests access to your
photo library at that moment, for that purpose only. Selected photos are
stored [locally only until a recipe with that photo is published, at which
point the photo is uploaded to our storage backend — confirm this matches
the final media-upload implementation before publishing this policy].

## Sub-processors (who else touches this data)

- **Supabase** (database, authentication, storage, and the account-deletion
  Edge Function) — [Supabase's data region / hosting details — confirm at
  project-creation time and state the actual region here].
- **RevenueCat** (subscription/purchase state) — only active once billing
  is connected; see `src/data/purchases/RevenueCatPurchaseService.ts`.
- **Apple** / **Google** — only if you choose "Continue with Apple" /
  "Continue with Google"; each provider's own privacy policy governs what
  they see about that sign-in.

Cellar does not use any third-party analytics, advertising, or tracking
SDK as of this draft — see the SDK inventory in `LAUNCH_READINESS.md` for
the authoritative, code-derived list. If that changes before release, this
section (and the App Store/Play "data safety" declarations) must be
updated to match before the change ships.

## Content moderation

Reports you file about a recipe or user are stored for review. [Describe
the actual review process once one exists — today, review is manual via
the Supabase dashboard; a production launch with real user-generated
content at any scale should have a defined SLA and a documented escalation
path before this section can honestly claim active moderation.]

## Account deletion

You can permanently delete your account from Profile → Settings →
Delete Account, directly in the app, with no need to contact support.
This removes your authentication identity, profile, published recipes,
likes, and follows from our backend; recipes and preferences kept only
on your device are removed when you delete the app itself. See
`supabase/functions/delete-account/index.ts` for the exact server-side
deletion logic.

## Children

Cellar is a cocktail (alcoholic beverage) app and is not directed at, and
should not be used by, anyone under the legal drinking age in their
jurisdiction, and in no case anyone under 17 (matching the intended App
Store age rating — confirm the exact age gate/rating during App Store
Connect setup, see `LAUNCH_READINESS.md`).

## Your rights

[This section needs jurisdiction-specific legal content — e.g. GDPR
(EU/UK), CCPA/CPRA (California), etc. — depending on where you actually
operate and who your users are. Do not publish without this.]

## Changes to this policy

[Standard "we'll notify you of material changes" language — again, have a
lawyer confirm the right mechanism/notice period for your jurisdiction.]

## Contact

[SUPPORT EMAIL] — for privacy questions, data access/deletion requests
that aren't already covered by the in-app account-deletion flow, or
security reports.
