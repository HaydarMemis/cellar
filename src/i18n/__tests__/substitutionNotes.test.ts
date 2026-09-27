import { ingredientSubstitutions } from '../../domain/substitutions';
import { ui as en } from '../locales/en/ui';
import { ui as tr } from '../locales/tr/ui';

describe('substitution note translations', () => {
  it('has an English and Turkish note for every noteKey referenced by a substitution pair', () => {
    for (const sub of ingredientSubstitutions) {
      const enNote = (en.substitutions.notes as Record<string, string>)[sub.noteKey];
      const trNote = (tr.substitutions.notes as Record<string, string>)[sub.noteKey];
      expect(enNote).toBeTruthy();
      expect(trNote).toBeTruthy();
    }
  });

  it('has no unused note keys left over in the dictionary', () => {
    const usedKeys = new Set(ingredientSubstitutions.map((s) => s.noteKey));
    for (const key of Object.keys(en.substitutions.notes)) {
      expect(usedKeys.has(key)).toBe(true);
    }
  });
});
