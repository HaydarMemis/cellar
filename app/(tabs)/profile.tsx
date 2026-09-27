import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { planIds } from '../../src/domain/entitlements';
import { isSupabaseConfigured } from '../../src/data/supabase/client';
import { useTranslation } from '../../src/i18n/useTranslation';
import { Locale } from '../../src/i18n/types';
import { Avatar } from '../../src/ui/components/Avatar';
import { Button } from '../../src/ui/components/Button';
import { Screen } from '../../src/ui/components/Screen';
import { SectionLabel } from '../../src/ui/components/SectionLabel';
import { SegmentedControl } from '../../src/ui/components/SegmentedControl';
import { Text } from '../../src/ui/components/Text';
import { SUPPORT_EMAIL } from '../../src/config/legal';
import { LOCAL_GUEST_OWNER_ID } from '../../src/domain/types';
import { useAuthStore } from '../../src/state/authStore';
import { useEntitlementStore } from '../../src/state/entitlementStore';
import { useLocaleStore } from '../../src/state/localeStore';
import { useRecipesStore } from '../../src/state/recipesStore';
import { ThemePreference, useSettingsStore } from '../../src/state/settingsStore';
import { useTheme } from '../../src/theme/useTheme';

const planLabelKeys: Record<(typeof planIds)[number], 'premium.planMonthly' | 'premium.planYearly' | 'premium.planLifetime'> = {
  monthly: 'premium.planMonthly',
  yearly: 'premium.planYearly',
  lifetime: 'premium.planLifetime',
};

