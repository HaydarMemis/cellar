/**
 * TEMPORARY device diagnostics: counts only, sanitized crash records.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCAL_GUEST_OWNER_ID } from '../../domain/types';
import { buildStorageReport, formatCrash, toCrashRecord } from '../deviceDiagnostics';

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('reports per-store counts split into shown / guest / other accounts — never ids or content', async () => {
  await AsyncStorage.setItem('@app/onboarding', JSON.stringify({ completed: true }));
  await AsyncStorage.setItem(
    '@bar/recipes',
    JSON.stringify([
      { id: 'r1', name: 'Secret Sour', ownerId: 'acct-A' },
      { id: 'r2', name: 'Guest Fizz', ownerId: LOCAL_GUEST_OWNER_ID },
      { id: 'r3', name: 'Other', ownerId: 'acct-B' },
    ]),
  );
  await AsyncStorage.setItem('@bar/favorites', JSON.stringify([{ id: 'f1', targetId: 'negroni' }])); // no ownerId = guest (legacy)
  const report = await buildStorageReport('acct-A');
  expect(report).toContain('showing: signed-in account');
  expect(report).toContain('@bar/recipes: 3 total · shown 1 · guest 1 · other accounts 1 (1 accts)');
  expect(report).toContain('@bar/favorites: 1 total · shown 0 · guest 1');
  expect(report).toContain('@bar/journal: no key');
  expect(report).not.toMatch(/Secret Sour|acct-A|acct-B|negroni/);
});

it('flags fresh storage (no onboarding key) — i.e. the app data container was replaced', async () => {
  expect(await buildStorageReport(LOCAL_GUEST_OWNER_ID)).toContain('onboarding done: NO KEY');
});

it('crash records keep route pattern, error class and sanitized message only', () => {
  const error = new TypeError("Cannot read property 'id' of undefined for alice@example.com eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc");
  const record = toCrashRecord(error, true, 'global', '/cocktail/[id]');
  expect(record.route).toBe('/cocktail/[id]');
  expect(record.name).toBe('TypeError');
  expect(record.message).not.toMatch(/alice@example\.com|eyJ/);
  expect(formatCrash(record)).toContain('FATAL · global');
});
