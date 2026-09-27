import { typeOptionIds } from '../../../domain/filterOptions';
import { GlassType } from '../../../domain/types';
import { catalogOverrides } from '../../../i18n/locales/tr/catalog';
import { ingredientNames as ingredientNamesTr } from '../../../i18n/locales/tr/ingredients';
import { cocktails } from '../cocktails/index';
import { ingredients, ingredientsById } from '../ingredients';

const validTypeIds = new Set<string>(typeOptionIds);
const validGlassIds = new Set<GlassType>([
  'rocks',
  'coupe',
  'martini',
  'collins',
  'highball',
  'copper-mug',
  'julep-cup',
  'hurricane',
  'flute',
  'wine-glass',
  'irish-coffee-glass',
  'pint-glass',
  'tiki-mug',
  'nick-and-nora',
  'snifter',
  'shot',
  'mug',
  'other',
]);

describe('cocktail catalog integrity', () => {
  it('ships a meaningful number of cocktails', () => {
    expect(cocktails.length).toBeGreaterThanOrEqual(50);
  });

  it('has unique ids', () => {
    const ids = cocktails.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references only known ingredient ids', () => {
    for (const cocktail of cocktails) {
      for (const ri of cocktail.ingredients) {
        expect(ingredientsById.has(ri.ingredientId)).toBe(true);
      }
    }
  });

  it('uses only known category (type filter) vocabulary', () => {
    for (const cocktail of cocktails) {
      for (const cat of cocktail.category) {
        expect(validTypeIds.has(cat)).toBe(true);
      }
    }
  });

  it('uses only known glass type ids', () => {
    for (const cocktail of cocktails) {
      expect(cocktail.glass.length).toBeGreaterThan(0);
      for (const g of cocktail.glass) {
        expect(validGlassIds.has(g)).toBe(true);
      }
    }
  });

  it('gives every cocktail at least one ingredient and one step', () => {
    for (const cocktail of cocktails) {
      expect(cocktail.ingredients.length).toBeGreaterThan(0);
      expect(cocktail.steps.length).toBeGreaterThan(0);
    }
  });

  it('marks alcohol-free drinks with a null abv and everything else with an approx value', () => {
    for (const cocktail of cocktails) {
      if (cocktail.baseSpirit === 'alcohol-free') {
        expect(cocktail.abv).toBeNull();
      } else {
        expect(cocktail.abv?.approx).toBeGreaterThan(0);
      }
    }
  });
});

describe('localization completeness', () => {
  it('has a Turkish name for every ingredient', () => {
    for (const ingredient of ingredients) {
      expect(ingredientNamesTr[ingredient.id]).toBeTruthy();
    }
  });

  it('has a Turkish description and at least one step for every cocktail', () => {
    for (const cocktail of cocktails) {
      const override = catalogOverrides[cocktail.id];
      expect(override).toBeDefined();
      expect(override.description.trim().length).toBeGreaterThan(0);
      expect(override.steps.length).toBe(cocktail.steps.length);
      for (const step of override.steps) {
        expect(step.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('has no stray overlay entries for cocktails that no longer exist', () => {
    const ids = new Set(cocktails.map((c) => c.id));
    for (const overrideId of Object.keys(catalogOverrides)) {
      expect(ids.has(overrideId)).toBe(true);
    }
  });
});
