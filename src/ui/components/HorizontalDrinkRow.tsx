import React from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Cocktail } from '../../domain/types';
import { DrinkCard } from './DrinkCard';

export interface HorizontalDrinkRowProps {
  items: Cocktail[];
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onPress: (id: string) => void;
}

/** Always renders catalog cocktails — every call site (Home sections, related drinks) only ever has those. */
export function HorizontalDrinkRow({ items, isFavorite, onToggleFavorite, onPress }: HorizontalDrinkRowProps) {
  return (
    <FlatList
      horizontal
      data={items}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => (
        <DrinkCard
          source={{ kind: 'cocktail', item }}
          width={148}
          isFavorite={isFavorite(item.id)}
          onToggleFavorite={() => onToggleFavorite(item.id)}
          onPress={() => onPress(item.id)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingHorizontal: 20 },
});
