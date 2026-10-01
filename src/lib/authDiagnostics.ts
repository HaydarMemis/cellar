/**
 * TEMPORARY auth diagnostics (device debugging of sign-up / Google sign-in).
 * Remove this module and its call sites once auth is verified on device.
 *
 * Enabled in development builds, or in a Release build ONLY when the build
 * was made with EXPO_PUBLIC_AUTH_DIAGNOSTICS=true (a Release build has no
 * __DEV__, and device testing here happens on Release builds). Never set
 * that variable for a store build.
 *
 * What is recorded: which step failed and the provider's error name /
 * HTTP status / error code / message — sanitized. Never passwords, tokens,
 * API keys or email addresses: messages are scrubbed of JWTs, long opaque
 * strings (keys, tokens, nonces) and email addresses before they are kept
 * or printed.
 */
export const AUTH_DIAGNOSTICS_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_AUTH_DIAGNOSTICS === 'true';

export interface AuthDiagnostic {
  step: string;
  name?: string;
  status?: number;
  code?: string;
  message?: string;
  /** Extra non-secret facts about the step (e.g. which client an ID token was issued for). */
  context?: string;
}

let last: AuthDiagnostic | null = null;

const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)?/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const OPAQUE = /[A-Za-z0-9_\-+/=]{24,}/g; // keys, tokens, nonces, client secrets

export function sanitizeDiagnosticText(text: string): string {
  return text.replace(JWT, '[jwt]').replace(EMAIL, '[email]').replace(OPAQUE, '[redacted]').slice(0, 300);
}

function describe(error: unknown): Omit<AuthDiagnostic, 'step'> {
  if (error == null) return {};
  if (typeof error !== 'object') return { message: sanitizeDiagnosticText(String(error)) };
  const e = error as { name?: unknown; status?: unknown; code?: unknown; message?: unknown };
  return {
    name: typeof e.name === 'string' ? e.name : undefined,
    status: typeof e.status === 'number' ? e.status : undefined,
    code: typeof e.code === 'string' || typeof e.code === 'number' ? sanitizeDiagnosticText(String(e.code)) : undefined,
    message: typeof e.message === 'string' ? sanitizeDiagnosticText(e.message) : undefined,
  };
}

/**
 * Records why an auth / profile step failed (sanitized, in memory only).
 * Always recorded so a short, non-sensitive ERROR REFERENCE can be shown to
 * the person in every build (see formatErrorReference); the full message
 * and console output only exist in diagnostics builds.
 */
export function recordAuthDiagnostic(step: string, error: unknown, context?: string): void {
  last = { step, ...describe(error), ...(context ? { context: sanitizeDiagnosticText(context) } : {}) };
  if (AUTH_DIAGNOSTICS_ENABLED) console.warn('[auth-diagnostics]', JSON.stringify(last));
}

/** The most recent failure, consumed once (so a stale one is never shown for a later error). */
export function takeAuthDiagnostic(): AuthDiagnostic | null {
  const d = last;
  last = null;
  return d;
}

/** One line for an on-screen alert, e.g. "signUp · AuthApiError · 401 · Invalid API key". */
export function formatAuthDiagnostic(d: AuthDiagnostic | null): string | null {
  if (!d) return null;
  return [d.step, d.name, d.status, d.code, d.message, d.context].filter((x) => x !== undefined && x !== '').join(' · ');
}

/**
 * Production-safe error reference, e.g. "googleIdTokenExchange-400-validation_failed":
 * which step failed, the HTTP status and the provider's stable error code —
 * never the message text, tokens, ids or email addresses. Shown under
 * generic error messages so a failure reported from a device can be traced
 * (Supabase Dashboard → Logs) without a special build.
 */
export function formatErrorReference(d: AuthDiagnostic | null): string | null {
  if (!d) return null;
  const code = d.code && /^[a-z0-9_]{1,40}$/i.test(d.code) ? d.code : undefined;
  return [d.step, d.status, code].filter((x) => x !== undefined && x !== '').join('-');
}

/**
 * The line to append under a user-facing error: the full sanitized detail in
 * diagnostics builds, otherwise just the error reference. Consumes the
 * recorded diagnostic. `referenceLabel` is the localized "Error code: {{code}}".
 */
export function takeErrorDetailLine(referenceLabel: (code: string) => string): string | null {
  const d = takeAuthDiagnostic();
  if (!d) return null;
  if (AUTH_DIAGNOSTICS_ENABLED) return `[diag] ${formatAuthDiagnostic(d)}`;
  const ref = formatErrorReference(d);
  return ref ? referenceLabel(ref) : null;
}

/** Error reference shown in every build when the bundled Supabase key isn't a client key (every request → 401 "Invalid API key"). */
export const INVALID_SUPABASE_KEY_REFERENCE = 'config-invalid_supabase_key';

/**
 * Error reference for a failed Discover feed request, e.g. "discover-401" or
 * "discover-0-PGRST301" — status and stable code only, never the message.
 */
export function discoverErrorReference(error: unknown): string {
  const e = (error && typeof error === 'object' ? error : {}) as { status?: unknown; code?: unknown };
  return (
    formatErrorReference({
      step: 'discover',
      status: typeof e.status === 'number' ? e.status : undefined,
      code: typeof e.code === 'string' ? e.code : undefined,
    }) ?? 'discover'
  );
}

/** Test-only reset. */
export function resetAuthDiagnosticsForTests(): void {
  last = null;
}

/**
 * Non-secret facts about a Google ID token, for diagnosing a rejected
 * Supabase exchange: which OAuth client it was issued for (named, never the
 * id), whether it carries a nonce, its issuer and whether the email is
 * verified. The token itself is never kept or printed.
 */
export function describeGoogleIdToken(idToken: string, clients: { webClientId?: string; iosClientId?: string }): string {
  try {
    const part = idToken.split('.')[1] ?? '';
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(globalThis.atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='))) as Record<string, unknown>;
    const name = (value: unknown) =>
      value === clients.webClientId ? 'web-client' : value === clients.iosClientId ? 'ios-client' : value == null ? 'none' : 'other-client';
    const iss = typeof claims.iss === 'string' ? claims.iss.replace(/^https:\/\//, '') : 'none';
    return `idToken aud=${name(claims.aud)} azp=${name(claims.azp)} nonce=${claims.nonce ? 'present' : 'absent'} iss=${iss} email_verified=${String(claims.email_verified)}`;
  } catch {
    return 'idToken unreadable';
  }
}
