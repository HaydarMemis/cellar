import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PurchaseErrorCode } from '../src/data/purchases';
import { introOfferText } from '../src/data/purchases/introOfferText';
import { openManageSubscription } from '../src/data/purchases/manageSubscription';
import { FREE_RECIPE_LIMIT, PlanId, planIds, premiumFeatures } from '../src/domain/entitlements';
import { useTranslation } from '../src/i18n/useTranslation';
import { Button } from '../src/ui/components/Button';
import { Screen } from '../src/ui/components/Screen';
import { Text } from '../src/ui/components/Text';
import { useEntitlementStore } from '../src/state/entitlementStore';
import { useTheme } from '../src/theme/useTheme';

const featureCopyKeys: Partial<Record<(typeof premiumFeatures)[number], { title: string; body: string }>> = {
  unlimitedRecipes: { title: 'premium.featureUnlimitedRecipesTitle', body: 'premium.featureUnlimitedRecipesBody' },
  recipeScaling: { title: 'premium.featureRecipeScalingTitle', body: 'premium.featureRecipeScalingBody' },
  shoppingList: { title: 'premium.featureShoppingListTitle', body: 'premium.featureShoppingListBody' },
  tastingJournal: { title: 'premium.featureTastingJournalTitle', body: 'premium.featureTastingJournalBody' },
};

const planLabelKeys: Record<PlanId, 'premium.planMonthly' | 'premium.planYearly' | 'premium.planLifetime'> = {
  monthly: 'premium.planMonthly',
  yearly: 'premium.planYearly',
  lifetime: 'premium.planLifetime',
};

