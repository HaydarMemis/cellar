import { useCallback } from 'react';
import { useLocaleStore } from '../state/localeStore';
import { Amount, Cocktail, Ingredient } from '../domain/types';
import { computeDisplayAmount, UnitPreference } from '../domain/formatAmount';
import { formatQuantity, getHouseholdApproximation } from '../domain/measurementApproximation';
import { CocktailContent, getCocktailContent } from './cocktailContent';
import { ingredientNameDictionaries, uiDictionaries, vocabDictionaries } from './dictionaries';
import { formatLocaleNumber } from './formatNumber';
import { getIngredientContent, IngredientContent } from './ingredientContent';
import { translateIngredientNote } from './ingredientNotes';
import { getByPath, TranslateOptions, translateFrom } from './translate';
import { PathsOf } from './types';

type UiDict = typeof uiDictionaries.en;
export type UiKey = PathsOf<UiDict>;

type VocabDict = typeof vocabDictionaries.en;
export type VocabKey = PathsOf<VocabDict>;

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);

  const t = useCallback(
    (key: UiKey, options?: TranslateOptions): string => translateFrom(uiDictionaries[locale], key, options),
    [locale],
  );

  const tVocab = useCallback(
    (key: VocabKey): string => {
      const raw = getByPath(vocabDictionaries[locale], key);
      return typeof raw === 'string' ? raw : key;
    },
    [locale],
  );

  const tIngredient = useCallback(
    (ingredientId: string): string =>
      ingredientNameDictionaries[locale][ingredientId] ?? ingredientNameDictionaries.en[ingredientId] ?? ingredientId,
    [locale],
  );

  const tNumber = useCallback((value: number, maxFractionDigits = 2) => formatLocaleNumber(value, locale, maxFractionDigits), [locale]);

  const tAmount = useCallback(
    (amount: Amount, preference: UnitPreference): string => {
      const { value, unit } = computeDisplayAmount(amount, preference);
      const unitLabel = tVocab(`unit.${unit}`);
      return `${tNumber(value)} ${unitLabel}`.trim();
    },
    [tVocab, tNumber],
  );

  /**
   * A practical household approximation of a precise amount ("≈ 1 tbsp"),
   * or null when there's nothing useful to show — the unit is already
   * practical (dash, piece…), the pour is too large to bother measuring,
   * or the approximation would just repeat the precise display (both land
   * on oz). The precise amount from `tAmount` stays authoritative; this is
   * always a secondary, supplementary line.
   */
  const tApprox = useCallback(
    (amount: Amount, preference: UnitPreference): string | null => {
      const approx = getHouseholdApproximation(amount);
      if (!approx) return null;
      if (approx.unit === 'oz' && preference === 'oz') return null;
      const unitLabel = tVocab(`unit.${approx.unit}`);
      return `≈ ${formatQuantity(approx.value)} ${unitLabel}`;
    },
    [tVocab],
  );

  const tCocktail = useCallback(
    (cocktail: Cocktail): CocktailContent => getCocktailContent(cocktail, locale),
    [locale],
  );

  const tIngredientContent = useCallback(
    (ingredient: Ingredient): IngredientContent => getIngredientContent(ingredient, locale),
    [locale],
  );

  /** Catalog-cocktail ingredient notes only ("top with soda water", "floated on top"...) — never call this on a personal recipe's note, which is the user's own words and must render as-entered. See ingredientNotes.ts. */
  const tNote = useCallback((note: string): string => translateIngredientNote(note, locale), [locale]);

  return { t, tVocab, tIngredient, tNumber, tAmount, tApprox, tCocktail, tIngredientContent, tNote, locale };
}
