import { SpiritTone } from './spiritPalette';

/**
 * The same abstract duotone visual identity used for cocktails (see
 * spiritPalette.ts) applied to creator avatars — no photo-upload pipeline
 * exists, so every profile gets a deterministic colored-initial mark instead
 * of a broken-image placeholder.
 */
const avatarTones: SpiritTone[] = [
  { from: '#3E5B49', to: '#20362A', ink: '#EFF3EE' },
  { from: '#4E6478', to: '#293748', ink: '#EFF2F5' },
  { from: '#8A5A2B', to: '#4A2C11', ink: '#FBF1E4' },
  { from: '#A15A2C', to: '#5A2C11', ink: '#FBF0E3' },
  { from: '#7A3B34', to: '#3F1E19', ink: '#F7EAE7' },
  { from: '#5C5650', to: '#302C28', ink: '#F1EDE7' },
  { from: '#7E9142', to: '#3F4A20', ink: '#F3F6E9' },
  { from: '#63311B', to: '#B15E3B', ink: '#FBF0E6' },
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getAvatarTone(seed: string): SpiritTone {
  return avatarTones[hashSeed(seed) % avatarTones.length];
}