export default function PremiumScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const isPremium = useEntitlementStore((s) => s.isPremium);
  const activePlan = useEntitlementStore((s) => s.activePlan);
  const serviceKind = useEntitlementStore((s) => s.serviceKind);
  const offers = useEntitlementStore((s) => s.offers);
  const offersState = useEntitlementStore((s) => s.offersState);
  const loadOffers = useEntitlementStore((s) => s.loadOffers);
  const purchase = useEntitlementStore((s) => s.purchase);
  const restore = useEntitlementStore((s) => s.restore);
  const managementUrl = useEntitlementStore((s) => s.managementUrl);

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  // Only plans the STORE actually offers are shown, with the store's own
  // localized price — never a hardcoded number.
  const visibleOffers = useMemo(() => offers.filter((o) => planIds.includes(o.planId)), [offers]);
  const effectiveSelection = visibleOffers.some((o) => o.planId === selectedPlan) ? selectedPlan : visibleOffers[0]?.planId;

  const showPurchaseError = (error: PurchaseErrorCode) => {
    if (error === 'cancelled') return;
    if (error === 'pending') {
      Alert.alert(t('premium.purchasePendingTitle'), t('premium.purchasePendingMessage'));
      return;
    }
    if (error === 'not-activated') {
      // The store took the payment — never say "didn't go through / not charged".
      Alert.alert(t('premium.purchaseNotActivatedTitle'), t('premium.purchaseNotActivatedMessage'));
      return;
    }
    const messages: Partial<Record<PurchaseErrorCode, string>> = {
      network: t('premium.purchaseNetworkMessage'),
      'not-allowed': t('premium.purchaseNotAllowedMessage'),
      'already-owned': t('premium.alreadyOwnedMessage'),
      unavailable: t('premium.unavailableMessage'),
      'other-account': t('premium.purchaseOtherAccountMessage'),
      'store-problem': t('premium.purchaseStoreProblemMessage'),
    };
    Alert.alert(t('premium.purchaseFailedTitle'), messages[error] ?? t('premium.purchaseFailedMessage'));
  };

  const runExclusive = async (work: () => Promise<void>) => {
    if (busyRef.current) return; // one store sheet at a time — no double purchases
    busyRef.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleContinue = () =>
    runExclusive(async () => {
      if (!effectiveSelection) return;
      const result = await purchase(effectiveSelection);
      if (result.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        Alert.alert(t('premium.purchaseSuccessTitle'));
        router.back();
      } else {
        showPurchaseError(result.error);
      }
    });

  const handleRestore = () =>
    runExclusive(async () => {
      const result = await restore();
      if (!result.ok) {
        if (result.error === 'other-account') Alert.alert(t('premium.restoreFailedTitle'), t('premium.purchaseOtherAccountMessage'));
        else if (result.error !== 'cancelled') Alert.alert(t('premium.restoreFailedTitle'), t('premium.restoreFailedMessage'));
        return;
      }
      if (result.status.isPremium) Alert.alert(t('premium.restoreSuccessTitle'));
      else Alert.alert(t('premium.restoreNothingTitle'), t('premium.restoreNothingMessage'));
    });

  const handleManageSubscription = () => {
    void openManageSubscription(managementUrl);
  };

  const plansUnavailable = serviceKind === 'unavailable' || (offersState === 'loaded' && visibleOffers.length === 0) || offersState === 'error';

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={8}>
          <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="display">{t('premium.headline')}</Text>
        <Text variant="body" color="secondary" style={styles.subheadline}>
          {t('premium.subheadline')}
        </Text>

        <View style={styles.featureList}>
          {premiumFeatures.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: theme.colors.accentSoft }]}>
                <Ionicons name="checkmark" size={16} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t(featureCopyKeys[feature]!.title as never)}</Text>
                <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>
                  {t(featureCopyKeys[feature]!.body as never, { limit: FREE_RECIPE_LIMIT })}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text variant="caption" color="tertiary" style={styles.freeNote}>
          {t('premium.freeTierNote')}
        </Text>

        {isPremium ? (
          <>
            <View style={[styles.currentPlanCard, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Text variant="captionStrong" color="secondary">
                {t('premium.currentPlanLabel')}
              </Text>
              <Text variant="bodyStrong">{activePlan ? t(planLabelKeys[activePlan]) : t('premium.title')}</Text>
            </View>
            {/* Only when the store reports a subscription to manage for THIS account (also covers lifetime + a still-running subscription). */}
            {serviceKind === 'store' && !!managementUrl && (
              <Pressable onPress={handleManageSubscription} accessibilityRole="link" style={styles.restoreRow} hitSlop={8}>
                <Text variant="captionStrong" color="accent">
                  {t('premium.manageSubscription')}
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Text variant="headline" style={styles.chooseTitle}>
              {t('premium.choosePlan')}
            </Text>
            {offersState === 'loading' || (offersState === 'idle' && serviceKind !== 'unavailable') ? (
              <View style={styles.stateBox}>
                <ActivityIndicator color={theme.colors.textSecondary} />
                <Text variant="caption" color="secondary">
                  {t('premium.loadingPlans')}
                </Text>
              </View>
            ) : plansUnavailable ? (
              <>
              {serviceKind === 'unavailable' && (
                // Billing isn't configured in this build: still show WHAT
                // Premium offers (the plans), never a price the store hasn't
                // provided and never a way to "buy" it.
                <View style={styles.planRow} accessibilityElementsHidden={false}>
                  {planIds.map((planId) => (
                    <View
                      key={planId}
                      style={[styles.planCard, styles.planCardPreview, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
                      accessibilityLabel={`${t(planLabelKeys[planId])} — ${t('premium.planPriceFromStore')}`}
                    >
                      <Text variant="captionStrong">{t(planLabelKeys[planId])}</Text>
                      <Text variant="label" color="secondary" style={{ marginTop: 4, textAlign: 'center', paddingHorizontal: 6 }}>
                        {t('premium.planPriceFromStore')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={[styles.stateBox, { backgroundColor: theme.colors.surfaceAlt, marginTop: serviceKind === 'unavailable' ? 12 : 0 }]}>
                <Text variant="bodyStrong" style={{ textAlign: 'center' }}>
                  {t('premium.unavailableTitle')}
                </Text>
                <Text variant="caption" color="secondary" style={{ textAlign: 'center' }}>
                  {serviceKind === 'unavailable' ? t('premium.billingNotConfiguredMessage') : t('premium.unavailableMessage')}
                </Text>
                {serviceKind !== 'unavailable' && (
                  <Button label={t('premium.retryLoadPlans')} variant="secondary" onPress={loadOffers} style={{ marginTop: 8 }} />
                )}
              </View>
              </>
            ) : (
              <>
                <View style={styles.planRow}>
                  {visibleOffers.map((offer) => {
                    const selected = effectiveSelection === offer.planId;
                    const introLine = offer.introOffer ? introOfferText(offer.introOffer, offer.planId, offer.priceString, t) : null;
                    return (
                      <Pressable
                        key={offer.planId}
                        onPress={() => setSelectedPlan(offer.planId)}
                        style={[
                          styles.planCard,
                          {
                            backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surfaceAlt,
                            borderColor: selected ? theme.colors.accent : theme.colors.border,
                          },
                        ]}
                        accessibilityRole="radio"
                        accessibilityLabel={`${t(planLabelKeys[offer.planId])} ${offer.priceString}`}
                        accessibilityState={{ selected }}
                      >
                        <Text variant="captionStrong" color={selected ? 'accent' : 'primary'}>
                          {t(planLabelKeys[offer.planId])}
                        </Text>
                        <Text variant="bodyStrong" style={{ marginTop: 4 }}>
                          {offer.priceString}
                        </Text>
                        {offer.pricePerMonthString ? (
                          <Text variant="label" color="secondary" style={{ marginTop: 2 }}>
                            {t('premium.perMonthStore', { price: offer.pricePerMonthString })}
                          </Text>
                        ) : null}
                        {introLine ? (
                          <Text variant="label" color="accent" style={{ marginTop: 2, textAlign: 'center', paddingHorizontal: 4 }}>
                            {introLine}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
                <Button
                  label={busy ? t('common.loading') : t('premium.continueAction')}
                  onPress={handleContinue}
                  disabled={busy || !effectiveSelection}
                  style={styles.continueButton}
                />
                <Text variant="caption" color="tertiary" style={styles.priceNote}>
                  {Platform.OS === 'ios' ? t('premium.subscriptionTermsIos') : t('premium.subscriptionTermsAndroid')}
                </Text>
              </>
            )}
          </>
        )}

        {serviceKind !== 'unavailable' && (
          <Pressable
            onPress={handleRestore}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('premium.restorePurchases')}
            style={styles.restoreRow}
            hitSlop={8}
          >
            <Text variant="captionStrong" color="accent">
              {t('premium.restorePurchases')}
            </Text>
          </Pressable>
        )}

        <View style={styles.legalRow}>
          <Pressable onPress={() => router.push('/legal/terms')} accessibilityRole="link" hitSlop={8}>
            <Text variant="caption" color="accent">
              {t('premium.termsLink')}
            </Text>
          </Pressable>
          <Text variant="caption" color="tertiary">
            {' · '}
          </Text>
          <Pressable onPress={() => router.push('/legal/privacy')} accessibilityRole="link" hitSlop={8}>
            <Text variant="caption" color="accent">
              {t('premium.privacyLink')}
            </Text>
          </Pressable>
        </View>

        {serviceKind === 'development' && (
          <Text variant="caption" color="tertiary" style={styles.devNote}>
            {t('premium.devBuildNote')}
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 4 },
  subheadline: { marginTop: 8, lineHeight: 21 },
  featureList: { marginTop: 24, gap: 16 },
  featureRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  featureIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  freeNote: { marginTop: 20, lineHeight: 18 },
  currentPlanCard: { marginTop: 24, borderRadius: 14, padding: 16, gap: 4 },
  chooseTitle: { marginTop: 28, marginBottom: 12 },
  planRow: { flexDirection: 'row', gap: 10 },
  planCardPreview: { opacity: 0.75, justifyContent: 'center' },
  planCard: { flex: 1, minHeight: 88, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14, alignItems: 'center', position: 'relative' },
  saveBadge: { position: 'absolute', top: -9, alignSelf: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  priceNote: { marginTop: 12, textAlign: 'center', lineHeight: 17 },
  stateBox: { borderRadius: 14, padding: 16, gap: 8, alignItems: 'center' },
  continueButton: { marginTop: 16 },
  restoreRow: { alignItems: 'center', marginTop: 20, minHeight: 32, justifyContent: 'center' },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  devNote: { textAlign: 'center', marginTop: 20, lineHeight: 17 },
});
