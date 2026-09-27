import { getByPath, interpolate, resolveLeaf, translateFrom } from '../translate';

describe('getByPath', () => {
  const dict = { a: { b: { c: 'deep value' } }, top: 'shallow' };

  it('resolves a nested dot path', () => {
    expect(getByPath(dict, 'a.b.c')).toBe('deep value');
  });

  it('resolves a top-level path', () => {
    expect(getByPath(dict, 'top')).toBe('shallow');
  });

  it('returns undefined for a missing path', () => {
    expect(getByPath(dict, 'a.b.missing')).toBeUndefined();
    expect(getByPath(dict, 'nope')).toBeUndefined();
  });

  it('does not throw when traversing through a non-object', () => {
    expect(getByPath(dict, 'top.anything')).toBeUndefined();
  });
});

describe('interpolate', () => {
  it('substitutes a single token', () => {
    expect(interpolate('Hello {{name}}', { name: 'World' })).toBe('Hello World');
  });

  it('substitutes multiple tokens', () => {
    expect(interpolate('{{a}} and {{b}}', { a: 'X', b: 'Y' })).toBe('X and Y');
  });

  it('leaves an unmatched token placeholder untouched', () => {
    expect(interpolate('Hello {{name}}', {})).toBe('Hello {{name}}');
  });

  it('passes a template through unchanged when there are no options', () => {
    expect(interpolate('Plain text')).toBe('Plain text');
  });

  it('stringifies a numeric token value', () => {
    expect(interpolate('{{count}} items', { count: 5 })).toBe('5 items');
  });
});

describe('resolveLeaf — pluralization (the "youCanMake" / "selectedCount" strings)', () => {
  const plural = { one: '{{count}} item', other: '{{count}} items' };

  it('picks the singular form for count === 1', () => {
    expect(resolveLeaf(plural, { count: 1 })).toBe('1 item');
  });

  it('picks the plural form for count === 0', () => {
    expect(resolveLeaf(plural, { count: 0 })).toBe('0 items');
  });

  it('picks the plural form for count > 1', () => {
    expect(resolveLeaf(plural, { count: 7 })).toBe('7 items');
  });

  it('picks the plural form when no count is given at all', () => {
    expect(resolveLeaf(plural, undefined)).toBe('{{count}} items');
  });

  it('resolves a plain string leaf with interpolation', () => {
    expect(resolveLeaf('Hi {{name}}', { name: 'Ada' })).toBe('Hi Ada');
  });

  it('returns an empty string for an unrecognized leaf shape', () => {
    expect(resolveLeaf(42)).toBe('');
    expect(resolveLeaf(null)).toBe('');
    expect(resolveLeaf({ not: 'plural' })).toBe('');
  });
});

describe('translateFrom', () => {
  const dict = {
    common: { save: 'Save' },
    ingredientsTool: { youCanMake: { one: 'You can make {{count}} cocktail', other: 'You can make {{count}} cocktails' } },
  };

  it('resolves and interpolates a nested string key', () => {
    expect(translateFrom(dict, 'common.save')).toBe('Save');
  });

  it('resolves and pluralizes a nested plural key', () => {
    expect(translateFrom(dict, 'ingredientsTool.youCanMake', { count: 1 })).toBe('You can make 1 cocktail');
    expect(translateFrom(dict, 'ingredientsTool.youCanMake', { count: 3 })).toBe('You can make 3 cocktails');
  });

  it('falls back to returning the key itself when nothing is found, rather than throwing or rendering blank', () => {
    expect(translateFrom(dict, 'this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });
});
