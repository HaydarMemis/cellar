import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseDecimal } from '../../domain/parseDecimal';
import { useTranslation } from '../../i18n/useTranslation';
import { useEntitlementStore } from '../../state/entitlementStore';
import { useTheme } from '../../theme/useTheme';
import { Button } from './Button';
import { Chip } from './Chip';
import { Text } from './Text';

export interface ScaleModalProps {
  visible: boolean;
  onClose: () => void;
  servings: number;
  onChange: (servings: number) => void;
}

const presets = [1, 2, 4];

export function ScaleModal({ visible, onClose, servings, onChange }: ScaleModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const isPremium = useEntitlementStore((s) => s.isPremium);
  const [customValue, setCustomValue] = useState(presets.includes(servings) ? '' : String(servings));

  if (!isPremium) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
        <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top + 24 }]}>
          <View style={styles.upsell}>
            <Ionicons name="lock-closed-outline" size={28} color={theme.colors.textSecondary} />
            <Text variant="headline" style={{ marginTop: 12, textAlign: 'center' }}>
              {t('scaling.premiumRequiredTitle')}
            </Text>
            <Text variant="body" color="secondary" style={{ marginTop: 8, textAlign: 'center' }}>
              {t('scaling.premiumRequiredMessage')}
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Text variant="title">{t('scaling.title')}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
            <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.chipRow}>
          {presets.map((preset) => (
            <Chip
              key={preset}
              label={t('scaling.servings', { count: preset })}
              selected={servings === preset}
              onPress={() => {
                setCustomValue('');
                onChange(preset);
              }}
            />
          ))}
        </View>

        <View style={styles.customRow}>
          <Text variant="body" color="secondary" style={{ flex: 1 }}>
            {t('scaling.custom')}
          </Text>
          <TextInput
            value={customValue}
            onChangeText={(v) => {
              setCustomValue(v);
              const parsed = parseDecimal(v);
              if (parsed !== null && parsed > 0) onChange(parsed);
            }}
            keyboardType="decimal-pad"
            placeholder="1"
            placeholderTextColor={theme.colors.textTertiary}
            style={[styles.customInput, { backgroundColor: theme.colors.surfaceAlt, color: theme.colors.textPrimary }]}
          />
        </View>

        <Pressable
          onPress={() => {
            setCustomValue('');
            onChange(1);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('scaling.resetToOriginal')}
          style={styles.resetRow}
          hitSlop={8}
        >
          <Text variant="captionStrong" color="accent">
            {t('scaling.resetToOriginal')}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20 },
  chipRow: { flexDirection: 'row', gap: 8 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  customInput: { width: 80, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, textAlign: 'center' },
  resetRow: { marginTop: 20, minHeight: 32 },
  upsell: { alignItems: 'center', paddingHorizontal: 24 },
});
