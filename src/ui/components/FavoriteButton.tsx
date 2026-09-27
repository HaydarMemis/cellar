import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../theme/useTheme';

export interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  size?: number;
  /** Set false when placed on a dark hero image/tone so the resting icon reads. */
  onLightSurface?: boolean;
}

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

export function FavoriteButton({ isFavorite, onToggle, size = 22, onLightSurface = true }: FavoriteButtonProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const restingColor = onLightSurface ? theme.colors.textSecondary : '#FFFFFF';
  const scale = useSharedValue(1);
  const wasFavorite = React.useRef(isFavorite);

  useEffect(() => {
    if (isFavorite && !wasFavorite.current) {
      scale.value = withSequence(withTiming(1.3, { duration: 120 }), withTiming(1, { duration: 140 }));
    }
    wasFavorite.current = isFavorite;
  }, [isFavorite, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    if (!isFavorite) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    onToggle();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isFavorite ? t('cocktailDetail.removeFromFavorites') : t('cocktailDetail.addToFavorites')}
      accessibilityState={{ selected: isFavorite }}
      style={({ pressed }) => [styles.hit, { opacity: pressed ? 0.7 : 1 }]}
    >
      <AnimatedIonicons
        name={isFavorite ? 'heart' : 'heart-outline'}
        size={size}
        color={isFavorite ? theme.colors.favorite : restingColor}
        style={animatedStyle}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 44x44 meets the iOS/Android minimum touch target guideline even though
  // the icon itself renders smaller.
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
