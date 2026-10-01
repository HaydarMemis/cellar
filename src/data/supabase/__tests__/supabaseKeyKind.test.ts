/**
 * The client refuses secret keys and flags malformed keys (which make every
 * Supabase request fail with 401 "Invalid API key").
 */
import { classifySupabaseKey } from '../client';

const b64url = (text: string) => btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${b64url(JSON.stringify(payload))}.c2lnbmF0dXJl`;

it('accepts the two public client key formats', () => {
  expect(classifySupabaseKey(jwt({ role: 'anon', ref: 'abc' }))).toBe('legacy-anon-jwt');
  expect(classifySupabaseKey('sb_publishable_AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBe('publishable');
});

it('recognizes secret keys (never allowed in the app)', () => {
  expect(classifySupabaseKey('sb_secret_AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBe('secret');
  expect(classifySupabaseKey(jwt({ role: 'service_role' }))).toBe('service-role-jwt');
});

it('flags anything else — e.g. a key copied without its sb_publishable_ prefix, or truncated', () => {
  expect(classifySupabaseKey('AbCdEfGhIjKlMnOpQrStUvWx-z_12345')).toBe('invalid');
  expect(classifySupabaseKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')).toBe('invalid');
  expect(classifySupabaseKey('')).toBe('missing');
  expect(classifySupabaseKey(undefined)).toBe('missing');
});
