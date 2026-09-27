import { getSubstitutesFor, getSubstitutionNoteKey, hasSubstitutes } from '../substitutions';

describe('getSubstitutesFor', () => {
  it('is symmetric — returns b for a and a for b', () => {
    expect(getSubstitutesFor('lime-juice')).toContain('lemon-juice');
    expect(getSubstitutesFor('lemon-juice')).toContain('lime-juice');
  });

  it('returns every substitute when an ingredient appears in multiple pairs', () => {
    // gold-rum substitutes for both white-rum and dark-rum.
    const subs = getSubstitutesFor('gold-rum');
    expect(subs).toEqual(expect.arrayContaining(['white-rum', 'dark-rum']));
  });

  it('returns an empty array for an ingredient with no defined substitute', () => {
    expect(getSubstitutesFor('egg-white')).toEqual([]);
    expect(getSubstitutesFor('not-a-real-ingredient')).toEqual([]);
  });
});

describe('hasSubstitutes', () => {
  it('is true for an ingredient with a defined substitution', () => {
    expect(hasSubstitutes('lime-juice')).toBe(true);
  });

  it('is false for an ingredient with none', () => {
    expect(hasSubstitutes('egg-white')).toBe(false);
  });
});

describe('getSubstitutionNoteKey', () => {
  it('finds the note regardless of argument order', () => {
    expect(getSubstitutionNoteKey('lime-juice', 'lemon-juice')).toBe('citrusSwap');
    expect(getSubstitutionNoteKey('lemon-juice', 'lime-juice')).toBe('citrusSwap');
  });

  it('returns undefined for a pair with no defined substitution', () => {
    expect(getSubstitutionNoteKey('gin', 'egg-white')).toBeUndefined();
  });
});
