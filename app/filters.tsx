import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cocktails } from '../src/data/catalog';
import { activeFilterCount, matchesFilters } from '../src/domain/search';
import { difficultyOptionIds, tasteOptionIds, typeOptionIds } from '../src/domain/filterOptions';
import { spiritGroupIds } from '../src/domain/spiritGroups';
import { useTranslation } from '../src/i18n/useTranslation';
import { Button } from '../src/ui/components/Button';
import { Screen } from '../src/ui/components/Screen';
import { SectionLabel } from '../src/ui/components/SectionLabel';
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
 *
 * Selections write straight to the shared filter store, so Search is
 * already filtered while this modal is open; the footer's primary action
 * just dismisses back to the (live) results.
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
  const hasFilters = count > 0;
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

  const selectedLabel = (n: number) => (n > 0 ? t('filters.selectedInSection', { count: n }) : undefined);

  return (
    <Screen>
      {/* Header: serif title + live match count, circular close on the trailing edge. */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerText}>
          <Text variant="title" accessibilityRole="header">
            {t('filters.title')}
          </Text>
          <Text variant="caption" color="secondary">
            {t('filters.resultCount', { count: resultCount })}
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={8}
          style={({ pressed }) => [
            styles.closeButton,
            { backgroundColor: theme.colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      {activeChips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeChipsRow}
          style={styles.activeChipsScroller}
        >
          {activeChips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={chip.onRemove}
              accessibilityRole="button"
              accessibilityLabel={`${chip.label}. ${t('filters.removeFilter')}`}
              hitSlop={4}
              style={({ pressed }) => [
                styles.activeChip,
                { backgroundColor: theme.colors.accentSoft, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text variant="captionStrong">{chip.label}</Text>
              <Ionicons name="close" size={14} color={theme.colors.accent} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView
        contentContainerStyle={[styles.content, { borderTopColor: theme.colors.border }]}
        showsVerticalScrollIndicator={false}
      >
        <Section title={t('filters.sectionAlcohol')} first>
          <View style={[styles.toggleCard, { backgroundColor: theme.colors.surfaceAlt }]}>
            <View style={styles.toggleText}>
              <Text variant="bodyStrong">{t('search.alcoholFree')}</Text>
              <Text variant="caption" color="secondary">
                {t('filters.alcoholFreeDescription')}
              </Text>
            </View>
            <Switch
              value={filters.alcoholFreeOnly}
              onValueChange={(value) => setFilters({ ...filters, alcoholFreeOnly: value })}
              trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
              ios_backgroundColor={theme.colors.border}
              accessibilityLabel={t('search.alcoholFree')}
              accessibilityHint={t('filters.alcoholFreeDescription')}
            />
          </View>
        </Section>

        <Section title={t('filters.sectionBaseSpirit')} trailing={selectedLabel(filters.baseSpirits.length)}>
          <View style={styles.chipRow}>
            {spiritGroupIds.map((id) => (
              <FilterChip
                key={id}
                label={tVocab(`spiritGroup.${id}`)}
                selected={filters.baseSpirits.includes(id)}
                onPress={() => setFilters({ ...filters, baseSpirits: toggle(filters.baseSpirits, id) })}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.sectionTaste')} trailing={selectedLabel(filters.tastes.length)}>
          <View style={styles.chipRow}>
            {tasteOptionIds.map((id) => (
              <FilterChip
                key={id}
                label={tVocab(`taste.${id}`)}
                selected={filters.tastes.includes(id)}
                onPress={() => setFilters({ ...filters, tastes: toggle(filters.tastes, id) })}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.sectionType')} trailing={selectedLabel(filters.types.length)}>
          <View style={styles.chipRow}>
            {typeOptionIds.map((id) => (
              <FilterChip
                key={id}
                label={tVocab(`category.${id}`)}
                selected={filters.types.includes(id)}
                onPress={() => setFilters({ ...filters, types: toggle(filters.types, id) })}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.sectionDifficulty')} trailing={selectedLabel(filters.difficulties.length)}>
          <View style={styles.chipRow}>
            {difficultyOptionIds.map((id) => (
              <FilterChip
                key={id}
                label={tVocab(`difficulty.${id}`)}
                selected={filters.difficulties.includes(id)}
                onPress={() => setFilters({ ...filters, difficulties: toggle(filters.difficulties, id) })}
              />
            ))}
          </View>
        </Section>

        <Section title={t('filters.sectionTime')}>
          <View style={styles.chipRow}>
            {timeOptions.map((opt) => (
              <FilterChip
                key={opt.minutes}
                label={t(opt.labelKey)}
                // Single choice (tapping the active one clears it), so it's announced as a radio.
                role="radio"
                selected={filters.maxPrepTimeMinutes === opt.minutes}
                onPress={() =>
                  setFilters({
                    ...filters,
                    maxPrepTimeMinutes: filters.maxPrepTimeMinutes === opt.minutes ? null : opt.minutes,
                  })
                }
              />
            ))}
          </View>
        </Section>
      </ScrollView>

      {/* Sticky action bar: Reset (disabled when nothing is selected) + primary "Show N results". */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 12) + 8,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        {resultCount === 0 ? (
          <Text variant="caption" color="secondary" style={styles.zeroResultsNote}>
            {t('filters.zeroResultsNote')}
          </Text>
        ) : null}
        <View style={styles.footerRow}>
          <Pressable
            onPress={reset}
            disabled={!hasFilters}
            accessibilityRole="button"
            accessibilityLabel={t('filters.reset')}
            accessibilityHint={t('filters.clearAll')}
            accessibilityState={{ disabled: !hasFilters }}
            hitSlop={8}
            style={({ pressed }) => [styles.resetButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text variant="bodyStrong" color={hasFilters ? 'accent' : 'tertiary'} numberOfLines={2}>
              {t('filters.reset')}
            </Text>
          </Pressable>
          <Button
            label={t('filters.showResultsWithCount', { count: resultCount })}
            onPress={() => router.back()}
            disabled={resultCount === 0 && count > 0}
            style={styles.primaryButton}
          />
        </View>
      </View>
    </Screen>
  );
}

function Section({
  title,
  trailing,
  first,
  children,
}: {
  title: string;
  trailing?: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.section, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border }]}>
      <View style={styles.sectionHeader}>
        <SectionLabel style={styles.sectionLabel}>{title}</SectionLabel>
        {trailing ? (
          <Text variant="label" color="accent">
            {trailing}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Local to the Filters screen (the shared Chip keeps its compact look for
 * its other call sites). Selected = solid accent + leading checkmark, so the
 * state doesn't rely on color alone; unselected = surface with a hairline
 * border and full-contrast text. Labels wrap rather than truncate so long
 * Turkish strings and large Dynamic Type sizes never clip.
 */
function FilterChip({
  label,
  selected,
  onPress,
  role = 'button',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: 'button' | 'radio';
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'radio' ? { checked: selected, selected } : { selected }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {selected ? <Ionicons name="checkmark" size={15} color={theme.colors.onAccent} /> : null}
      <Text variant="captionStrong" color={selected ? 'onAccent' : 'primary'} style={styles.chipLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: { flex: 1, gap: 2 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  activeChipsScroller: { flexGrow: 0 },
  activeChipsRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 10,
    minHeight: 32,
    borderRadius: 999,
  },
  content: { paddingHorizontal: 20, paddingBottom: 24, borderTopWidth: StyleSheet.hairlineWidth },
  section: { paddingVertical: 20, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  sectionLabel: { flexShrink: 1 },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleText: { flex: 1, gap: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: { flexShrink: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  resetButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, flexShrink: 1 },
  primaryButton: { flex: 1 },
  zeroResultsNote: { textAlign: 'center' },
});
