import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cocktails, ingredientsById } from '../../src/data/catalog';
import { getCocktailsUsingIngredient, getRelatedIngredients } from '../../src/domain/ingredientRelations';
import { getSubstitutesFor, getSubstitutionNoteKey } from '../../src/domain/substitutions';
import { useTranslation } from '../../src/i18n/useTranslation';
import { Chip } from '../../src/ui/components/Chip';
import { DrinkCard } from '../../src/ui/components/DrinkCard';
import { Screen } from '../../src/ui/components/Screen';
import { SectionLabel } from '../../src/ui/components/SectionLabel';
import { Text } from '../../src/ui/components/Text';
import { useFavoritesStore } from '../../src/state/favoritesStore';
import { useTheme } from '../../src/theme/useTheme';

export default function IngredientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, tVocab, tIngredient, tIngredientContent, tAmount } = useTranslation();
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);

  const ingredient = ingredientsById.get(id);

  const usedIn = useMemo(() => (ingredient ? getCocktailsUsingIngredient(ingredient.id, cocktails) : []), [ingredient]);
  const related = useMemo(() => (ingredient ? getRelatedIngredients(ingredient.id, cocktails) : []), [ingredient]);
  const substitutes = useMemo(() => (ingredient ? getSubstitutesFor(ingredient.id) : []), [ingredient]);
  const content = useMemo(() => (ingredient ? tIngredientContent(ingredient) : null), [ingredient, tIngredientContent]);

  if (!ingredient) {
    return (
      <Screen>
        <View style={[styles.notFound, { paddingTop: insets.top + 40 }]}>
          <Text variant="headline">{t('cocktailDetail.notFound')}</Text>
        </View>
      </Screen>
    );
  }

  const openIngredient = (ingredientId: string) => router.push({ pathname: '/ingredient/[id]', params: { id: ingredientId } });
  const openCocktail = (cocktailId: string) => router.push({ pathname: '/cocktail/[id]', params: { id: cocktailId, type: 'cocktail' } });

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="display">{tIngredient(ingredient.id)}</Text>
        <View style={styles.metaRow}>
          <MetaPill label={tVocab(`ingredientCategory.${ingredient.category}`)} />
          <MetaPill label={t('ingredientDetail.usedIn', { count: usedIn.length })} />
          {ingredient.isHomemade && <MetaPill label={t('ingredientDetail.homemadeBadge')} />}
        </View>

        {content?.description ? (
          <Text variant="body" color="secondary" style={styles.description}>
            {content.description}
          </Text>
        ) : null}

        {ingredient.flavorProfile && ingredient.flavorProfile.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>{t('ingredientDetail.flavorProfileSection')}</SectionLabel>
            <View style={styles.chipRow}>
              {ingredient.flavorProfile.map((note) => (
                <Chip key={note} label={tVocab(`flavor.${note}`)} />
              ))}
            </View>
          </View>
        )}

        {ingredient.homemadeRecipe && (
          <View style={styles.section}>
            <SectionLabel>{t('ingredientDetail.homemadeSection')}</SectionLabel>
            <View style={[styles.homemadeCard, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Text variant="caption" color="secondary">
                {t('ingredientDetail.homemadeYield', { amount: tAmount(ingredient.homemadeRecipe.yield, 'ml') })}
              </Text>

              <Text variant="captionStrong" color="secondary" style={styles.homemadeSubLabel}>
                {t('ingredientDetail.homemadeIngredients')}
              </Text>
              {ingredient.homemadeRecipe.ingredients.map((ri, index) => (
                <Text key={index} variant="body" style={styles.homemadeIngredientRow}>
                  {ri.amount ? `${tAmount(ri.amount, 'ml')} ` : ''}
                  {tIngredient(ri.ingredientId)}
                </Text>
              ))}

              <Text variant="captionStrong" color="secondary" style={styles.homemadeSubLabel}>
                {t('ingredientDetail.homemadeSteps')}
              </Text>
              {(content?.homemadeSteps ?? []).map((step, index) => (
                <View key={index} style={styles.stepRow}>
                  <Text variant="caption" color="tertiary" style={styles.stepIndex}>
                    {index + 1}
                  </Text>
                  <Text variant="body" style={{ flex: 1 }}>
                    {step}
                  </Text>
                </View>
              ))}

              {content?.homemadeStorageNote ? (
                <>
                  <Text variant="captionStrong" color="secondary" style={styles.homemadeSubLabel}>
                    {t('ingredientDetail.homemadeStorage')}
                  </Text>
                  <Text variant="body" color="secondary">
                    {content.homemadeStorageNote}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        )}

        {usedIn.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>{t('ingredientDetail.cocktailsSection')}</SectionLabel>
            <View style={styles.grid}>
              {usedIn.map((cocktail) => (
                <View key={cocktail.id} style={styles.gridItem}>
                  <DrinkCard
                    source={{ kind: 'cocktail', item: cocktail }}
                    isFavorite={isFavorite('cocktail', cocktail.id)}
                    onToggleFavorite={() => toggleFavorite('cocktail', cocktail.id)}
                    onPress={() => openCocktail(cocktail.id)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {related.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>{t('ingredientDetail.relatedSection')}</SectionLabel>
            <View style={styles.chipRow}>
              {related.map((relatedId) => (
                <Chip key={relatedId} label={tIngredient(relatedId)} onPress={() => openIngredient(relatedId)} />
              ))}
            </View>
          </View>
        )}

        {substitutes.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>{t('ingredientDetail.substitutesSection')}</SectionLabel>
            <View style={{ gap: 10 }}>
              {substitutes.map((substituteId) => {
                const noteKey = getSubstitutionNoteKey(ingredient.id, substituteId);
                return (
                  <Pressable
                    key={substituteId}
                    onPress={() => openIngredient(substituteId)}
                    accessibilityRole="button"
                    accessibilityLabel={tIngredient(substituteId)}
                    style={[styles.substituteCard, { backgroundColor: theme.colors.surfaceAlt }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{tIngredient(substituteId)}</Text>
                      {noteKey ? (
                        <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
                          {t(`substitutions.notes.${noteKey}` as never)}
                        </Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function MetaPill({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.metaPill, { backgroundColor: theme.colors.surfaceAlt }]}>
      <Text variant="captionStrong" color="secondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  description: { marginTop: 14, lineHeight: 21 },
  homemadeCard: { borderRadius: 14, padding: 16, gap: 4 },
  homemadeSubLabel: { marginTop: 14, marginBottom: 6 },
  homemadeIngredientRow: { paddingVertical: 2 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 3 },
  stepIndex: { width: 16, marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  metaPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  section: { marginTop: 28, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { width: '46%' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  substituteCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, gap: 10 },
  notFound: { paddingHorizontal: 20 },
});
