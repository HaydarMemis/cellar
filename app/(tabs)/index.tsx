import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cocktails } from '../../src/data/catalog';
import {
  getBasedOnYourBar,
  getFeatured,
  getGreetingId,
  GreetingId,
  getPopularClassics,
  getQuickAndEasy,
  getSomethingSour,
} from '../../src/domain/homeSections';
import { useTranslation, UiKey } from '../../src/i18n/useTranslation';
import { HorizontalDrinkRow } from '../../src/ui/components/HorizontalDrinkRow';
import { IngredientsBanner } from '../../src/ui/components/IngredientsBanner';
import { Screen } from '../../src/ui/components/Screen';
import { SectionHeader } from '../../src/ui/components/SectionHeader';
import { Text } from '../../src/ui/components/Text';
import { useFavoritesStore } from '../../src/state/favoritesStore';
import { useInventoryStore } from '../../src/state/inventoryStore';
import { useTheme } from '../../src/theme/useTheme';

const greetingKeys: Record<GreetingId, UiKey> = {
  night: 'home.greetingNight',
  morning: 'home.greetingMorning',
  afternoon: 'home.greetingAfternoon',
  evening: 'home.greetingEvening',
};

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const greetingId = useMemo(() => getGreetingId(), []);
  const greeting = t(greetingKeys[greetingId]);

  const favorites = useFavoritesStore((s) => s.favorites);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);
  const toggleFavorite = useFavoritesStore((s) => s.toggle);
  const inventoryEntries = useInventoryStore((s) => s.entries);
  const inventoryIds = useMemo(
    () => new Set(inventoryEntries.map((e) => e.ingredientId)),
    [inventoryEntries],
  );

  const featured = useMemo(() => getFeatured(cocktails), []);
  const popularClassics = useMemo(() => getPopularClassics(cocktails), []);
  const quickAndEasy = useMemo(() => getQuickAndEasy(cocktails), []);
  const somethingSour = useMemo(() => getSomethingSour(cocktails), []);
  const basedOnBar = useMemo(() => getBasedOnYourBar(cocktails, inventoryIds), [inventoryIds]);

  const favoriteCocktails = useMemo(
    () =>
      favorites
        .filter((f) => f.targetType === 'cocktail')
        .map((f) => cocktails.find((c) => c.id === f.targetId))
        .filter((c): c is (typeof cocktails)[number] => !!c),
    [favorites],
  );

  const openCocktail = (id: string) => router.push({ pathname: '/cocktail/[id]', params: { id, type: 'cocktail' } });

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text variant="display">{greeting}</Text>
          <Text variant="body" color="secondary">
            {t('home.subtitle')}
          </Text>
        </View>

        <View style={styles.bannerWrap}>
          <IngredientsBanner />
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('home.sectionFeatured')} />
          <HorizontalDrinkRow
            items={featured}
            isFavorite={(id) => isFavorite('cocktail', id)}
            onToggleFavorite={(id) => toggleFavorite('cocktail', id)}
            onPress={openCocktail}
          />
        </View>

        {basedOnBar.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title={t('home.sectionBasedOnYourBar')} />
            <HorizontalDrinkRow
              items={basedOnBar}
              isFavorite={(id) => isFavorite('cocktail', id)}
              onToggleFavorite={(id) => toggleFavorite('cocktail', id)}
              onPress={openCocktail}
            />
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title={t('home.sectionPopularClassics')} />
          <HorizontalDrinkRow
            items={popularClassics}
            isFavorite={(id) => isFavorite('cocktail', id)}
            onToggleFavorite={(id) => toggleFavorite('cocktail', id)}
            onPress={openCocktail}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('home.sectionQuickAndEasy')} />
          <HorizontalDrinkRow
            items={quickAndEasy}
            isFavorite={(id) => isFavorite('cocktail', id)}
            onToggleFavorite={(id) => toggleFavorite('cocktail', id)}
            onPress={openCocktail}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('home.sectionSomethingSour')} />
          <HorizontalDrinkRow
            items={somethingSour}
            isFavorite={(id) => isFavorite('cocktail', id)}
            onToggleFavorite={(id) => toggleFavorite('cocktail', id)}
            onPress={openCocktail}
          />
        </View>

        {favoriteCocktails.length > 0 && (
          <View style={[styles.section, { marginBottom: theme.spacing.xl }]}>
            <SectionHeader title={t('home.sectionYourFavorites')} />
            <HorizontalDrinkRow
              items={favoriteCocktails}
              isFavorite={(id) => isFavorite('cocktail', id)}
              onToggleFavorite={(id) => toggleFavorite('cocktail', id)}
              onPress={openCocktail}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24, gap: 28 },
  header: { paddingHorizontal: 20, gap: 4 },
  section: { gap: 12 },
  bannerWrap: { paddingHorizontal: 20 },
});
