import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Cocktail } from '../../domain/types';
import { CocktailMatch } from '../../domain/matching';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../theme/useTheme';
import { DrinkVisual } from './DrinkVisual';
import { Text } from './Text';

export interface MatchListRowProps {
  match: CocktailMatch<Cocktail>;
  onPress: () => void;
}

/**
 * A row for a match that needs disclosure beyond a plain "you have
 * everything" card:
 * - a partial match ("Almost there" / "More options") — shows exactly
 *   what's missing, with a curated substitute *suggestion* where one
 *   exists (a purchase tip — by construction the user doesn't have that
 *   substitute either, or the ingredient wouldn't be missing).
 * - a full match reached only via a substitute already in inventory — shows
 *   exactly which swap is being relied on, so "You Can Make Now" never
 *   silently implies the user owns an ingredient they don't.
 */
export function MatchListRow({ match, onPress }: MatchListRowProps) {
  const theme = useTheme();
  const { t, tIngredient } = useTranslation();
  const { item } = match;
  const isSubstitutionDisclosure = match.missing.length === 0 && match.substitutions.length > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      style={({ pressed }) => [styles.row, { backgroundColor: theme.colors.surfaceAlt, opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={styles.thumb}>
        <DrinkVisual source={{ kind: 'cocktail', item }} height={56} borderRadius={theme.radii.sm} />
      </View>
      <View style={styles.textCol}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {item.name}
        </Text>
        {isSubstitutionDisclosure ? (
          <Text variant="caption" color="secondary" numberOfLines={2}>
            {match.substitutions
              .map((s) => t('ingredientsTool.usingInstead', { have: tIngredient(s.substituteId), need: tIngredient(s.ingredientId) }))
              .join(', ')}
          </Text>
        ) : (
          <Text variant="caption" color="secondary" numberOfLines={2}>
            {t('ingredientsTool.missingCount', { count: match.missing.length })}
            {': '}
            {match.missing
              .map((m) => (m.substituteId ? `${tIngredient(m.ingredientId)} (${t('ingredientsTool.orUse', { name: tIngredient(m.substituteId) })})` : tIngredient(m.ingredientId)))
              .join(', ')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: 14, alignItems: 'center' },
  thumb: { width: 56, height: 56, overflow: 'hidden', borderRadius: 10 },
  textCol: { flex: 1, gap: 2 },
});
