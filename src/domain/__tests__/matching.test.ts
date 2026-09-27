import { canMake, matchCocktail, matchCocktails, missingIngredientIds, rankMatches } from '../matching';
import { Cocktail, RecipeIngredient } from '../types';

function req(ingredientId: string): RecipeIngredient {
  return { ingredientId, amount: { value: 30, unit: 'ml' }, isOptional: false, isGarnish: false };
}

function opt(ingredientId: string): RecipeIngredient {
  return { ingredientId, amount: { value: 1, unit: 'dash' }, isOptional: true, isGarnish: false };
}

function garnish(ingredientId: string): RecipeIngredient {
  return { ingredientId, amount: null, isOptional: false, isGarnish: true };
}

function makeCocktail(overrides: Partial<Cocktail> & { id: string; ingredients: RecipeIngredient[] }): Cocktail {
  return {
    name: overrides.id,
    description: '',
    baseSpirit: 'gin',
    category: [],
    tags: [],
    method: 'stir',
    steps: [],
    glass: ['coupe'],
    abv: { approx: 20 },
    difficulty: 'easy',
    prepTimeMinutes: 3,
    similarCocktailIds: [],
    ...overrides,
  };
}

describe('canMake', () => {
  it('is true when every required ingredient is in inventory', () => {
    const ingredients = [req('gin'), req('lime-juice')];
    expect(canMake(ingredients, new Set(['gin', 'lime-juice', 'tonic-water']))).toBe(true);
  });

  it('is false when a required ingredient is missing', () => {
    const ingredients = [req('gin'), req('lime-juice')];
    expect(canMake(ingredients, new Set(['gin']))).toBe(false);
  });

  it('ignores optional ingredients entirely', () => {
    const ingredients = [req('gin'), opt('egg-white')];
    expect(canMake(ingredients, new Set(['gin']))).toBe(true);
  });

  it('ignores garnish ingredients entirely', () => {
    const ingredients = [req('gin'), garnish('mint-leaves')];
    expect(canMake(ingredients, new Set(['gin']))).toBe(true);
  });

  it('credits a required ingredient as available via a known substitute', () => {
    const ingredients = [req('gin'), req('lime-juice')];
    // User has lemon-juice, not lime-juice — they're substitutes.
    expect(canMake(ingredients, new Set(['gin', 'lemon-juice']))).toBe(true);
  });
});

describe('missingIngredientIds', () => {
  it('lists only missing required ingredients', () => {
    const ingredients = [req('gin'), req('lime-juice'), opt('egg-white')];
    expect(missingIngredientIds(ingredients, new Set(['gin']))).toEqual(['lime-juice']);
  });

  it('does not list an ingredient covered by a substitute the user has', () => {
    const ingredients = [req('gin'), req('lime-juice')];
    expect(missingIngredientIds(ingredients, new Set(['gin', 'lemon-juice']))).toEqual([]);
  });
});

