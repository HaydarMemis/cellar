import { cocktails } from '../../data/catalog/cocktails/index';
import { ingredients, ingredientsById } from '../../data/catalog/ingredients';
import { getKnownNoteTranslationKeys } from '../../i18n/ingredientNotes';
import { discoveryCollections, getCollectionCocktails } from '../discovery';
import { difficultyOptionIds, tasteOptionIds } from '../filterOptions';
import { getFeatured } from '../homeSections';
import { ingredientSubstitutions } from '../substitutions';
import { Difficulty, FlavorNote, PreparationMethod } from '../types';

const validDifficulties = new Set<Difficulty>(difficultyOptionIds);
const validMethods = new Set<PreparationMethod>(['shake', 'stir', 'build', 'blend', 'muddle', 'layer']);
const validFlavorNotes = new Set<FlavorNote>([
  'sweet',
  'sour',
  'bitter',
  'herbal',
  'spicy',
  'smoky',
  'fruity',
  'floral',
  'nutty',
  'rich',
  'citrus',
  'earthy',
]);

/**
 * Broader catalog integrity than catalog.test.ts/ingredients.test.ts cover —
 * see the production-readiness audit's data integrity section. These are
 * cross-cutting invariants: substitution pairs reference real ingredients,
 * curated collections reference real cocktails, prep times and difficulty/
 * method enums are sane, no cocktail or ingredient id is malformed.
 */
describe('cross-cutting catalog integrity', () => {
  it('every substitution pair references two real, known ingredient ids', () => {
    for (const sub of ingredientSubstitutions) {
      expect(ingredientsById.has(sub.a)).toBe(true);
      expect(ingredientsById.has(sub.b)).toBe(true);
    }
  });

  it('a substitution pair never references the same ingredient on both sides', () => {
    for (const sub of ingredientSubstitutions) {
      expect(sub.a).not.toBe(sub.b);
    }
  });

  it('every curated discovery collection references only real, existing cocktail ids', () => {
    for (const collection of discoveryCollections) {
      if (collection.kind !== 'curated' || !collection.cocktailIds) continue;
      const resolved = getCollectionCocktails(collection, cocktails);
      expect(resolved.length).toBe(collection.cocktailIds.length);
    }
  });

  it('curated discovery collections have no duplicate cocktail ids within themselves', () => {
    for (const collection of discoveryCollections) {
      if (collection.kind !== 'curated' || !collection.cocktailIds) continue;
      expect(new Set(collection.cocktailIds).size).toBe(collection.cocktailIds.length);
    }
  });

  it("Home's featured list fully resolves — every hardcoded featured id is a real cocktail", () => {
    // getFeatured silently drops any id that no longer resolves; asserting
    // the exact expected count catches a stale id immediately rather than
    // letting the section quietly shrink.
    expect(getFeatured(cocktails)).toHaveLength(8);
  });

  it('every cocktail has a sane, positive prep time (under 2 hours)', () => {
    for (const cocktail of cocktails) {
      expect(cocktail.prepTimeMinutes).toBeGreaterThan(0);
      expect(cocktail.prepTimeMinutes).toBeLessThanOrEqual(120);
    }
  });

  it('every cocktail uses a known difficulty and method enum value', () => {
    for (const cocktail of cocktails) {
      expect(validDifficulties.has(cocktail.difficulty)).toBe(true);
      expect(validMethods.has(cocktail.method)).toBe(true);
    }
  });

  it('every cocktail tag is within the known taste vocabulary', () => {
    const validTastes = new Set<string>(tasteOptionIds);
    for (const cocktail of cocktails) {
      for (const tag of cocktail.tags) {
        expect(validTastes.has(tag)).toBe(true);
      }
    }
  });

  it('abv, when present, is a realistic percentage (0–100, exclusive of 0)', () => {
    for (const cocktail of cocktails) {
      if (!cocktail.abv) continue;
      expect(cocktail.abv.approx).toBeGreaterThan(0);
      expect(cocktail.abv.approx).toBeLessThan(100);
    }
  });

  it('every ingredient id is a non-empty, lowercase, kebab-case-safe string', () => {
    const idPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const ingredient of ingredients) {
      expect(ingredient.id).toMatch(idPattern);
    }
  });

  it('every cocktail id is a non-empty, lowercase, kebab-case-safe string', () => {
    const idPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const cocktail of cocktails) {
      expect(cocktail.id).toMatch(idPattern);
    }
  });

  it('every ingredient flavor note is a known, valid FlavorNote value', () => {
    for (const ingredient of ingredients) {
      for (const note of ingredient.flavorProfile ?? []) {
        expect(validFlavorNotes.has(note)).toBe(true);
      }
    }
  });

  it('never lists the same ingredient id twice among required ingredients without a distinguishing note (an undistinguished duplicate is almost certainly a copy-paste mistake; a genuine two-pour recipe like Penicillin\'s base + peated float always carries a note on each)', () => {
    for (const cocktail of cocktails) {
      const required = cocktail.ingredients.filter((ri) => !ri.isOptional && !ri.isGarnish);
      const seen = new Map<string, number>();
      for (const ri of required) {
        seen.set(ri.ingredientId, (seen.get(ri.ingredientId) ?? 0) + 1);
      }
      for (const [ingredientId, count] of seen) {
        if (count < 2) continue;
        const occurrences = required.filter((ri) => ri.ingredientId === ingredientId);
        const allDistinguished = occurrences.every((ri) => !!ri.note?.trim());
        expect(allDistinguished).toBe(true);
      }
    }
  });

  it('every RecipeIngredient amount, when present, has a positive value', () => {
    for (const cocktail of cocktails) {
      for (const ri of cocktail.ingredients) {
        if (ri.amount) expect(ri.amount.value).toBeGreaterThan(0);
      }
    }
  });

  it('a cocktail with baseSpirit "alcohol-free" never references an alcoholic ingredient as a required (non-optional) component', () => {
    for (const cocktail of cocktails) {
      if (cocktail.baseSpirit !== 'alcohol-free') continue;
      for (const ri of cocktail.ingredients.filter((r) => !r.isOptional)) {
        const ingredient = ingredientsById.get(ri.ingredientId);
        expect(ingredient?.isAlcoholic).not.toBe(true);
      }
    }
  });

  it('every catalog ingredient note has a Turkish translation entry (regression: notes used to render in raw English regardless of locale — see ingredientNotes.ts)', () => {
    const known = new Set(getKnownNoteTranslationKeys());
    const missing = new Set<string>();
    for (const cocktail of cocktails) {
      for (const ri of cocktail.ingredients) {
        if (ri.note && !known.has(ri.note)) missing.add(ri.note);
      }
    }
    expect(Array.from(missing)).toEqual([]);
  });
});
