import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { Text } from './Text';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const theme = useTheme();

  const background =
    variant === 'primary' ? theme.colors.accent : variant === 'secondary' ? theme.colors.surfaceAlt : 'transparent';
  const textColor = variant === 'primary' ? 'onAccent' : variant === 'secondary' ? 'primary' : 'accent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: background, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {/* Centered and allowed to wrap onto a second line rather than overflow
          the button when a translation is longer (e.g. "Create account"). */}
      <Text variant="bodyStrong" color={textColor} style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  label: { textAlign: 'center' },
});
