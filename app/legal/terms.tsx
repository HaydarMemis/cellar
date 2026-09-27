import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTermsOfService } from '../../src/content/legal/termsOfService';
import { useTranslation } from '../../src/i18n/useTranslation';
import { LegalDocument } from '../../src/ui/components/LegalDocument';
import { Screen } from '../../src/ui/components/Screen';
import { Text } from '../../src/ui/components/Text';
import { useLocaleStore } from '../../src/state/localeStore';
import { useTheme } from '../../src/theme/useTheme';

export default function TermsOfServiceScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const doc = getTermsOfService(locale);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="title" style={styles.title}>
          {t('legal.termsTitle')}
        </Text>
        <LegalDocument doc={doc} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  title: { marginBottom: 20 },
});
