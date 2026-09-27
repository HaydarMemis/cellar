import { discoveryCollections } from '../../domain/discovery';
import { getCollectionDescription, getCollectionShortLabel, getCollectionTitle } from '../collectionLabels';
import { uiDictionaries, vocabDictionaries } from '../dictionaries';
import { translateFrom } from '../translate';
import { Locale } from '../types';

function makeTranslators(locale: Locale) {
  const t = (key: string, options?: Record<string, string | number | undefined>) =>
    translateFrom(uiDictionaries[locale], key, options);
  const tVocab = (key: string) => {
    const raw = key.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), vocabDictionaries[locale]);
    return typeof raw === 'string' ? raw : key;
  };
  return { t: t as never, tVocab: tVocab as never };
}

describe('collection labels', () => {
  it('resolves a non-empty title for every collection, in both languages', () => {
    for (const locale of ['en', 'tr'] as Locale[]) {
      const { t, tVocab } = makeTranslators(locale);
      for (const collection of discoveryCollections) {
        const title = getCollectionTitle(collection, t, tVocab);
        expect(title.trim().length).toBeGreaterThan(0);
        // A missing key would resolve to the raw key path (contains a dot) rather than real text.
        expect(title).not.toMatch(/^collections\./);
      }
    }
  });

  it('resolves a non-empty description for every collection, in both languages', () => {
    for (const locale of ['en', 'tr'] as Locale[]) {
      const { t, tVocab } = makeTranslators(locale);
      for (const collection of discoveryCollections) {
        const description = getCollectionDescription(collection, t, tVocab);
        expect(description.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves a short label for every spirit/style/taste collection', () => {
    const { tVocab } = makeTranslators('en');
    for (const collection of discoveryCollections) {
      if (collection.group === 'featured') continue;
      expect(getCollectionShortLabel(collection, tVocab).trim().length).toBeGreaterThan(0);
    }
  });
});
