import { uiDictionaries } from '../dictionaries';
import { Locale, supportedLocales } from '../types';

/**
 * `tr/ui.ts` is typed as `DeepDict<typeof en>`, which already guarantees
 * structural parity (every key present, right leaf shape) at compile time.
 * What that typing can't catch is an accidentally empty string. This walks
 * every leaf of the Phase 6 namespaces in both locales and checks it
 * actually has content.
 */
const namespaces = [
  'nav',
  'search',
  'discover',
  'creatorProfile',
  'publish',
  'premium',
  'scaling',
  'shoppingList',
  'journal',
  'auth',
  'onboarding',
  'legal',
  'blockedUsers',
  'editProfile',
  'accountSecurity',
] as const;

function collectLeaves(node: unknown, path: string[] = []): { path: string; value: unknown }[] {
  if (typeof node === 'string') return [{ path: path.join('.'), value: node }];
  if (node && typeof node === 'object' && 'one' in node && 'other' in node) {
    const plural = node as { one: string; other: string };
    return [
      { path: `${path.join('.')}.one`, value: plural.one },
      { path: `${path.join('.')}.other`, value: plural.other },
    ];
  }
  if (node && typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => collectLeaves(value, [...path, key]));
  }
  return [];
}

describe('Phase 6 i18n namespaces have real content in every locale', () => {
  for (const locale of supportedLocales as Locale[]) {
    for (const namespace of namespaces) {
      it(`${namespace} has non-empty strings for every key in ${locale}`, () => {
        const leaves = collectLeaves((uiDictionaries[locale] as Record<string, unknown>)[namespace]);
        expect(leaves.length).toBeGreaterThan(0);
        for (const leaf of leaves) {
          expect(typeof leaf.value).toBe('string');
          expect((leaf.value as string).trim().length).toBeGreaterThan(0);
        }
      });
    }
  }

  it('en and tr have the same set of leaf paths for every new namespace', () => {
    for (const namespace of namespaces) {
      const enPaths = collectLeaves((uiDictionaries.en as Record<string, unknown>)[namespace]).map((l) => l.path).sort();
      const trPaths = collectLeaves((uiDictionaries.tr as Record<string, unknown>)[namespace]).map((l) => l.path).sort();
      expect(trPaths).toEqual(enPaths);
    }
  });
});
