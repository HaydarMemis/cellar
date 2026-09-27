import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export function Screen({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return <View style={[styles.base, { backgroundColor: theme.colors.background }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: { flex: 1 },
});
