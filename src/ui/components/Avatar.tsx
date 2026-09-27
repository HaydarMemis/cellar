import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet } from 'react-native';
import { getAvatarTone } from '../../theme/avatarPalette';
import { Text } from './Text';

export interface AvatarProps {
  seed: string;
  label: string;
  size: number;
}

/** A colored-initial avatar, keyed off `seed` (a user id/username) — the same abstract identity system the catalog uses in place of photography. */
export function Avatar({ seed, label, size }: AvatarProps) {
  const tone = getAvatarTone(seed);
  const initial = label.trim().charAt(0).toUpperCase() || '?';

  return (
    <LinearGradient
      colors={[tone.from, tone.to]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={{ color: tone.ink, fontSize: size * 0.42, fontWeight: '600' }}>{initial}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