describe('matchCocktail', () => {
  it('is a full match when everything required is available', () => {
    const cocktail = makeCocktail({ id: 'negroni', ingredients: [req('gin'), req('campari'), req('sweet-vermouth')] });
    const match = matchCocktail(cocktail, new Set(['gin', 'campari', 'sweet-vermouth']));
    expect(match.tier).toBe('full');
    expect(match.percentage).toBe(1);
    expect(match.missing).toEqual([]);
  });

  it('is a "high" match when exactly one required ingredient is missing', () => {
    const cocktail = makeCocktail({ id: 'martini', ingredients: [req('gin'), req('dry-vermouth')] });
    const match = matchCocktail(cocktail, new Set(['gin']));
    expect(match.tier).toBe('high');
    expect(match.missing.map((m) => m.ingredientId)).toEqual(['dry-vermouth']);
  });

  it('is a "partial" match when exactly two required ingredients are missing', () => {
    const cocktail = makeCocktail({
      id: 'whiskey-sour',
      ingredients: [req('bourbon'), req('lemon-juice'), req('simple-syrup')],
    });
    const match = matchCocktail(cocktail, new Set(['bourbon']));
    expect(match.tier).toBe('partial');
    expect(match.missing).toHaveLength(2);
  });

  it('has no tier (excluded from results) when three or more required ingredients are missing', () => {
    // None of these have a defined substitute, so this is a clean 1-have / 3-missing case.
    const cocktail = makeCocktail({
      id: 'complex',
      ingredients: [req('gin'), req('cranberry-juice'), req('heavy-cream'), req('coffee-liqueur')],
    });
    const match = matchCocktail(cocktail, new Set(['gin']));
    expect(match.tier).toBeNull();
  });

  it('treats a substitute-covered ingredient as available, not missing', () => {
    const cocktail = makeCocktail({ id: 'daiquiri', ingredients: [req('white-rum'), req('lime-juice')] });
    const match = matchCocktail(cocktail, new Set(['white-rum', 'lemon-juice']));
    expect(match.tier).toBe('full');
  });

  it('suggests a substitute for a missing ingredient when one exists', () => {
    const cocktail = makeCocktail({ id: 'martini', ingredients: [req('gin'), req('dry-vermouth')] });
    const match = matchCocktail(cocktail, new Set(['dry-vermouth']));
    expect(match.missing[0].ingredientId).toBe('gin');
    expect(match.missing[0].substituteId).toBe('vodka');
  });

  it('omits substituteId when no substitute is defined', () => {
    const cocktail = makeCocktail({ id: 'x', ingredients: [req('egg-white')] });
    const match = matchCocktail(cocktail, new Set());
    expect(match.missing[0]).toEqual({ ingredientId: 'egg-white' });
  });

  it('is a full match (100%) for a cocktail with zero required ingredients', () => {
    const cocktail = makeCocktail({ id: 'empty', ingredients: [opt('bitters')] });
    const match = matchCocktail(cocktail, new Set());
    expect(match.tier).toBe('full');
    expect(match.percentage).toBe(1);
  });
});

describe('matchCocktails', () => {
  it('preserves input order', () => {
    const a = makeCocktail({ id: 'a', ingredients: [req('gin')] });
    const b = makeCocktail({ id: 'b', ingredients: [req('vodka')] });
    const matched = matchCocktails([a, b], new Set(['gin', 'vodka']));
    expect(matched.map((m) => m.item.id)).toEqual(['a', 'b']);
  });
});

describe('rankMatches', () => {
  it('ranks full matches before high before partial', () => {
    const full = makeCocktail({ id: 'full', ingredients: [req('gin')] });
    const high = makeCocktail({ id: 'high', ingredients: [req('gin'), req('campari')] });
    const partial = makeCocktail({ id: 'partial', ingredients: [req('gin'), req('campari'), req('soda-water')] });

    const ranked = rankMatches([partial, high, full], new Set(['gin']));
    expect(ranked.map((m) => m.item.id)).toEqual(['full', 'high', 'partial']);
  });

  it('excludes weak matches (3+ missing) from the results entirely', () => {
    const decent = makeCocktail({ id: 'decent', ingredients: [req('gin'), req('campari')] });
    const weak = makeCocktail({
      id: 'weak',
      ingredients: [req('gin'), req('cranberry-juice'), req('heavy-cream'), req('coffee-liqueur')],
    });
    const ranked = rankMatches([decent, weak], new Set(['gin']));
    expect(ranked.map((m) => m.item.id)).toEqual(['decent']);
  });

  it('within the same tier, ranks the easier cocktail first', () => {
    const hard = makeCocktail({ id: 'hard', ingredients: [req('gin'), req('campari')], difficulty: 'hard' });
    const easy = makeCocktail({ id: 'easy', ingredients: [req('vodka'), req('triple-sec')], difficulty: 'easy' });
    // Both are "high" tier: missing exactly one ingredient each.
    const ranked = rankMatches([hard, easy], new Set(['gin', 'vodka']));
    expect(ranked.map((m) => m.item.id)).toEqual(['easy', 'hard']);
  });

  it('within the same tier and difficulty, ranks the quicker cocktail first', () => {
    const slow = makeCocktail({ id: 'slow', ingredients: [req('gin'), req('campari')], prepTimeMinutes: 8 });
    const quick = makeCocktail({ id: 'quick', ingredients: [req('vodka'), req('triple-sec')], prepTimeMinutes: 2 });
    const ranked = rankMatches([slow, quick], new Set(['gin', 'vodka']));
    expect(ranked.map((m) => m.item.id)).toEqual(['quick', 'slow']);
  });

  it('every returned match has a non-null tier', () => {
    const cocktails = [
      makeCocktail({ id: 'a', ingredients: [req('gin')] }),
      makeCocktail({ id: 'b', ingredients: [req('gin'), req('campari')] }),
    ];
    const ranked = rankMatches(cocktails, new Set(['gin']));
    expect(ranked.every((m) => m.tier !== null)).toBe(true);
  });
});

