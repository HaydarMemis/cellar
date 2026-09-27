import { LEGAL_DATA_REGION, LEGAL_ENTITY_ADDRESS, LEGAL_ENTITY_NAME, LEGAL_JURISDICTION, SUPPORT_EMAIL } from '../../config/legal';
import { Locale } from '../../i18n/types';

/** Real business details, or an explicit bracketed placeholder — never an invented value. */
export function legalFields(locale: Locale) {
  const missing = locale === 'tr' ? 'henüz yapılandırılmadı' : 'not yet configured';
  return {
    entity: LEGAL_ENTITY_NAME ?? `[${locale === 'tr' ? 'yayıncı tüzel kişi adı' : 'legal entity name'} ${missing}]`,
    address: LEGAL_ENTITY_ADDRESS ?? `[${locale === 'tr' ? 'adres' : 'address'} ${missing}]`,
    jurisdiction: LEGAL_JURISDICTION ?? `[${locale === 'tr' ? 'yetkili hukuk' : 'jurisdiction'} ${missing}]`,
    dataRegion: LEGAL_DATA_REGION ?? `[${locale === 'tr' ? 'barındırma bölgesi' : 'hosting region'} ${missing}]`,
    supportEmail: SUPPORT_EMAIL ?? `[${locale === 'tr' ? 'destek e-postası' : 'support email'} ${missing}]`,
  };
}
