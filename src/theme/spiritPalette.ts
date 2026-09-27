import { getSpiritGroup, SpiritGroup } from '../domain/spiritGroups';

/**
 * Abstract visual identity for the catalog: since built-in cocktails ship
 * without photography (see project plan), each hero/card surface is a
 * duotone keyed to the cocktail's spirit group rather than a placeholder
 * image. Personal recipes with a user-supplied photo bypass this entirely.
 */
export interface SpiritTone {
  from: string;
  to: string;
  ink: string; // text/icon color that sits on top of this tone
}

const tones: Record<SpiritGroup, SpiritTone> = {
  gin: { from: '#3E5B49', to: '#20362A', ink: '#EFF3EE' },
  vodka: { from: '#4E6478', to: '#293748', ink: '#EFF2F5' },
  whiskey: { from: '#8A5A2B', to: '#4A2C11', ink: '#FBF1E4' },
  rum: { from: '#A15A2C', to: '#5A2C11', ink: '#FBF0E3' },
  tequila: { from: '#B15E3B', to: '#63311B', ink: '#FBF0E6' },
  mezcal: { from: '#8C5A3E', to: '#4A2C1C', ink: '#F8EEE4' },
  brandy: { from: '#7A3B34', to: '#3F1E19', ink: '#F7EAE7' },
  other: { from: '#5C5650', to: '#302C28', ink: '#F1EDE7' },
  'alcohol-free': { from: '#7E9142', to: '#3F4A20', ink: '#F3F6E9' },
};

export function getSpiritTone(baseSpirit: string): SpiritTone {
  return tones[getSpiritGroup(baseSpirit)];
}
