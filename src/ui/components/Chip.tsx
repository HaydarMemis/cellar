import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityHint?: string;
}

export function Chip({ label, selected = false, onPress, accessibilityHint }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityHint={accessibilityHint}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceAlt,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text variant="captionStrong" color={selected ? 'onAccent' : 'secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 36,
    justifyContent: 'center',
  },
});
