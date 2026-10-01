import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ingredients } from '../../data/catalog';
import { Ingredient, IngredientCategory } from '../../domain/types';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../theme/useTheme';
import { SearchBar } from './SearchBar';
import { SectionLabel } from './SectionLabel';
import { Text } from './Text';

export interface IngredientPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (ingredient: Ingredient) => void;
  /** Restrict the list, e.g. to spirits only when picking a base spirit. */
  filterCategory?: IngredientCategory;
}

export function IngredientPickerModal({ visible, onClose, onSelect, filterCategory }: IngredientPickerModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const { t, tVocab, tIngredient } = useTranslation();

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = ingredients.filter((i) => {
      if (filterCategory && i.category !== filterCategory) return false;
      return q ? tIngredient(i.id).toLowerCase().includes(q) : true;
    });
    const byCategory = new Map<IngredientCategory, Ingredient[]>();
    for (const ing of filtered) {
      const list = byCategory.get(ing.category) ?? [];
      list.push(ing);
      byCategory.set(ing.category, list);
    }
    return Array.from(byCategory.entries()).map(([category, data]) => ({
      title: tVocab(`ingredientCategory.${category}`),
      data,
    }));
  }, [query, filterCategory, tIngredient, tVocab]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Text variant="title">{t('ingredientPicker.title')}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </Pressable>
        </View>
        <View style={styles.searchWrap}>
          <SearchBar value={query} onChangeText={setQuery} placeholder={t('ingredientPicker.searchPlaceholder')} />
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => (
            <SectionLabel style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
              {section.title}
            </SectionLabel>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={tIngredient(item.id)}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text variant="body">{tIngredient(item.id)}</Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionHeader: { paddingVertical: 8 },
  row: {
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)', // visible in light and dark mode
  },
});
