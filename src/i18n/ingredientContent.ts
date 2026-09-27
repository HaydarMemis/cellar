import { Ingredient } from '../domain/types';
import { ingredientContentOverrides } from './locales/tr/ingredientContent';
import { Locale } from './types';

export interface IngredientContent {
  description?: string;
  homemadeSteps?: string[];
  homemadeStorageNote?: string;
}

/**
 * Resolves locale-appropriate prose for the ingredient encyclopedia. Same
 * pattern as getCocktailContent: English is single-sourced on the
 * Ingredient record, Turkish is an overlay that falls back per-field.
 */
export function getIngredientContent(ingredient: Ingredient, locale: Locale): IngredientContent {
  const englishHomemade = ingredient.homemadeRecipe
    ? { homemadeSteps: ingredient.homemadeRecipe.steps, homemadeStorageNote: ingredient.homemadeRecipe.storageNote }
    : {};

  if (locale === 'en') {
    return { description: ingredient.description, ...englishHomemade };
  }

  const override = ingredientContentOverrides[ingredient.id];
  return {
    description: override?.description ?? ingredient.description,
    homemadeSteps: override?.homemadeSteps ?? englishHomemade.homemadeSteps,
    homemadeStorageNote: override?.homemadeStorageNote ?? englishHomemade.homemadeStorageNote,
  };
}
