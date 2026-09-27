import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Every empty list in the app renders through this rather than a generic
 * "No data found" — see project plan, Section 21.
 */
export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
        <Ionicons name={icon} size={28} color={theme.colors.textSecondary} />
      </View>
      <Text variant="headline" style={styles.title}>
        {title}
      </Text>
      <Text variant="body" color="secondary" style={styles.message}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { textAlign: 'center', marginBottom: 6 },
  message: { textAlign: 'center' },
  action: { marginTop: 20 },
});
