/**
 * A finer browse-by-spirit taxonomy than SpiritGroup (spiritGroups.ts,
 * which the Filters sheet uses) — built for Search's richer discovery
 * chips, e.g. splitting "Whiskey" into Bourbon/Rye/Scotch/Irish. Curated
 * statically here (not derived from the ingredient catalog) to keep domain
 * code free of a dependency on the data layer — extend this list by hand
 * as new base spirits are added to the catalog.
 */
export type SearchSpiritId =
  | 'gin'
  | 'vodka'
  | 'bourbon'
  | 'rye'
  | 'scotch'
  | 'irish-whiskey'
  | 'rum'
  | 'tequila'
  | 'mezcal'
  | 'cognac'
  | 'vermouth'
  | 'wine'
  | 'liqueur'
  | 'alcohol-free';

const idsBySearchSpirit: Record<SearchSpiritId, string[]> = {
  gin: ['gin', 'genever', 'old-tom-gin'],
  vodka: ['vodka'],
  bourbon: ['bourbon'],
  rye: ['rye-whiskey'],
  scotch: ['scotch-whisky'],
  'irish-whiskey': ['irish-whiskey'],
  rum: ['white-rum', 'gold-rum', 'dark-rum', 'cachaca', 'navy-strength-rum', 'spiced-rum', 'coconut-rum', 'rhum-agricole'],
  tequila: ['blanco-tequila', 'reposado-tequila', 'anejo-tequila'],
  mezcal: ['mezcal'],
  cognac: ['cognac', 'pisco', 'apple-brandy', 'grappa'],
  vermouth: ['dry-vermouth', 'sweet-vermouth', 'blanc-vermouth'],
  wine: ['prosecco', 'champagne', 'still-white-wine', 'red-wine', 'stout-beer', 'beer', 'sherry', 'port-wine', 'rose-wine', 'moscato', 'aperitif-wine'],
  liqueur: [
    'campari',
    'aperol',
    'amaretto',
    'coffee-liqueur',
    'triple-sec',
    'creme-de-cacao',
    'creme-de-menthe',
    'benedictine',
    'lillet-blanc',
    'drambuie',
    'green-chartreuse',
    'yellow-chartreuse',
    'amaro-nonino',
    'sloe-gin',
    'elderflower-liqueur',
    'vanilla-liqueur',
    'melon-liqueur',
    'hazelnut-liqueur',
    'sambuca',
    'herbal-digestif-liqueur',
    'fernet',
    'artichoke-amaro',
    'gentian-liqueur',
    'fruit-cup-liqueur',
    'peach-whiskey-liqueur',
    'irish-cream-liqueur',
    'blue-curacao',
    'orange-curacao',
    'banana-liqueur',
    'peach-liqueur',
    'apricot-liqueur',
  ],
  'alcohol-free': ['alcohol-free'],
};

/** Ids only — labels resolved via i18n vocab (`tVocab('searchSpirit.<id>')`) at the presentation layer. */
export const searchSpiritIds: SearchSpiritId[] = Object.keys(idsBySearchSpirit) as SearchSpiritId[];

export function getBaseSpiritIdsFor(searchSpirit: SearchSpiritId): string[] {
  return idsBySearchSpirit[searchSpirit];
}

export function bySearchSpirit(searchSpirit: SearchSpiritId): (cocktail: { baseSpirit: string }) => boolean {
  const ids = new Set(getBaseSpiritIdsFor(searchSpirit));
  return (cocktail) => ids.has(cocktail.baseSpirit);
}
