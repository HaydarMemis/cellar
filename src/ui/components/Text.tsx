import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { TypographyVariant } from '../../theme/typography';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent';
}

export function Text({ variant = 'body', color = 'primary', style, ...rest }: TextProps) {
  const theme = useTheme();
  const colorMap = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    accent: theme.colors.accent,
    onAccent: theme.colors.onAccent,
  };

  return (
    <RNText
      // Respects the user's OS text-size setting for accessibility rather than
      // capping/overriding font scale.
      style={[theme.typography[variant], { color: colorMap[color] }, style]}
      {...rest}
    />
  );
}
