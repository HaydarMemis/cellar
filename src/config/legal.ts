/**
 * Legal/business configuration the in-app legal screens need but the code
 * cannot know (who publishes the app, jurisdiction, support inbox, hosted
 * URLs). Read from `EXPO_PUBLIC_` env vars; every caller degrades to a clearly
 * marked placeholder when unset — never an invented value.
 */
export const LEGAL_ENTITY_NAME = process.env.EXPO_PUBLIC_LEGAL_ENTITY_NAME;
export const LEGAL_ENTITY_ADDRESS = process.env.EXPO_PUBLIC_LEGAL_ENTITY_ADDRESS;
export const LEGAL_JURISDICTION = process.env.EXPO_PUBLIC_LEGAL_JURISDICTION;
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;
/** ISO date (YYYY-MM-DD) the reviewed documents take effect. */
export const LEGAL_EFFECTIVE_DATE = process.env.EXPO_PUBLIC_LEGAL_EFFECTIVE_DATE;

/** Public HTTPS URLs of the hosted documents (store listings, account-deletion page for Google Play). */
export const PRIVACY_POLICY_URL = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
export const TERMS_OF_SERVICE_URL = process.env.EXPO_PUBLIC_TERMS_URL;
export const COMMUNITY_GUIDELINES_URL = process.env.EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL;
export const ACCOUNT_DELETION_URL = process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL;

export const isLegalEntityConfigured = !!LEGAL_ENTITY_NAME;

/**
 * The "draft — pending legal review" banner disappears only when the
 * documents were actually reviewed (EXPO_PUBLIC_LEGAL_REVIEWED=true) AND the
 * business details are filled in.
 */
export const isLegalFinal = process.env.EXPO_PUBLIC_LEGAL_REVIEWED === 'true' && !!LEGAL_ENTITY_NAME && !!LEGAL_JURISDICTION && !!SUPPORT_EMAIL;
