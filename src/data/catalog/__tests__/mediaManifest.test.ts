import { isMediaEntryValid } from '../../../domain/mediaManifest';
import { cocktailMediaManifest, cocktails, getCocktailMedia } from '../index';

describe('cocktailMediaManifest', () => {
  it('has exactly one entry per catalog cocktail, in sync with the live catalog', () => {
    expect(cocktailMediaManifest).toHaveLength(cocktails.length);
    const manifestIds = new Set(cocktailMediaManifest.map((e) => e.cocktailId));
    for (const cocktail of cocktails) {
      expect(manifestIds.has(cocktail.id)).toBe(true);
    }
  });

  it('honestly reports every entry as "missing" — no licensed photo source is connected, so nothing here may claim otherwise', () => {
    for (const entry of cocktailMediaManifest) {
      expect(entry.status).toBe('missing');
    }
  });

  it('every entry passes isMediaEntryValid — a "missing" entry needs no licensing fields', () => {
    for (const entry of cocktailMediaManifest) {
      expect(isMediaEntryValid(entry)).toBe(true);
    }
  });

  it('a status of "approved" without a license/source/imageUrl is rejected by isMediaEntryValid', () => {
    expect(isMediaEntryValid({ cocktailId: 'x', status: 'approved' })).toBe(false);
    expect(
      isMediaEntryValid({ cocktailId: 'x', status: 'approved', imageUrl: 'https://example.com/a.jpg', source: 'commissioned', license: 'original' }),
    ).toBe(true);
  });

  it('a CC-BY-licensed entry without attribution is rejected', () => {
    expect(
      isMediaEntryValid({
        cocktailId: 'x',
        status: 'approved',
        imageUrl: 'https://example.com/a.jpg',
        source: 'unsplash',
        license: 'CC-BY',
      }),
    ).toBe(false);
    expect(
      isMediaEntryValid({
        cocktailId: 'x',
        status: 'approved',
        imageUrl: 'https://example.com/a.jpg',
        source: 'unsplash',
        license: 'CC-BY',
        attribution: 'Photo by Jane Doe on Unsplash',
      }),
    ).toBe(true);
  });

  it('getCocktailMedia resolves a real cocktail id and returns undefined for an unknown one', () => {
    const first = cocktails[0];
    expect(getCocktailMedia(first.id)?.cocktailId).toBe(first.id);
    expect(getCocktailMedia('not-a-real-cocktail-id')).toBeUndefined();
  });
});
