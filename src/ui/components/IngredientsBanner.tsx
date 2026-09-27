import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../theme/useTheme';
import { Text } from './Text';

/** The entry point for the "I Have These Ingredients" tool — surfaced on
 * Home and Search rather than given its own tab, since it's a discovery
 * tool, not a browsing destination. See project plan, Section 3. */
export function IngredientsBanner() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => router.push('/ingredients-i-have')}
      accessibilityRole="button"
      accessibilityLabel={t('ingredientsTool.bannerTitle')}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: theme.colors.accentSoft, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.accent }]}>
        <Ionicons name="flask-outline" size={18} color={theme.colors.onAccent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{t('ingredientsTool.bannerTitle')}</Text>
        <Text variant="caption" color="secondary">
          {t('ingredientsTool.bannerSubtitle')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