export default function ProfileScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const units = useSettingsStore((s) => s.units);
  const setUnits = useSettingsStore((s) => s.setUnits);
  const themePreference = useSettingsStore((s) => s.themePreference);
  const setThemePreference = useSettingsStore((s) => s.setThemePreference);
  const language = useLocaleStore((s) => s.locale);
  const setLanguage = useLocaleStore((s) => s.setLanguage);
  const authProfile = useAuthStore((s) => s.profile);
  const isPremium = useEntitlementStore((s) => s.isPremium);
  const activePlan = useEntitlementStore((s) => s.activePlan);
  const serviceKind = useEntitlementStore((s) => s.serviceKind);
  const devDowngradeToFree = useEntitlementStore((s) => s.devDowngradeToFree);
  const allRecipes = useRecipesStore((s) => s.recipes);
  const myOwnerId = authProfile?.id ?? LOCAL_GUEST_OWNER_ID;
  // Only this identity's recipes — the store also holds other accounts' and the guest's.
  const recipes = useMemo(() => allRecipes.filter((r) => r.ownerId === myOwnerId), [allRecipes, myOwnerId]);
  const publicRecipeCount = recipes.filter((r) => r.visibility === 'public').length;
  const privateRecipeCount = recipes.length - publicRecipeCount;

  const themeOptions: { id: ThemePreference; label: string }[] = [
    { id: 'system', label: t('profile.themeSystem') },
    { id: 'light', label: t('profile.themeLight') },
    { id: 'dark', label: t('profile.themeDark') },
  ];

  const languageOptions: { id: Locale; label: string }[] = [
    { id: 'en', label: t('profile.languageEnglish') },
    { id: 'tr', label: t('profile.languageTurkish') },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <Text variant="title" style={styles.title}>
          {t('profile.title')}
        </Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          {t('profile.subtitle')}
        </Text>

        <SettingsGroup title={t('profile.sectionAccount')}>
          {authProfile ? (
            <View style={[styles.accountCard, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Pressable
                onPress={() => router.push({ pathname: '/creator/[id]', params: { id: authProfile.id } })}
                style={styles.accountRow}
                accessibilityRole="button"
              >
                <Avatar seed={authProfile.id} label={authProfile.displayName} size={44} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{authProfile.displayName}</Text>
                  <Text variant="caption" color="secondary">
                    {t('profile.handleFormat', { username: authProfile.username })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/account-security')}
                accessibilityRole="button"
                style={styles.subRow}
              >
                <Text variant="captionStrong" color="secondary">
                  {t('profile.accountSecurityRow')}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={theme.colors.textTertiary} />
              </Pressable>
            </View>
          ) : (
            <View style={[styles.accountCard, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Text variant="body" color="secondary" style={styles.signInSubtitle}>
                {t('profile.signInSubtitle')}
              </Text>
              <View style={styles.authButtonRow}>
                <Button label={t('profile.signIn')} variant="secondary" onPress={() => router.push('/auth')} style={{ flex: 1 }} />
                <Button label={t('profile.createAccount')} onPress={() => router.push('/auth?mode=signUp')} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </SettingsGroup>

        <SettingsGroup title={t('profile.sectionMyContent')}>
          <Pressable
            onPress={() => router.push('/my-bar')}
            style={[styles.listRow, { backgroundColor: theme.colors.surfaceAlt }]}
            accessibilityRole="button"
          >
            <Ionicons name="book-outline" size={20} color={theme.colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text variant="body" color="secondary">
                {t('profile.publicRecipesCount', { count: publicRecipeCount })}
              </Text>
              <Text variant="body" color="secondary">
                {t('profile.privateRecipesCount', { count: privateRecipeCount })}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/shopping-list')}
            style={[styles.listRow, { backgroundColor: theme.colors.surfaceAlt }]}
            accessibilityRole="button"
          >
            <Ionicons name="cart-outline" size={20} color={theme.colors.textSecondary} />
            <Text variant="body" color="secondary" style={{ flex: 1 }}>
              {t('profile.shoppingListRow')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
          </Pressable>
        </SettingsGroup>

        <SettingsGroup title={t('profile.sectionPremium')}>
          <Pressable
            onPress={() => router.push('/premium')}
            style={[styles.premiumCard, { backgroundColor: isPremium ? theme.colors.accentSoft : theme.colors.surfaceAlt }]}
            accessibilityRole="button"
          >
            <Ionicons name={isPremium ? 'star' : 'star-outline'} size={22} color={theme.colors.accent} />
            <View style={{ flex: 1 }}>
              {isPremium ? (
                <>
                  <Text variant="bodyStrong">{t('profile.premiumActiveLabel')}</Text>
                  {activePlan && (
                    <Text variant="caption" color="secondary">
                      {t('profile.premiumActivePlan', { plan: t(planLabelKeys[activePlan]) })}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text variant="bodyStrong">{t('profile.premiumUpgradeTitle')}</Text>
                  <Text variant="caption" color="secondary">
                    {t('profile.premiumUpgradeSubtitle')}
                  </Text>
                </>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
          </Pressable>
        </SettingsGroup>

        <SettingsGroup title={t('profile.sectionLanguage')}>
          <SegmentedControl options={languageOptions} value={language} onChange={(v) => setLanguage(v)} />
        </SettingsGroup>

        <SettingsGroup title={t('profile.sectionUnits')}>
          <SegmentedControl
            options={[
              { id: 'ml', label: t('profile.unitsMl') },
              { id: 'oz', label: t('profile.unitsOz') },
            ]}
            value={units}
            onChange={(v) => setUnits(v as 'ml' | 'oz')}
          />
        </SettingsGroup>

        <SettingsGroup title={t('profile.sectionAppearance')}>
          <SegmentedControl options={themeOptions} value={themePreference} onChange={(v) => setThemePreference(v as ThemePreference)} />
        </SettingsGroup>

        <SettingsGroup title={t('profile.sectionAbout')}>
          <View style={[styles.aboutCard, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Ionicons name="wine-outline" size={22} color={theme.colors.accent} />
            <Text variant="body" color="secondary" style={styles.aboutText}>
              {t('profile.aboutText')}
            </Text>
          </View>
        </SettingsGroup>

        <SettingsGroup title={t('profile.sectionPrivacy')}>
          <View style={[styles.linksCard, { backgroundColor: theme.colors.surfaceAlt }]}>
            <Pressable onPress={() => router.push('/legal/privacy')} accessibilityRole="button" style={styles.linkRow}>
              <Text variant="body">{t('premium.privacyLink')}</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.colors.textTertiary} />
            </Pressable>
            <Pressable onPress={() => router.push('/legal/terms')} accessibilityRole="button" style={styles.linkRow}>
              <Text variant="body">{t('premium.termsLink')}</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.colors.textTertiary} />
            </Pressable>
            <Pressable onPress={() => router.push('/legal/community-guidelines')} accessibilityRole="button" style={styles.linkRow}>
              <Text variant="body">{t('profile.communityGuidelinesRow')}</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.colors.textTertiary} />
            </Pressable>
            {SUPPORT_EMAIL ? (
              <Pressable
                onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Cellar')}`).catch(() => undefined)}
                accessibilityRole="link"
                style={styles.linkRow}
              >
                <Text variant="body">{t('profile.contactSupportRow')}</Text>
                <Ionicons name="mail-outline" size={14} color={theme.colors.textTertiary} />
              </Pressable>
            ) : null}
            {authProfile && (
              <Pressable onPress={() => router.push('/blocked-users')} accessibilityRole="button" style={[styles.linkRow, styles.linkRowLast]}>
                <Text variant="body">{t('profile.blockedUsersRow')}</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </SettingsGroup>

        {authProfile && (
          <SettingsGroup title={t('profile.sectionDangerZone')}>
            <Pressable
              onPress={() => router.push('/delete-account')}
              accessibilityRole="button"
              accessibilityLabel={t('profile.deleteAccountRow')}
              style={[styles.dangerCard, { backgroundColor: theme.colors.surfaceAlt }]}
            >
              <Ionicons name="warning-outline" size={20} color={theme.colors.danger} />
              <Text variant="bodyStrong" style={{ color: theme.colors.danger, flex: 1 }}>
                {t('profile.deleteAccountRow')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.danger} />
            </Pressable>
          </SettingsGroup>
        )}

        {__DEV__ && isPremium && serviceKind === 'development' && (
          <SettingsGroup title={t('profile.devSectionTitle')}>
            <Pressable
              onPress={devDowngradeToFree}
              style={[styles.aboutCard, { backgroundColor: theme.colors.surfaceAlt }]}
            >
              <Text variant="captionStrong" color="accent">
                {t('profile.devDowngradeToFree')}
              </Text>
            </Pressable>
          </SettingsGroup>
        )}

        {__DEV__ && (
          <SettingsGroup title={t('profile.devBackendSectionTitle')}>
            <View style={[styles.aboutCard, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Ionicons name={isSupabaseConfigured ? 'cloud-done-outline' : 'cloud-offline-outline'} size={20} color={theme.colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text variant="body" color="secondary">
                  {t('profile.devBackendConfigured', { status: isSupabaseConfigured ? t('common.yes') : t('common.no') })}
                </Text>
                {isSupabaseConfigured && (
                  <Text variant="caption" color="tertiary" style={{ marginTop: 2 }}>
                    {t('profile.devBackendHost', { host: supabaseHost() })}
                  </Text>
                )}
              </View>
            </View>
          </SettingsGroup>
        )}
      </ScrollView>
    </Screen>
  );
}

/**
 * Dev-only diagnostic (see the `__DEV__`-gated section above) — the
 * project host only, never the anon key or any other credential, so this
 * is safe to render even though it's derived from a client-exposed env
 * var. Never throws: an unparseable URL just shows as "unknown" rather
 * than crashing this screen.
 */
function supabaseHost(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) return 'unknown';
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <SectionLabel>{title}</SectionLabel>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  title: { marginBottom: 4 },
  subtitle: { marginBottom: 28 },
  group: { marginBottom: 24, gap: 10 },
  aboutCard: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 14, alignItems: 'flex-start' },
  aboutText: { flex: 1, lineHeight: 20 },
  listRow: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 14, alignItems: 'center' },
  accountCard: { borderRadius: 14, padding: 16, gap: 12 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  signInSubtitle: { lineHeight: 20 },
  authButtonRow: { flexDirection: 'row', gap: 10 },
  premiumCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 14 },
  linksCard: { borderRadius: 14, overflow: 'hidden' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  linkRowLast: { borderBottomWidth: 0 },
  dangerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14 },
});