/**
 * Adversarial cases targeting false-positive "you can make this" claims —
 * see the matching correctness audit. The core invariant under test: a
 * "full" match must never imply the user owns every listed ingredient
 * unless `substitutions` is empty; any ingredient covered only via a
 * substitute must appear in `substitutions`, disclosed by ingredient id.
 */
describe('matching correctness — adversarial cases', () => {
  it('never silently claims a "full" match without disclosing which ingredient was substituted', () => {
    // User has vodka, not gin — gin/vodka is a curated substitution.
    const cocktail = makeCocktail({ id: 'vesper-ish', ingredients: [req('gin'), req('lime-juice')] });
    const match = matchCocktail(cocktail, new Set(['vodka', 'lime-juice']));

    expect(match.tier).toBe('full');
    expect(match.missing).toEqual([]);
    // The substitution MUST be disclosed — this is the exact bug being guarded against.
    expect(match.substitutions).toEqual([{ ingredientId: 'gin', substituteId: 'vodka' }]);
  });

  it('a "full" match with no substitution has an empty substitutions list', () => {
    const cocktail = makeCocktail({ id: 'exact', ingredients: [req('gin'), req('lime-juice')] });
    const match = matchCocktail(cocktail, new Set(['gin', 'lime-juice']));
    expect(match.tier).toBe('full');
    expect(match.substitutions).toEqual([]);
  });

  it('4 required ingredients, user has 3 (no substitutes involved) => high tier, 1 missing, no substitute suggested', () => {
    const cocktail = makeCocktail({
      id: 'four-req',
      ingredients: [req('gin'), req('campari'), req('sweet-vermouth'), req('orange-bitters')],
    });
    const match = matchCocktail(cocktail, new Set(['gin', 'campari', 'sweet-vermouth']));
    expect(match.tier).toBe('high');
    expect(match.missing).toEqual([{ ingredientId: 'orange-bitters' }]);
    expect(match.substitutions).toEqual([]);
  });

  it('5 required ingredients, user has only 1 => excluded entirely (3+ missing)', () => {
    const cocktail = makeCocktail({
      id: 'five-req',
      ingredients: [req('gin'), req('campari'), req('sweet-vermouth'), req('orange-bitters'), req('soda-water')],
    });
    const match = matchCocktail(cocktail, new Set(['gin']));
    expect(match.tier).toBeNull();
    expect(match.missing.length).toBeGreaterThanOrEqual(3);
  });

  it('a missing garnish never blocks a match or appears in missing/substitutions', () => {
    const cocktail = makeCocktail({ id: 'garnished', ingredients: [req('gin'), req('lime-juice'), garnish('mint-leaves')] });
    const match = matchCocktail(cocktail, new Set(['gin', 'lime-juice']));
    expect(match.tier).toBe('full');
    expect(match.missing).toEqual([]);
    expect(match.substitutions).toEqual([]);
  });

  it('a missing optional ingredient never blocks a match or appears in missing/substitutions', () => {
    const cocktail = makeCocktail({ id: 'with-optional', ingredients: [req('gin'), req('lime-juice'), opt('egg-white')] });
    const match = matchCocktail(cocktail, new Set(['gin', 'lime-juice']));
    expect(match.tier).toBe('full');
    expect(match.missing).toEqual([]);
  });

  it('multiple simultaneous substitutions are all individually disclosed', () => {
    // Both bourbon/rye and lime/lemon are curated substitution pairs.
    const cocktail = makeCocktail({ id: 'double-sub', ingredients: [req('bourbon'), req('lime-juice')] });
    const match = matchCocktail(cocktail, new Set(['rye-whiskey', 'lemon-juice']));
    expect(match.tier).toBe('full');
    expect(match.substitutions).toHaveLength(2);
    expect(match.substitutions).toEqual(
      expect.arrayContaining([
        { ingredientId: 'bourbon', substituteId: 'rye-whiskey' },
        { ingredientId: 'lime-juice', substituteId: 'lemon-juice' },
      ]),
    );
  });

  it('a missing ingredient only suggests a substitute the user does NOT have — the suggestion is a purchase tip, never a false "you have this" claim', () => {
    const cocktail = makeCocktail({ id: 'sub-suggestion', ingredients: [req('gin'), req('dry-vermouth')] });
    // User has neither gin nor vodka (gin's only curated substitute).
    const match = matchCocktail(cocktail, new Set(['dry-vermouth']));
    expect(match.missing).toEqual([{ ingredientId: 'gin', substituteId: 'vodka' }]);
    // If the user actually had vodka, gin would be in `substitutions`, not `missing` — never both.
    expect(match.substitutions.some((s) => s.ingredientId === 'gin')).toBe(false);
  });

  it('duplicate ids in the inventory set behave identically to a deduplicated set (Set already guarantees this, asserted for regression safety)', () => {
    const cocktail = makeCocktail({ id: 'dup-check', ingredients: [req('gin'), req('lime-juice')] });
    const withDuplicates = new Set(['gin', 'gin', 'lime-juice', 'lime-juice']);
    expect(withDuplicates.size).toBe(2);
    const match = matchCocktail(cocktail, withDuplicates);
    expect(match.tier).toBe('full');
  });

  it('an empty inventory yields no tier once 3+ ingredients are required (and zero requiredAvailable in every case)', () => {
    const cocktail = makeCocktail({ id: 'needs-stuff', ingredients: [req('gin'), req('lime-juice'), req('simple-syrup')] });
    const match = matchCocktail(cocktail, new Set());
    expect(match.tier).toBeNull();
    expect(match.requiredAvailable).toBe(0);
    expect(match.missing).toHaveLength(3);
  });

  it('a stale inventory id (no longer a real ingredient, e.g. removed from the catalog) is simply inert — never matches, never crashes', () => {
    const cocktail = makeCocktail({ id: 'normal', ingredients: [req('gin'), req('lime-juice')] });
    const match = matchCocktail(cocktail, new Set(['stale-ingredient-id-1234', 'gin', 'lime-juice']));
    expect(match.tier).toBe('full');
    expect(match.substitutions).toEqual([]);
  });

  it('an unknown/malformed ingredient id on a recipe is always treated as missing, never crashes, and never falsely matches', () => {
    const cocktail = makeCocktail({ id: 'malformed', ingredients: [req('gin'), req('totally-unknown-ingredient')] });
    const match = matchCocktail(cocktail, new Set(['gin', 'vodka', 'lime-juice']));
    expect(match.missing).toEqual([{ ingredientId: 'totally-unknown-ingredient' }]);
    expect(match.tier).toBe('high');
  });

  it('rankMatches never places a substitution-only "full" match ahead of ranking logic that assumes exactness — substitutions field survives ranking untouched', () => {
    const viaSubstitute = makeCocktail({ id: 'via-sub', ingredients: [req('bourbon')] });
    const exact = makeCocktail({ id: 'exact-match', ingredients: [req('vodka')] });
    const ranked = rankMatches([viaSubstitute, exact], new Set(['rye-whiskey', 'vodka']));
    const viaSubResult = ranked.find((m) => m.item.id === 'via-sub');
    const exactResult = ranked.find((m) => m.item.id === 'exact-match');
    expect(viaSubResult?.substitutions).toEqual([{ ingredientId: 'bourbon', substituteId: 'rye-whiskey' }]);
    expect(exactResult?.substitutions).toEqual([]);
  });
});
