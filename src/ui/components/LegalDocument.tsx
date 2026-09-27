import React from 'react';
import { StyleSheet, View } from 'react-native';
import { isLegalFinal, LEGAL_EFFECTIVE_DATE } from '../../config/legal';
import { LegalDoc } from '../../content/legal/types';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../theme/useTheme';
import { SectionLabel } from './SectionLabel';
import { Text } from './Text';

/**
 * Shared renderer for the three legal screens (Privacy Policy, Terms of
 * Service, Community Guidelines) — plain RN Text/View, no markdown-parsing
 * dependency, since the content is already authored as structured data
 * (see src/content/legal/*.ts). Always shows the draft banner: none of
 * this content has had a legal review pass yet (see LAUNCH_READINESS.md).
 */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View>
      {isLegalFinal ? (
        LEGAL_EFFECTIVE_DATE ? (
          <Text variant="caption" color="tertiary" style={styles.effectiveDate}>
            {t('legal.effectiveDate', { date: LEGAL_EFFECTIVE_DATE })}
          </Text>
        ) : null
      ) : (
        <View style={[styles.draftBanner, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Text variant="caption" color="secondary" style={styles.draftBannerText}>
            {t('legal.draftBanner')}
          </Text>
        </View>
      )}

      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <SectionLabel>{section.heading}</SectionLabel>
          {section.paragraphs.map((paragraph, index) => (
            <Text key={index} variant="body" color="secondary" style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
          {section.bullets?.map((bullet, index) => (
            <View key={index} style={styles.bulletRow}>
              <Text variant="body" color="secondary">
                {'•'}
              </Text>
              <Text variant="body" color="secondary" style={styles.bulletText}>
                {bullet}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  draftBanner: { borderRadius: 12, padding: 14, marginBottom: 24 },
  draftBannerText: { lineHeight: 18 },
  effectiveDate: { marginBottom: 20 },
  section: { marginBottom: 24 },
  paragraph: { marginTop: 8, lineHeight: 21 },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 8, paddingRight: 4 },
  bulletText: { flex: 1, lineHeight: 21 },
});
