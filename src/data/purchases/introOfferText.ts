import type { PlanId } from '../../domain/entitlements';
import type { TranslateOptions } from '../../i18n/translate';
import type { UiKey } from '../../i18n/useTranslation';
import type { IntroOffer, IntroPeriodUnit } from './PurchaseService';

type Translate = (key: UiKey, options?: TranslateOptions) => string;

const PLAN_PERIOD: Partial<Record<PlanId, IntroPeriodUnit>> = { monthly: 'month', yearly: 'year' };

/**
 * The paywall line for an intro offer, spelling out what happens after it:
 * - free trial: "7-day free trial, then $4.99/month"
 * - paid, one period: "$0.99 for 3 months, then $4.99/month"
 * - paid, per period: "$0.99/month for 3 months, then $4.99/month"
 * (The previous label showed only the intro price — "$0.00" for a free
 * trial — with no duration and no price after it.) null for a plan with no
 * billing period (lifetime).
 */
export function introOfferText(offer: IntroOffer, planId: PlanId, regularPriceString: string, t: Translate): string | null {
  const planPeriod = PLAN_PERIOD[planId];
  if (!planPeriod) return null;
  const period = t(`premium.periodName.${planPeriod}` as UiKey);
  const totalUnits = offer.periodCount * offer.cycles;

  if (offer.kind === 'free-trial') {
    const duration = t(`premium.trialLength.${offer.periodUnit}` as UiKey, { count: totalUnits });
    return t('premium.introFreeTrial', { duration, price: regularPriceString, period });
  }

  const duration = t(`premium.introDuration.${offer.periodUnit}` as UiKey, { count: totalUnits });
  if (offer.cycles > 1) {
    const introPeriod =
      offer.periodCount === 1 ? t(`premium.periodName.${offer.periodUnit}` as UiKey) : t(`premium.introDuration.${offer.periodUnit}` as UiKey, { count: offer.periodCount });
    return t('premium.introPaidPerPeriod', { introPrice: offer.priceString, introPeriod, duration, price: regularPriceString, period });
  }
  return t('premium.introPaid', { introPrice: offer.priceString, duration, price: regularPriceString, period });
}
