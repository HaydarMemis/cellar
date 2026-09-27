import { Cocktail } from '../../../domain/types';
import { ingredientsById } from '../ingredients';
import { additions } from './additions';
import { additions2 } from './additions2';
import { additions3 } from './additions3';
import { additions4 } from './additions4';
import { alcoholFree } from './alcoholFree';
import { classics } from './classics';
import { contemporary } from './contemporary';
import { highballs } from './highballs';
import { sours } from './sours';
import { tiki } from './tiki';

const allCocktails: Cocktail[] = [
  ...classics,
  ...sours,
  ...highballs,
  ...tiki,
  ...contemporary,
  ...alcoholFree,
  ...additions,
  ...additions2,
  ...additions3,
  ...additions4,
];

function isValid(cocktail: Cocktail): boolean {
  return cocktail.ingredients.every((ri) => ingredientsById.has(ri.ingredientId));
}

const invalid = allCocktails.filter((c) => !isValid(c));
if (invalid.length > 0) {
  const names = invalid.map((c) => c.id).join(', ');
  if (__DEV__) {
    throw new Error(`Catalog cocktails reference unknown ingredient ids: ${names}`);
  }
}

/** Built-in catalog, validated against the ingredient list at load time. */
export const cocktails: Cocktail[] = allCocktails.filter(isValid);

export const cocktailsById: ReadonlyMap<string, Cocktail> = new Map(
  cocktails.map((c) => [c.id, c]),
);
