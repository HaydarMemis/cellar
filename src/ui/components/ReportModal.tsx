import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReportReason } from '../../data/community';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../theme/useTheme';
import { Button } from './Button';
import { Text } from './Text';

export interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  /** What's being reported, shown in the header — e.g. a recipe name or "@username". */
  targetLabel: string;
  onSubmit: (reason: ReportReason, details: string | undefined) => void | Promise<void>;
}

const reasons: ReportReason[] = ['spam', 'inappropriate', 'harassment', 'copyright', 'other'];
const reasonKeys: Record<ReportReason, 'reasonSpam' | 'reasonInappropriate' | 'reasonHarassment' | 'reasonCopyright' | 'reasonOther'> = {
  spam: 'reasonSpam',
  inappropriate: 'reasonInappropriate',
  harassment: 'reasonHarassment',
  copyright: 'reasonCopyright',
  other: 'reasonOther',
};

/**
 * A real report-reason picker — used both from the creator profile (report
 * a user) and the Discover feed card (report a recipe). Not an Alert.alert
 * chain: Android caps Alert to 3 buttons, and 5 reasons + cancel doesn't
 * fit, so this is a small bottom sheet instead, in the same Modal pattern
 * as ScaleModal.tsx.
 */
export function ReportModal({ visible, onClose, targetLabel, onSubmit }: ReportModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelected(null);
    setDetails('');
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    await onSubmit(selected, details.trim() || undefined);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} presentationStyle="pageSheet">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top + 12 }]}
      >
        <View style={styles.header}>
          <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
            {targetLabel}
          </Text>
          <Pressable onPress={handleClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </Pressable>
        </View>

        <Text variant="body" color="secondary" style={styles.subtitle}>
          {t('moderation.reasonTitle')}
        </Text>

        <View style={styles.reasonList}>
          {reasons.map((reason) => (
            <Pressable
              key={reason}
              onPress={() => setSelected(reason)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === reason }}
              style={[
                styles.reasonRow,
                { backgroundColor: theme.colors.surfaceAlt, borderColor: selected === reason ? theme.colors.accent : 'transparent' },
              ]}
            >
              <Ionicons
                name={selected === reason ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={selected === reason ? theme.colors.accent : theme.colors.textTertiary}
              />
              <Text variant="body">{t(`moderation.${reasonKeys[reason]}` as never)}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder={t('moderation.reasonOther')}
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          style={[styles.detailsInput, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary }]}
        />

        <Button label={t('moderation.submitReport')} onPress={handleSubmit} disabled={!selected || submitting} style={styles.submitButton} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16 },
  subtitle: { marginBottom: 12 },
  reasonList: { gap: 8 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12 },
  detailsInput: { marginTop: 16, borderRadius: 12, padding: 12, minHeight: 72, textAlignVertical: 'top', fontSize: 14 },
  submitButton: { marginTop: 20 },
});
