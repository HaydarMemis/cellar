/**
 * TEMPORARY auth diagnostics: sanitization must never let secrets through.
 */
import { describeGoogleIdToken, discoverErrorReference, formatAuthDiagnostic, formatErrorReference, takeErrorDetailLine, recordAuthDiagnostic, resetAuthDiagnosticsForTests, sanitizeDiagnosticText, takeAuthDiagnostic } from '../authDiagnostics';

beforeEach(() => {
  resetAuthDiagnosticsForTests();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it('redacts JWTs, emails and long opaque strings (keys, tokens, nonces)', () => {
  const text =
    'bad token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123_- for alice@example.com key sb_publishable_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345 and ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
  const out = sanitizeDiagnosticText(text);
  expect(out).not.toMatch(/eyJ/);
  expect(out).not.toMatch(/alice@example\.com/);
  expect(out).not.toMatch(/ABCDEFGHIJKLMNOPQRSTUVWXYZ012345/);
  expect(out).toContain('[jwt]');
  expect(out).toContain('[email]');
});

it('keeps the useful parts: step, error name, HTTP status, error code, readable message', () => {
  recordAuthDiagnostic('signUp', Object.assign(new Error('Invalid API key'), { name: 'AuthApiError', status: 401, code: 'no_api_key' }));
  const d = takeAuthDiagnostic();
  expect(d).toEqual({ step: 'signUp', name: 'AuthApiError', status: 401, code: 'no_api_key', message: 'Invalid API key' });
  expect(formatAuthDiagnostic(d)).toBe('signUp · AuthApiError · 401 · no_api_key · Invalid API key');
});

it('is consumed once, so a stale diagnostic is never shown for a later error', () => {
  recordAuthDiagnostic('logIn', new Error('x'));
  expect(takeAuthDiagnostic()).not.toBeNull();
  expect(takeAuthDiagnostic()).toBeNull();
});

it('never records a long secret-looking value even if one ends up in an error message', () => {
  recordAuthDiagnostic('logIn', new Error('password=hunter2hunter2hunter2hunter2 rejected'));
  expect(JSON.stringify(takeAuthDiagnostic())).not.toContain('hunter2hunter2hunter2hunter2');
});

it('describes a Google ID token by client NAME and nonce presence — never the token or the client ids', () => {
  const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const token = `eyJhbGciOiJSUzI1NiJ9.${b64url({ iss: 'https://accounts.google.com', aud: 'WEB.apps.googleusercontent.com', azp: 'IOS.apps.googleusercontent.com', nonce: 'abc', email_verified: true })}.sig`;
  const out = describeGoogleIdToken(token, { webClientId: 'WEB.apps.googleusercontent.com', iosClientId: 'IOS.apps.googleusercontent.com' });
  expect(out).toBe('idToken aud=web-client azp=ios-client nonce=present iss=accounts.google.com email_verified=true');
  expect(out).not.toContain('googleusercontent');
  expect(describeGoogleIdToken('not-a-jwt', {})).toBe('idToken unreadable');
});

describe('production error reference (every build)', () => {
  it('is always recorded and formatted as step-status-code, never the message', () => {
    recordAuthDiagnostic('googleIdTokenExchange', Object.assign(new Error('Passed nonce and nonce in id_token should either both exist or not.'), { status: 400, code: 'validation_failed' }));
    const d = takeAuthDiagnostic();
    expect(formatErrorReference(d)).toBe('googleIdTokenExchange-400-validation_failed');
    expect(formatErrorReference(d)).not.toContain('nonce');
  });

  it('drops a code that is not a plain identifier', () => {
    expect(formatErrorReference({ step: 'avatarUpload', status: 403, code: 'has spaces and @ symbols' })).toBe('avatarUpload-403');
    expect(formatErrorReference(null)).toBeNull();
  });

  it('takeErrorDetailLine returns the localized reference and consumes it', () => {
    recordAuthDiagnostic('profileUpdate', { code: '42703', message: 'column "avatar_url" does not exist' });
    const line = takeErrorDetailLine((code) => `Error code: ${code}`);
    // Jest runs with __DEV__ true, i.e. diagnostics on: the full sanitized detail is shown.
    expect(line).toContain('profileUpdate');
    expect(takeErrorDetailLine((code) => code)).toBeNull();
  });
});

it('discoverErrorReference keeps only status + a plain code', () => {
  expect(discoverErrorReference(Object.assign(new Error('Invalid API key'), { status: 401 }))).toBe('discover-401');
  expect(discoverErrorReference({ status: 0, code: 'has spaces' })).toBe('discover-0');
  expect(discoverErrorReference('boom')).toBe('discover');
});
