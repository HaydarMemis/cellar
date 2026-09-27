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
/** Auth (GoTrue) and database (PostgREST) calls: small JSON requests. */
export const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;
/** Edge Functions (e.g. delete-account, which also removes Storage media). */
export const SUPABASE_FUNCTION_TIMEOUT_MS = 60_000;

/**
 * Upper bound for a single request, by Supabase service. React Native's
 * Android networking (OkHttp) is created with NO read timeout, so a request
 * on a stalled network (captive portal, dead Wi-Fi that still reports
 * "connected") can wait forever — and supabase-js holds its auth lock
 * across a token refresh, so one stalled refresh blocks every other call.
 * Storage (media uploads/downloads) is deliberately NOT capped here: a large
 * upload on a slow connection can legitimately take longer.
 */
export function requestTimeoutFor(url: string): number | null {
  if (url.includes('/auth/v1/') || url.includes('/rest/v1/')) return SUPABASE_REQUEST_TIMEOUT_MS;
  if (url.includes('/functions/v1/')) return SUPABASE_FUNCTION_TIMEOUT_MS;
  return null;
}

type FetchLike = (input: RequestInfo, init?: RequestInit) => Promise<Response>;

function requestUrl(input: RequestInfo): string {
  if (typeof input === 'string') return input;
  if (input && typeof (input as { url?: unknown }).url === 'string') return (input as { url: string }).url;
  return String(input);
}

/**
 * Wraps fetch so a Supabase request aborts after `requestTimeoutFor(url)`.
 * A caller's own AbortSignal keeps working. An aborted request surfaces to
 * supabase-js exactly like a network failure (auth: AuthRetryableFetchError,
 * which keeps the stored session; PostgREST: a returned error).
 */
export function createTimeoutFetch(baseFetch: FetchLike, timeoutFor: (url: string) => number | null = requestTimeoutFor): FetchLike {
  return (input, init) => {
    const timeoutMs = timeoutFor(requestUrl(input));
    if (timeoutMs == null) return baseFetch(input, init);
    const controller = new AbortController();
    const upstream = init?.signal;
    if (upstream) {
      if (upstream.aborted) controller.abort();
      else upstream.addEventListener('abort', () => controller.abort());
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return baseFetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      // Resolved per call (not captured at module load) so a fetch polyfill
      // or test mock installed later is still honored.
      global: { fetch: createTimeoutFetch((input, init) => fetch(input, init)) as typeof fetch },
    })
  : null;

/**
 * The AsyncStorage key supabase-js persists the session under. Read from the
 * client itself (it's what the client actually writes); the fallback mirrors
 * supabase-js's own default (`sb-<first host label>-auth-token`). Deliberately
 * NOT passed to createClient as an override — changing the key would sign
 * every existing user out on update.
 */
export function supabaseAuthStorageKey(): string | null {
  const fromClient = (supabase as unknown as { storageKey?: unknown } | null)?.storageKey;
  if (typeof fromClient === 'string' && fromClient) return fromClient;
  if (!supabaseUrl) return null;
  const host = supabaseUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/:?#]/)[0].toLowerCase();
  return host ? `sb-${host.split('.')[0]}-auth-token` : null;
}

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
