import * as Sentry from '@sentry/react-native';

/**
 * The single seam every error in the app goes through.
 *
 * Production crash/error reporting uses Sentry when EXPO_PUBLIC_SENTRY_DSN is
 * set for the build (a DSN is a public, write-only ingestion key — safe in the
 * client bundle). Without a DSN nothing is sent anywhere.
 *
 * Privacy / secrets: only the error and the small, explicit context objects
 * passed by callers are sent (module/action/ids). Callers never pass
 * passwords, tokens or emails; `sendDefaultPii` is off, and beforeSend drops
 * request bodies/cookies and any context key that looks like a credential.
 */
export type ErrorContext = Record<string, string | number | boolean | undefined>;

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
let initialized = false;

const SENSITIVE_KEY = /(pass(word)?|token|secret|authorization|cookie|apikey|api_key|refresh|access|email)/i;

export function scrubContext(context: ErrorContext | undefined): ErrorContext | undefined {
  if (!context) return context;
  const out: ErrorContext = {};
  for (const [key, value] of Object.entries(context)) out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : value;
  return out;
}

export function initCrashReporting(): void {
  if (initialized || !dsn) return;
  initialized = true;
  try {
    Sentry.init({
      dsn,
      enabled: !__DEV__,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      environment: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
      beforeSend(event) {
        if (event.request) {
          delete event.request.data;
          delete event.request.cookies;
          delete event.request.headers;
        }
        if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
        return event;
      },
      beforeBreadcrumb(breadcrumb) {
        // Network breadcrumbs can carry auth headers/query tokens — keep only method/status/host.
        if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
          const url = typeof breadcrumb.data?.url === 'string' ? breadcrumb.data.url.split('?')[0] : undefined;
          return { ...breadcrumb, data: { method: breadcrumb.data?.method, status_code: breadcrumb.data?.status_code, url } };
        }
        return breadcrumb;
      },
    });
  } catch {
    // Crash reporting must never crash the app.
  }
}

/** Associates reports with the signed-in account's opaque id (never email/username); null on sign-out. */
export function setCrashReportingUser(userId: string | null): void {
  if (!initialized) return;
  try {
    Sentry.setUser(userId ? { id: userId } : null);
  } catch {
    // ignore
  }
}

export function reportError(error: unknown, context?: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(typeof error === 'object' ? JSON.stringify(error) : String(error));
  const safeContext = scrubContext(context);
  if (__DEV__) {
    console.error('[reportError]', err, safeContext);
  }
  if (!initialized) return;
  try {
    Sentry.captureException(err, { extra: safeContext });
  } catch {
    // ignore
  }
}
