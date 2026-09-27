import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JournalEntry } from '../../domain/types';
import { useTranslation } from '../../i18n/useTranslation';
import { useEntitlementStore } from '../../state/entitlementStore';
import { useJournalStore } from '../../state/journalStore';
import { useTheme } from '../../theme/useTheme';
import { Button } from './Button';
import { Text } from './Text';

export interface JournalLogModalProps {
  visible: boolean;
  onClose: () => void;
  drinkKind: 'cocktail' | 'recipe';
  drinkId: string;
  drinkName: string;
  /** When set, the modal edits this existing entry (rating/note only — the drink itself never changes) instead of creating a new one. */
  editingEntry?: JournalEntry | null;
}

export function JournalLogModal({ visible, onClose, drinkKind, drinkId, drinkName, editingEntry }: JournalLogModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const isPremium = useEntitlementStore((s) => s.isPremium);
  const createEntry = useJournalStore((s) => s.create);
  const updateEntry = useJournalStore((s) => s.update);
  const isEditing = !!editingEntry;

  // Initializers only, deliberately no effect to re-sync them: the caller
  // (my-bar.tsx) conditionally mounts this component per entry being
  // edited — a fresh mount per entry is exactly what makes a plain
  // useState initializer correct here without an extra render pass. See
  // https://react.dev/learn/you-might-not-need-an-effect.
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(editingEntry?.rating ?? 5);
  const [note, setNote] = useState(editingEntry?.note ?? '');
  const [saving, setSaving] = useState(false);

  if (!isPremium) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
        <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top + 24 }]}>
          <View style={styles.upsell}>
            <Ionicons name="lock-closed-outline" size={28} color={theme.colors.textSecondary} />
            <Text variant="headline" style={{ marginTop: 12, textAlign: 'center' }}>
              {t('journal.premiumRequiredTitle')}
            </Text>
            <Text variant="body" color="secondary" style={{ marginTop: 8, textAlign: 'center' }}>
              {t('journal.premiumRequiredMessage')}
            </Text>
            <Button
              label={t('premium.title')}
              onPress={() => {
                onClose();
                router.push('/premium');
              }}
              style={{ marginTop: 20 }}
            />
          </View>
        </View>
      </Modal>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEditing && editingEntry) {
        await updateEntry(editingEntry.id, { rating, note: note.trim() || undefined });
      } else {
        await createEntry({ drinkKind, drinkId, drinkName, rating, note: note.trim() || undefined, madeAt: new Date().toISOString() });
      }
    } catch {
      // Local storage write failed (storage writes now reject instead of
      // silently pretending to succeed) — keep the sheet open with the input.
      setSaving(false);
      Alert.alert(t('common.genericErrorTitle'), t('common.genericErrorMessage'));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setSaving(false);
    if (!isEditing) {
      setNote('');
      setRating(5);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top + 12 }]}
      >
        <View style={styles.header}>
          <Text variant="title">{isEditing ? t('journal.editTitle') : t('journal.logTitle')}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </Pressable>
        </View>

        <Text variant="bodyStrong">{drinkName}</Text>

        <Text variant="captionStrong" color="secondary" style={styles.label}>
          {t('journal.ratingLabel')}
        </Text>
        <View style={styles.starRow}>
          {([1, 2, 3, 4, 5] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setRating(value)}
              accessibilityRole="button"
              accessibilityLabel={t('journal.ratingValueLabel', { count: value })}
              accessibilityState={{ selected: value === rating }}
              hitSlop={6}
            >
              <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={28} color={theme.colors.accent} />
            </Pressable>
          ))}
        </View>

        <Text variant="captionStrong" color="secondary" style={styles.label}>
          {t('journal.noteLabel')}
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('journal.notePlaceholder')}
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          style={[styles.noteInput, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary }]}
        />

        <Button label={t('journal.save')} onPress={handleSave} disabled={saving} style={{ marginTop: 24 }} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16 },
  label: { marginTop: 20, marginBottom: 10 },
  starRow: { flexDirection: 'row', gap: 8 },
  noteInput: { borderRadius: 12, padding: 14, minHeight: 90, textAlignVertical: 'top', fontSize: 15 },
  upsell: { alignItems: 'center', paddingHorizontal: 24 },
});
