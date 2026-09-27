import { RecipeIngredient, Unit } from '../../domain/types';

/** Terse constructor for catalog RecipeIngredient entries. */
export function ing(
  ingredientId: string,
  value: number | null,
  unit: Unit = 'ml',
  opts: Partial<Pick<RecipeIngredient, 'note' | 'isOptional' | 'isGarnish'>> = {},
): RecipeIngredient {
  return {
    ingredientId,
    amount: value === null ? null : { value, unit },
    isOptional: opts.isOptional ?? false,
    isGarnish: opts.isGarnish ?? false,
    ...(opts.note ? { note: opts.note } : {}),
  };
}
