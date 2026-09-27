/**
 * Cocktail.baseSpirit stores a specific ingredient id (e.g. "rye-whiskey")
 * for accurate recipes and ingredient matching. The base-spirit FILTER
 * (Section 8 of the brief) is coarser (e.g. "Whiskey"). This groups the
 * specific id into the filter/visual category.
 */
export type SpiritGroup =
  | 'gin'
  | 'vodka'
  | 'whiskey'
  | 'rum'
  | 'tequila'
  | 'mezcal'
  | 'brandy'
  | 'other'
  | 'alcohol-free';

const groupByIngredientId: Record<string, SpiritGroup> = {
  gin: 'gin',
  vodka: 'vodka',
  bourbon: 'whiskey',
  'rye-whiskey': 'whiskey',
  'scotch-whisky': 'whiskey',
  'irish-whiskey': 'whiskey',
  'white-rum': 'rum',
  'gold-rum': 'rum',
  'dark-rum': 'rum',
  cachaca: 'rum',
  'blanco-tequila': 'tequila',
  mezcal: 'mezcal',
  cognac: 'brandy',
  pisco: 'brandy',
  absinthe: 'other',
  'alcohol-free': 'alcohol-free',

  // Additions batch 2
  'reposado-tequila': 'tequila',
  'anejo-tequila': 'tequila',
  genever: 'gin',
  'old-tom-gin': 'gin',
  'sloe-gin': 'gin',
  'navy-strength-rum': 'rum',
  'spiced-rum': 'rum',
  'coconut-rum': 'rum',
  'rhum-agricole': 'rum',
  'japanese-whisky': 'whiskey',
  'canadian-whisky': 'whiskey',
  'apple-brandy': 'brandy',
  grappa: 'brandy',
};

export function getSpiritGroup(baseSpiritId: string): SpiritGroup {
  return groupByIngredientId[baseSpiritId] ?? 'other';
}

/** Ids only — labels resolved via i18n vocab (tVocab(`spiritGroup.${id}`)) at the presentation layer. */
export const spiritGroupIds: SpiritGroup[] = [
  'gin',
  'vodka',
  'whiskey',
  'rum',
  'tequila',
  'mezcal',
  'brandy',
  'other',
  'alcohol-free',
];
