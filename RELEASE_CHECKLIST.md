# Cellar — Release Checklist (production candidate, 27 Sep 2026)

This is the single source of truth for going from the repository to the App Store and Google Play.
Background and history live in `LAUNCH_READINESS.md`, `DATA_MIGRATION.md` and `MEDIA_PIPELINE.md`.

**Verification labels**

- **LOCAL:** verified in this repository (unit tests, `tsc`, lint, Expo exports, config introspection, Deno type-check of the Edge Functions).
- **PGLITE:** verified by applying every migration to an embedded Postgres (PGlite) with auth/storage stubs (`npm run test:rls`). This checks schema, RLS and constraint logic; it is **not** the live project.
- **LIVE:** verified against the real Supabase project. **Nothing in this release-candidate work is LIVE-verified.** This environment has no network route to `*.supabase.co`.
- **DEVICE:** needs a physical iPhone and/or Android phone.
- **EXTERNAL:** needs you to configure a dashboard or account.

---

## 1. Commands to run next (on your Mac, in the project folder)

```bash
npm install                      # picks up the new native deps and the react-dom pin
npm run verify                   # jest + tsc + lint
npm run test:rls                 # migrations + RLS regression in embedded Postgres (36 checks)

supabase db push                 # applies 20260926120000_production_hardening.sql (additive only)
supabase functions deploy delete-account          # Apple revocation + paginated media cleanup
supabase functions deploy revenuecat-webhook      # verify_jwt=false now pinned in config.toml
supabase migration list          # expect 8 local == 8 remote

npx expo prebuild --clean        # only if you build locally; the old ios/ folder is stale
eas build --profile preview --platform all        # internal test build
eas build --profile production --platform all     # store builds
```

---

## 2. External configuration (you must do these; nothing here can be done from the repo)

### EAS (expo.dev → project → Environment variables)
Create these for the **production** and **preview** environments (`eas.json` already maps each build profile to its environment). "Plain text" is fine for all `EXPO_PUBLIC_*` values; they are public by design.

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the anon (public) key |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `…_ANDROID_API_KEY` | RevenueCat public app keys |
| `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED` | `true` (after the Supabase Apple provider is on) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` | from Google Cloud (below) |
| `EXPO_PUBLIC_SENTRY_DSN` (+ `SENTRY_ORG`, `SENTRY_PROJECT`, secret `SENTRY_AUTH_TOKEN`) | optional but recommended |
| `EXPO_PUBLIC_LEGAL_*`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_*_URL` | see §2 Legal |

In `eas.json` → `submit.production`, replace `REPLACE_WITH_*` (Apple ID email, ASC app id, team id, Play service-account JSON path).

Bundle id / package is `com.ecclesia.coctail`. Decide it is final **before** the first store upload; it can never change afterwards.

### Supabase dashboard (project `<project-ref>`)
1. **Auth → URL Configuration → Redirect URLs:** `cellar://`, `cellar://reset-password`, `cellar://auth-callback`. Site URL: `cellar://`.
2. **Auth → Email → SMTP:** configure a real provider (Resend, Postmark, SES, Mailgun…). The built-in sender only delivers to project team members and is rate-limited, so real users would get **no** confirmation or reset emails. Then raise the email rate limit (Auth → Rate Limits).
3. **Auth → Email templates:** translate the confirmation and recovery templates if you want Turkish emails. Keep `{{ .ConfirmationURL }}`.
4. **Auth → Providers → Apple:** enable it and add `com.ecclesia.coctail` to *Client IDs* (native sign-in uses the bundle id).
5. **Auth → Providers → Google:** enable it with the **Web** client id and secret, add the iOS and Android client ids to *Client IDs*, and turn on **Skip nonce checks** (required by the native iOS SDK).
6. **Edge Function secrets** (`supabase secrets set …`):
   - `REVENUECAT_WEBHOOK_AUTH_HEADER`: a long random string, also pasted into RevenueCat.
   - For Apple token revocation on account deletion (App Review 5.1.1(v)): `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_CLIENT_ID=com.ecclesia.coctail`, `APPLE_PRIVATE_KEY` (the `.p8` contents, with the Sign in with Apple key enabled).
