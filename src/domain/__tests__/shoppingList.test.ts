import { buildShoppingList } from '../shoppingList';
import { RecipeIngredient } from '../types';

function ing(id: string, isGarnish = false): RecipeIngredient {
  return { ingredientId: id, amount: { value: 30, unit: 'ml' }, isOptional: false, isGarnish };
}

describe('buildShoppingList', () => {
  it('excludes ingredients already in the inventory', () => {
    const list = buildShoppingList([[ing('gin'), ing('tonic-water')]], new Set(['gin']));
    expect(list.map((i) => i.ingredientId)).toEqual(['tonic-water']);
  });

  it('excludes garnish ingredients', () => {
    const list = buildShoppingList([[ing('gin'), ing('mint-leaves', true)]], new Set());
    expect(list.map((i) => i.ingredientId)).toEqual(['gin']);
  });

  it('deduplicates an ingredient needed by multiple recipes and counts how many need it', () => {
    const list = buildShoppingList([[ing('lime-juice')], [ing('lime-juice'), ing('white-rum')]], new Set());
    const lime = list.find((i) => i.ingredientId === 'lime-juice');
    const rum = list.find((i) => i.ingredientId === 'white-rum');
    expect(lime?.neededForCount).toBe(2);
    expect(rum?.neededForCount).toBe(1);
  });

  it('sorts by how many recipes need each ingredient, most first', () => {
    const list = buildShoppingList([[ing('lime-juice')], [ing('lime-juice')], [ing('gin')]], new Set());
    expect(list[0].ingredientId).toBe('lime-juice');
  });

  it('returns an empty list when every ingredient is already available', () => {
    const list = buildShoppingList([[ing('gin'), ing('tonic-water')]], new Set(['gin', 'tonic-water']));
    expect(list).toEqual([]);
  });
});
