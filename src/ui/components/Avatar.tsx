import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { getAvatarTone } from '../../theme/avatarPalette';
import { Text } from './Text';

export interface AvatarProps {
  seed: string;
  label: string;
  size: number;
  /** Optional profile photo URL (UserProfile.avatarUrl). Falls back to the monogram when absent or when it fails to load. */
  uri?: string;
}

/**
 * The monogram letter: the first user-perceived character (Array.from keeps
 * surrogate pairs such as emoji or accented letters intact), upper-cased
 * with the Turkish rules when the name is Turkish-looking (i → İ, ı → I).
 * Exported for tests.
 */
export function avatarInitial(label: string): string {
  const first = Array.from(label.trim())[0];
  if (!first) return '?';
  return /[ıİğĞşŞçÇöÖüÜ]/.test(label) ? first.toLocaleUpperCase('tr-TR') : first.toLocaleUpperCase();
}

/**
 * Metrics for the centered initial. The line box is set to EXACTLY the font
 * size: the shared Text component otherwise inherits the body style's fixed
 * lineHeight (22), which is smaller than the glyph at large avatar sizes and
 * larger at small ones — iOS then positions the glyph by ascent/descent
 * inside that box and the letter visibly drifts off-center. Font scaling is
 * disabled because the circle itself doesn't grow with Dynamic Type (the
 * name is always shown next to the avatar as regular, scalable text).
 */
export function avatarInitialMetrics(size: number): { fontSize: number; lineHeight: number } {
  const fontSize = Math.round(size * 0.42);
  return { fontSize, lineHeight: fontSize };
}

/**
 * Whether to render the photo: only when there is one and it hasn't already
 * failed to load. A failure is remembered per URL, so a NEW photo (new
 * `?v=` cache-buster) is tried again. Exported for tests.
 */
export function shouldShowAvatarImage(uri: string | undefined, failedUri: string | null): uri is string {
  return !!uri && uri !== failedUri;
}

/** A profile photo when the user has one, otherwise a colored-initial avatar keyed off `seed` (a user id/username) — the same abstract identity system the catalog uses in place of photography. */
export function Avatar({ seed, label, size, uri }: AvatarProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (shouldShowAvatarImage(uri, failedUri)) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, circle]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
        accessibilityIgnoresInvertColors
        onError={() => setFailedUri(uri)}
      />
    );
  }

  const tone = getAvatarTone(seed);
  const initial = avatarInitial(label);
  const metrics = avatarInitialMetrics(size);

  return (
    <LinearGradient colors={[tone.from, tone.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.circle, circle]}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.initial, metrics, { color: tone.ink }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {initial}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  image: { overflow: 'hidden' },
  initial: { fontWeight: '600', textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' },
});