7. Run `supabase db push` and the two `functions deploy` commands (§1).
8. Moderation: reports land in `public.reports` (index on `status, created_at`). Assign someone to review open reports in the dashboard at least daily; the Community Guidelines state a 24-hour review target.

### Apple Developer / App Store Connect
1. Identifiers → `com.ecclesia.coctail`: enable **Sign in with Apple**. Keys → create a key with Sign in with Apple enabled (used for the revocation secrets above).
2. App Store Connect → new app with that bundle id.
3. In-App Purchases:
   - An auto-renewable subscription group with monthly and yearly products.
   - A non-consumable "lifetime" product.
   - Product ids must contain `month`, `year`/`annual` and `lifetime` (for example `cellar_premium_monthly`, `cellar_premium_yearly`, `cellar_premium_lifetime`). The app and webhook derive the plan from the id.
   - Set prices, localizations (EN/TR) and review screenshots.
4. Paid Apps agreement, tax and banking.
5. App Privacy questionnaire:
   - Email address, name (display name), User ID, user content (photos, recipes), purchase history (RevenueCat), and crash data (if Sentry enabled).
   - None of it is used for tracking or advertising.
6. Age rating: alcohol references (17+ / "Frequent/Intense Alcohol…" per the questionnaire).
7. Review notes:
   - Provide a demo account that has published recipes.
   - Explain report and block: the "…" menu on any recipe, and the creator profile.
   - Explain account deletion: Profile → Delete account.
   - Explain the "Restore purchases" location.
8. Privacy Policy URL and Terms URL (hosted, see Legal).

### Google Cloud Console
Create OAuth clients:
- A **Web application** client. Its id goes in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and in Supabase.
- An **iOS** client (bundle `com.ecclesia.coctail`). Its id goes in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; the reversed id goes in `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`.
- An **Android** client (package `com.ecclesia.coctail` plus the SHA-1 of **both** the EAS upload key and the Play app-signing key).

Configure the OAuth consent screen: app name, support email, privacy policy URL. Publish it to Production.

### Google Play Console
1. Create the app with package `com.ecclesia.coctail`.
2. Products:
   - Subscriptions: monthly and yearly (base plans).
   - An in-app product: lifetime.
   - Use the same id naming rule as on Apple.
3. Data safety form: the same data as the App Privacy answers. Declare that data is encrypted in transit and that users can request deletion.
4. **Account deletion URL** (mandatory): a public web page explaining how to delete an account (in-app path plus the support email). Set `EXPO_PUBLIC_ACCOUNT_DELETION_URL` to it.
5. Content rating (alcohol references), target audience 18+, and a service account for `eas submit`.

### RevenueCat
1. Create a project and add the iOS app (App Store Connect shared secret / in-app purchase key) and the Android app (Play service account).
2. Entitlement with identifier exactly **`premium`**, attached to all three products.
3. Offering marked *current*, using the package types **Monthly**, **Annual** and **Lifetime**.
4. Integrations → Webhook:
   - URL `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`.
   - Authorization header = the same value as `REVENUECAT_WEBHOOK_AUTH_HEADER`.
5. Copy the public iOS and Android API keys into EAS.

### SMTP / email provider
Verify your sending domain (SPF, DKIM, DMARC) and enter the SMTP credentials in Supabase. Send a real confirmation and reset email to your own inbox before submission.

