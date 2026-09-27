import { DiscoveryCollection } from '../domain/discovery';
import { UiKey, VocabKey } from './useTranslation';

type Translate = (key: UiKey, options?: Record<string, string | number | undefined>) => string;
type TranslateVocab = (key: VocabKey) => string;

/** Featured collections are curated/hand-written, so their copy is looked up directly rather than composed. */
const featuredTitleKeys: Record<string, UiKey> = {
  'essential-classics': 'collections.titles.essentialClassics',
  'under-5-minutes': 'collections.titles.under5Minutes',
  'strong-spirit-forward': 'collections.titles.strongSpiritForward',
  'tiki-tropical': 'collections.titles.tikiTropical',
  'low-abv-alcohol-free': 'collections.titles.lowAbvAlcoholFree',
  'beginner-friendly': 'collections.titles.beginnerFriendly',
  'date-night-classics': 'collections.titles.dateNightClassics',
  'party-favorites': 'collections.titles.partyFavorites',
};

const featuredDescriptionKeys: Record<string, UiKey> = {
  'essential-classics': 'collections.descriptions.essentialClassics',
  'under-5-minutes': 'collections.descriptions.under5Minutes',
  'strong-spirit-forward': 'collections.descriptions.strongSpiritForward',
  'tiki-tropical': 'collections.descriptions.tikiTropical',
  'low-abv-alcohol-free': 'collections.descriptions.lowAbvAlcoholFree',
  'beginner-friendly': 'collections.descriptions.beginnerFriendly',
  'date-night-classics': 'collections.descriptions.dateNightClassics',
  'party-favorites': 'collections.descriptions.partyFavorites',
};

/**
 * Resolves a collection's display title. Spirit/style/taste collections
 * compose their title from the same vocab already used for chips/filters
 * (e.g. "Gin" + "Cocktails"), so adding a new spirit or style never
 * requires a new translation. Featured collections use hand-written copy.
 */
export function getCollectionTitle(collection: DiscoveryCollection, t: Translate, tVocab: TranslateVocab): string {
  if (collection.group === 'featured') {
    const key = featuredTitleKeys[collection.id];
    return key ? t(key) : collection.id;
  }
  const suffix = t('collections.cocktailsSuffix');
  if (collection.group === 'spirit') {
    const group = collection.id.replace('spirit-', '');
    return `${tVocab(`searchSpirit.${group}` as VocabKey)} ${suffix}`;
  }
  if (collection.group === 'style') {
    const type = collection.id.replace('style-', '');
    return `${tVocab(`category.${type}` as VocabKey)} ${suffix}`;
  }
  if (collection.group === 'method') {
    const method = collection.id.replace('method-', '');
    return `${tVocab(`method.${method}` as VocabKey)} ${suffix}`;
  }
  const tag = collection.id.replace('taste-', '');
  return `${tVocab(`taste.${tag}` as VocabKey)} ${suffix}`;
}

export function getCollectionDescription(collection: DiscoveryCollection, t: Translate, tVocab: TranslateVocab): string {
  if (collection.group === 'featured') {
    const key = featuredDescriptionKeys[collection.id];
    return key ? t(key) : '';
  }
  if (collection.group === 'spirit') {
    const group = collection.id.replace('spirit-', '');
    return t('collections.spiritDescription', { spirit: tVocab(`searchSpirit.${group}` as VocabKey) });
  }
  if (collection.group === 'style') {
    const type = collection.id.replace('style-', '');
    return t('collections.styleDescription', { style: tVocab(`category.${type}` as VocabKey) });
  }
  if (collection.group === 'method') {
    const method = collection.id.replace('method-', '');
    return t('collections.methodDescription', { method: tVocab(`method.${method}` as VocabKey) });
  }
  const tag = collection.id.replace('taste-', '');
  return t('collections.tasteDescription', { taste: tVocab(`taste.${tag}` as VocabKey) });
}

export function isCuratedCollection(collection: DiscoveryCollection): boolean {
  return collection.kind === 'curated';
}

/** The bare vocab label without the "Cocktails" suffix — for compact chip navigation rows where the surrounding UI already makes the context ("Browse by spirit") clear. */
export function getCollectionShortLabel(collection: DiscoveryCollection, tVocab: TranslateVocab): string {
  if (collection.group === 'spirit') return tVocab(`searchSpirit.${collection.id.replace('spirit-', '')}` as VocabKey);
  if (collection.group === 'style') return tVocab(`category.${collection.id.replace('style-', '')}` as VocabKey);
  if (collection.group === 'taste') return tVocab(`taste.${collection.id.replace('taste-', '')}` as VocabKey);
  if (collection.group === 'method') return tVocab(`method.${collection.id.replace('method-', '')}` as VocabKey);
  return collection.id;
}
