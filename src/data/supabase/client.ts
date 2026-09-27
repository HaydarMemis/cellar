import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

/**
 * Real backend configuration — reads from environment variables (set them
 * in a `.env` file at the project root; Expo exposes any `EXPO_PUBLIC_`-
 * prefixed variable to client code automatically, no extra config needed).
 *
 * Nothing in this project requires these to be set: every screen goes
 * through `src/data/community/index.ts`, which falls back to the fully
 * local, fully offline dev backend whenever Supabase isn't configured —
 * exactly the state this project ships in today. Set both variables and
 * the app switches to the real backend automatically, with zero code
 * changes elsewhere.
 *
 * To get these values: create a project at https://supabase.com, then
 * Project Settings → API → "Project URL" and "anon public" key.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

/**
 * AsyncStorage (not expo-sqlite's localStorage shim, which Expo's own docs
 * now suggest) is used deliberately here: it's already a proven, working
 * dependency throughout this app (every repository in src/data/repositories
 * uses it), so wiring Supabase through it adds zero new native-module
 * surface area — meaningful in a project that has been actively auditing
 * for native-module-related crash risk.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * A store/TestFlight build with no Supabase env vars silently runs on the
 * on-device dev backend (device-only accounts, nothing published). `.env.local`
 * is gitignored, so EAS Build never sees it — the values must be set as EAS
 * environment variables for the profile's `environment` (see eas.json and
 * RELEASE_CHECKLIST.md). Surface that loudly in logs instead of shipping it
 * unnoticed. (Only the public URL/anon key are involved — never log values.)
 */
if (!isSupabaseConfigured && typeof __DEV__ !== 'undefined' && !__DEV__) {
  console.error('[Cellar] Supabase is NOT configured in this release build — running on the local-only backend. Set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY as EAS environment variables.');
}

/**
 * Supabase's recommended React Native setup: only auto-refresh the session
 * while the app is foregrounded. Timers don't run reliably in the
 * background, so without this a session can come back from the background
 * with an expired access token and every request fails RLS as anonymous
 * until something else happens to trigger a refresh.
 */
if (supabase && Platform.OS !== 'web') {
  const client = supabase;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
}
