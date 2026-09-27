import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { Text } from './Text';

export interface SectionLabelProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

/**
 * The small-caps, letter-spaced label used above ingredient/step lists,
 * form fields, settings groups, and picker section headers throughout the
 * app. Was independently reimplemented at ~10 call sites; consolidated
 * here so the one visual pattern has one definition.
 */
export function SectionLabel({ children, style }: SectionLabelProps) {
  return (
    <Text variant="label" color="tertiary" style={[styles.base, style]}>
      {children.toUpperCase()}
    </Text>
  );
}

const styles = { base: { letterSpacing: 0.6 } } as const;
