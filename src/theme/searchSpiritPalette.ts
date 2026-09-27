import { SearchSpiritId } from '../domain/searchSpirits';
import { SpiritTone } from './spiritPalette';

/** Tile colors for Search's finer spirit grid — same abstract duotone identity as the rest of the catalog, just keyed to the richer SearchSpiritId set. */
const tones: Record<SearchSpiritId, SpiritTone> = {
  gin: { from: '#3E5B49', to: '#20362A', ink: '#EFF3EE' },
  vodka: { from: '#4E6478', to: '#293748', ink: '#EFF2F5' },
  bourbon: { from: '#8A5A2B', to: '#4A2C11', ink: '#FBF1E4' },
  rye: { from: '#9C6B33', to: '#523714', ink: '#FBF1E4' },
  scotch: { from: '#6E5636', to: '#382C1B', ink: '#F4EEE4' },
  'irish-whiskey': { from: '#7C6440', to: '#3F3320', ink: '#F6F0E6' },
  rum: { from: '#A15A2C', to: '#5A2C11', ink: '#FBF0E3' },
  tequila: { from: '#B15E3B', to: '#63311B', ink: '#FBF0E6' },
  mezcal: { from: '#8C5A3E', to: '#4A2C1C', ink: '#F8EEE4' },
  cognac: { from: '#7A3B34', to: '#3F1E19', ink: '#F7EAE7' },
  vermouth: { from: '#7A4A5C', to: '#3F2530', ink: '#F6EAEE' },
  wine: { from: '#6B2F3A', to: '#38181E', ink: '#F3E6E9' },
  liqueur: { from: '#8C3F52', to: '#48202A', ink: '#F7E8EC' },
  'alcohol-free': { from: '#7E9142', to: '#3F4A20', ink: '#F3F6E9' },
};

export function getSearchSpiritTone(id: SearchSpiritId): SpiritTone {
  return tones[id];
}