### Legal / privacy hosting
1. Fill in: `EXPO_PUBLIC_LEGAL_ENTITY_NAME`, `…_ENTITY_ADDRESS`, `…_JURISDICTION`, `EXPO_PUBLIC_SUPPORT_EMAIL`, `…_LEGAL_EFFECTIVE_DATE`.
2. Have a lawyer review the EN and TR texts in `src/content/legal/` (KVKK / GDPR rights section is explicitly marked for completion).
3. After review set `EXPO_PUBLIC_LEGAL_REVIEWED=true`. That removes the in-app "draft" banner.
4. Run `npm run legal:export` with the same env vars and host `legal/generated/*.md` (or HTML rendered from them) at stable HTTPS URLs. Set `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `…_TERMS_URL`, `…_COMMUNITY_GUIDELINES_URL` and `…_ACCOUNT_DELETION_URL`.

---

## 3. Physical-device test plan (DEVICE)

Run it on a production-profile build via TestFlight or Play internal testing, not Expo Go.

- **Fresh install:** onboarding (3 pages, Skip, reduced motion), guest browsing, search, filters, cocktail detail, My Bar, favorites.
- **Guest → account:** as a guest, create a recipe, favorites, bar items, a journal entry and a shopping item. Then sign up, confirm email, and check that the **"Add this device's data"** prompt appears. Check that "Add" moves everything (the recipe stays private) and that "Not now" keeps it as guest data.
- **Upgrade from the previous build:**
  - Recipes made under the old device-only accounts are offered for adoption after signing in.
  - Old `recipe-…` recipes publish successfully.
- **Email:**
  - Sign up → inbox → tap the link (app killed, and app in background) → lands signed in with the chosen username.
  - Sign up again with the same email → "email already in use".
  - Sign in before confirming → confirmation screen with resend.
  - Forgot password → link → new password → signed in as **that** account.
  - Expired or used links show an honest message.
- **Apple:** first sign-in (share and hide email), returning sign-in, sign out, sign in again, delete account (Apple re-confirmation prompt; Settings → Apple ID → Sign in with Apple no longer lists Cellar).
- **Google:** iOS and Android first sign-in, returning sign-in, switching accounts after sign-out (the account picker appears).
- **Recipes and photos:**
  - Pick a photo (no permission prompt; the system picker).
  - The photo is shown after relaunch.
  - Publish → Supabase row and image; replace the photo → other devices see the new image; remove the photo → object gone; delete the recipe → row and media gone.
  - Airplane mode: publish → "will publish automatically" message plus "Waiting to publish" badge → turn airplane mode off → publishes by itself.
- **Community:**
  - Discover loading, empty and error states; pull to refresh; "See all" infinite scroll; open another creator's recipe and their profile.
  - Like, follow, share, favorite a community recipe (it shows under My Bar → Favorites).
  - Report (a duplicate report is refused).
  - Block (content hidden, like and follow rejected), then unblock.
- **Premium (sandbox / license testers):**
  - The paywall shows store prices in local currency.
  - Buy monthly, yearly and lifetime.
  - Cancel → no charge.
  - Ask to Buy / pending purchase.
  - Restore on a second device.
  - Sign out → Premium gone; sign back in → Premium back.
  - Expiry in sandbox → downgrade.
  - Manage subscription link.
- **Lifecycle:**
  - Cold start signed in, and cold start offline (still signed in, data visible).
  - More than an hour in the background, then foreground (session refreshed).
  - Revoke the session in the dashboard → the app signs out cleanly.
  - Force-quit during a publish → the recipe is intact and publishes later.
- **Keyboard:** auth, recipe editor (long multiline steps and notes), edit profile, account security, delete account, forgot/reset password, journal modal, report modal, search, ingredient picker.
- **Accessibility:** VoiceOver/TalkBack labels on tab bar, cards, like/favorite/share buttons, paywall plan radio buttons; Dynamic Type at the largest size; dark mode.
- **Account deletion:** with airplane mode on → error, nothing changed; online → deleted, local data kept as guest data.

---

## 4. Known limitations (accepted for 1.0, with reasons)

- **Editing a published recipe from a different device** isn't supported. Private recipes are device-local by design, so editing happens on the device that created the recipe. The published copy is still readable everywhere.
- **Private recipes, favorites, My Bar, journal and shopping list don't sync across devices.** This is intentional local-first behavior. Cloud sync would be a post-launch feature.
- **Profile photos aren't supported.** Avatars are generated color monograms.
- **No server-side rate limiting per user** on likes, follows and reports. RLS and unique constraints prevent duplicates and forgery, not volume. Add Supabase rate-limit rules or an Edge gateway if abuse appears.
- **No moderator back-office.** Reports are reviewed in the Supabase dashboard.
- **Catalog photography:** all 251 entries are `missing` by design. See MEDIA_PIPELINE.md. Adding licensed photos is a data-only change.
- **iPad:** `supportsTablet: false`, so the app runs in iPhone compatibility mode. A tablet layout was never designed or tested.
- **The local `ios/` folder is stale.** EAS regenerates native projects, so run `npx expo prebuild --clean` before building locally.
