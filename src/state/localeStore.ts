import * as Localization from 'expo-localization';
import { create } from 'zustand';
import { JsonStore } from '../data/storage/jsonStore';
import { isSupportedLocale, Locale } from '../i18n/types';

/** 'system' follows the device locale (re-evaluated at hydrate time); a stored Locale is an explicit user choice. */
type LanguagePreference = 'system' | Locale;

interface StoredLocale {
  preference: LanguagePreference;
}

function isStoredLocale(value: unknown): value is StoredLocale {
  const v = value as Partial<StoredLocale> | null;
  return !!v && (v.preference === 'system' || isSupportedLocale(String(v.preference)));
}

const store = new JsonStore<StoredLocale>('@bar/locale', isStoredLocale, { preference: 'system' });

function detectSystemLocale(): Locale {
  const tags = Localization.getLocales();
  const languageCode = tags[0]?.languageCode;
  return languageCode && isSupportedLocale(languageCode) ? languageCode : 'en';
}

interface LocaleState {
  preference: LanguagePreference;
  locale: Locale;
  isLoaded: boolean;
  load: () => Promise<void>;
  setLanguage: (preference: LanguagePreference) => Promise<void>;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  preference: 'system',
  locale: 'en',
  isLoaded: false,

  load: async () => {
    const stored = await store.read();
    const resolved = stored.preference === 'system' ? detectSystemLocale() : stored.preference;
    set({ preference: stored.preference, locale: resolved, isLoaded: true });
  },

  setLanguage: async (preference) => {
    const resolved = preference === 'system' ? detectSystemLocale() : preference;
    set({ preference, locale: resolved });
    await store.write({ preference });
  },
}));
