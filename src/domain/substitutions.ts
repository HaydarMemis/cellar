/**
 * Explicit, curated ingredient substitution pairs — never inferred or
 * AI-generated (see project brief). Each pair is symmetric (either side can
 * stand in for the other) and carries a translation key for a short note
 * explaining the tradeoff, shown in the UI and used nowhere in matching
 * logic itself (matching only needs the id graph).
 */
export interface IngredientSubstitution {
  a: string;
  b: string;
  /** i18n key suffix; the full key is `substitutions.notes.<noteKey>` */
  noteKey: string;
}

export const ingredientSubstitutions: IngredientSubstitution[] = [
  { a: 'lime-juice', b: 'lemon-juice', noteKey: 'citrusSwap' },
  { a: 'simple-syrup', b: 'agave-syrup', noteKey: 'sweetenerSwap' },
  { a: 'simple-syrup', b: 'honey-syrup', noteKey: 'sweetenerSwap' },
  { a: 'bourbon', b: 'rye-whiskey', noteKey: 'whiskeySwap' },
  { a: 'white-rum', b: 'gold-rum', noteKey: 'rumSwap' },
  { a: 'dark-rum', b: 'gold-rum', noteKey: 'rumSwap' },
  { a: 'mezcal', b: 'blanco-tequila', noteKey: 'smokySwap' },
  { a: 'ginger-beer', b: 'ginger-ale', noteKey: 'gingerSwap' },
  { a: 'gin', b: 'vodka', noteKey: 'neutralSwap' },
  { a: 'angostura-bitters', b: 'peychauds-bitters', noteKey: 'bittersSwap' },
];

const substitutesById: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const sub of ingredientSubstitutions) {
    map.set(sub.a, [...(map.get(sub.a) ?? []), sub.b]);
    map.set(sub.b, [...(map.get(sub.b) ?? []), sub.a]);
  }
  return map;
})();

/** Every ingredient id that can reasonably stand in for `ingredientId`. */
export function getSubstitutesFor(ingredientId: string): string[] {
  return substitutesById.get(ingredientId) ?? [];
}

export function hasSubstitutes(ingredientId: string): boolean {
  return substitutesById.has(ingredientId);
}

/** The translation key for the note on a specific substitution pair, if one is defined (order-independent). */
export function getSubstitutionNoteKey(a: string, b: string): string | undefined {
  return ingredientSubstitutions.find((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a))?.noteKey;
}
