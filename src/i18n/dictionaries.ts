import { ingredientNames as ingredientNamesEn } from './locales/en/ingredients';
import { ui as uiEn } from './locales/en/ui';
import { vocab as vocabEn } from './locales/en/vocab';
import { ingredientNames as ingredientNamesTr } from './locales/tr/ingredients';
import { ui as uiTr } from './locales/tr/ui';
import { vocab as vocabTr } from './locales/tr/vocab';
import { DeepDict, Locale } from './types';

export const uiDictionaries: Record<Locale, DeepDict<typeof uiEn>> = { en: uiEn, tr: uiTr };
export const vocabDictionaries: Record<Locale, DeepDict<typeof vocabEn>> = { en: vocabEn, tr: vocabTr };
export const ingredientNameDictionaries: Record<Locale, Record<string, string>> = {
  en: ingredientNamesEn,
  tr: ingredientNamesTr,
};
