import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cocktails } from '../src/data/catalog';
import { activeFilterCount, matchesFilters } from '../src/domain/search';
import { difficultyOptionIds, tasteOptionIds, typeOptionIds } from '../src/domain/filterOptions';
import { spiritGroupIds } from '../src/domain/spiritGroups';
import { useTranslation } from '../src/i18n/useTranslation';
import { Button } from '../src/ui/components/Button';
import { Chip } from '../src/ui/components/Chip';
import { Screen } from '../src/ui/components/Screen';
import { Text } from '../src/ui/components/Text';
import { useFilterStore } from '../src/state/filterStore';
import { useTheme } from '../src/theme/useTheme';

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

const timeOptions: { minutes: 5 | 10; labelKey: 'filters.timeUnder5' | 'filters.timeUnder10' }[] = [
  { minutes: 5, labelKey: 'filters.timeUnder5' },
  { minutes: 10, labelKey: 'filters.timeUnder10' },
];

/**
 * Filter semantics (see src/domain/__tests__/search.test.ts and
 * filters.test.ts for the tested behavior):
 * - Within one category (e.g. multiple selected tastes), values are OR'd —
 *   selecting "Sour" and "Sweet" returns cocktails matching EITHER.
 * - Across categories (spirit + taste + type + difficulty + time +
 *   alcohol-free), the result must satisfy ALL active categories (AND).
 *   e.g. Gin + Sour returns only cocktails that are both gin-based AND sour.
 */
export default function FiltersModal() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, tVocab } = useTranslation();
  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);
  const reset = useFilterStore((s) => s.reset);

  const count = activeFilterCount(filters);
  const resultCount = useMemo(() => cocktails.filter((c) => matchesFilters(c, filters)).length, [filters]);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.alcoholFreeOnly) {
      chips.push({ key: 'alcoholFree', label: t('search.alcoholFree'), onRemove: () => setFilters({ ...filters, alcoholFreeOnly: false }) });
    }
    for (const id of filters.baseSpirits) {
      chips.push({ key: `spirit-${id}`, label: tVocab(`spiritGroup.${id}` as never), onRemove: () => setFilters({ ...filters, baseSpirits: toggle(filters.baseSpirits, id) }) });
    }
    for (const id of filters.tastes) {
      chips.push({ key: `taste-${id}`, label: tVocab(`taste.${id}` as never), onRemove: () => setFilters({ ...filters, tastes: toggle(filters.tastes, id) }) });
    }
    for (const id of filters.types) {
      chips.push({ key: `type-${id}`, label: tVocab(`category.${id}` as never), onRemove: () => setFilters({ ...filters, types: toggle(filters.types, id) }) });
    }
    for (const id of filters.difficulties) {
      chips.push({ key: `difficulty-${id}`, label: tVocab(`difficulty.${id}` as never), onRemove: () => setFilters({ ...filters, difficulties: toggle(filters.difficulties, id) }) });
    }
    if (filters.maxPrepTimeMinutes !== null) {
      const opt = timeOptions.find((o) => o.minutes === filters.maxPrepTimeMinutes);
      chips.push({ key: 'time', label: opt ? t(opt.labelKey) : '', onRemove: () => setFilters({ ...filters, maxPrepTimeMinutes: null }) });
    }
    return chips;
  }, [filters, t, tVocab, setFilters]);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text variant="title">{t('filters.title')}</Text>
          <Text variant="caption" color="secondary">
            {t('filters.resultCount', { count: resultCount })}
          </Text>
        </View>
        {count > 0 && <Button label={t('filters.clearAll')} variant="ghost" onPress={reset} />}
      </View>

      {activeChips.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChipsRow}>
          {activeChips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={chip.onRemove}
              accessibilityRole="button"
              accessibilityLabel={`${chip.label}. ${t('filters.removeFilter')}`}
              style={[styles.activeChip, { backgroundColor: theme.colors.accent }]}
            >
              <Text variant="captionStrong" color="onAccent">
                {chip.label}
              </Text>
              <Ionicons name="close" size={14} color={theme.colors.onAccent} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title={t('filters.sectionAlcohol')}>
          <Chip
            label={t('search.alcoholFree')}
            selected={filters.alcoholFreeOnly}
            onPress={() => setFilters({ ...filters, alcoholFreeOnly: !filters.alcoholFreeOnly })}
          />
        </Section>

        <Section title={t('filters.sectionBaseSpirit')}>
          {spiritGroupIds.map((id) => (
            <Chip
              key={id}
              label={tVocab(`spiritGroup.${id}`)}
              selected={filters.baseSpirits.includes(id)}
              onPress={() => setFilters({ ...filters, baseSpirits: toggle(filters.baseSpirits, id) })}
            />
          ))}
        </Section>

        <Section title={t('filters.sectionTaste')}>
          {tasteOptionIds.map((id) => (
            <Chip
              key={id}
              label={tVocab(`taste.${id}`)}
              selected={filters.tastes.includes(id)}
              onPress={() => setFilters({ ...filters, tastes: toggle(filters.tastes, id) })}
            />
          ))}
        </Section>

        <Section title={t('filters.sectionType')}>
          {typeOptionIds.map((id) => (
            <Chip
              key={id}
              label={tVocab(`category.${id}`)}
              selected={filters.types.includes(id)}
              onPress={() => setFilters({ ...filters, types: toggle(filters.types, id) })}
            />
          ))}
        </Section>

        <Section title={t('filters.sectionDifficulty')}>
          {difficultyOptionIds.map((id) => (
            <Chip
              key={id}
              label={tVocab(`difficulty.${id}`)}
              selected={filters.difficulties.includes(id)}
              onPress={() => setFilters({ ...filters, difficulties: toggle(filters.difficulties, id) })}
            />
          ))}
        </Section>

        <Section title={t('filters.sectionTime')}>
          {timeOptions.map((opt) => (
            <Chip
              key={opt.minutes}
              label={t(opt.labelKey)}
              selected={filters.maxPrepTimeMinutes === opt.minutes}
              onPress={() =>
                setFilters({
                  ...filters,
                  maxPrepTimeMinutes: filters.maxPrepTimeMinutes === opt.minutes ? null : opt.minutes,
                })
              }
            />
          ))}
        </Section>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: theme.colors.border }]}>
        {resultCount === 0 ? (
          <Text variant="caption" color="secondary" style={styles.zeroResultsNote}>
            {t('filters.zeroResultsNote')}
          </Text>
        ) : null}
        <Button
          label={t('filters.showResultsWithCount', { count: resultCount })}
          onPress={() => router.back()}
          disabled={resultCount === 0 && count > 0}
        />
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="headline" style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  activeChipsRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 24 },
  section: { gap: 12 },
  sectionTitle: { marginBottom: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  zeroResultsNote: { textAlign: 'center' },
});
