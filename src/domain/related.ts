import { getSpiritGroup } from './spiritGroups';
import { Cocktail } from './types';

/**
 * "You may also like" is computed from shared spirit group / category /
 * tags rather than hand-authored per cocktail — see project plan (Audit
 * item, similarCocktailIds). Keeps the catalog self-maintaining as entries
 * are added.
 */
export function getRelatedCocktails(
  target: Cocktail,
  all: Cocktail[],
  limit = 6,
): Cocktail[] {
  const targetGroup = getSpiritGroup(target.baseSpirit);

  const scored = all
    .filter((c) => c.id !== target.id)
    .map((c) => {
      let score = 0;
      if (getSpiritGroup(c.baseSpirit) === targetGroup) score += 2;
      score += c.category.filter((cat) => target.category.includes(cat)).length;
      score += c.tags.filter((tag) => target.tags.includes(tag)).length;
      return { cocktail: c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.cocktail);
}
