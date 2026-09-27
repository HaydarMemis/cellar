import { Cocktail, PersonalRecipe } from '../../../domain/types';
import { catalogPhotoUri, drinkPhotoUri } from '../DrinkVisualSources';

const mockManifest: Record<string, unknown> = {};
jest.mock('../../../data/catalog/mediaManifest', () => ({
  getCocktailMedia: (id: string) => mockManifest[id],
}));

const cocktail = { id: 'negroni', baseSpirit: 'gin', imageUrl: 'https://unlicensed.example.com/negroni.jpg' } as unknown as Cocktail;

describe('catalog photos respect the license gate', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockManifest)) delete mockManifest[key];
  });

  it('never falls back to a cocktail imageUrl without an approved, licensed manifest entry', () => {
    expect(catalogPhotoUri('negroni')).toBeUndefined();
    expect(drinkPhotoUri({ kind: 'cocktail', item: cocktail })).toBeUndefined();
  });

  it('a pending (not yet approved) manifest entry is not shown either', () => {
    mockManifest.negroni = { cocktailId: 'negroni', status: 'pending-review', imageUrl: 'https://cdn/negroni.jpg', source: 'commissioned', license: 'original' };
    expect(drinkPhotoUri({ kind: 'cocktail', item: cocktail })).toBeUndefined();
  });

  it('an approved, valid manifest entry is shown', () => {
    mockManifest.negroni = { cocktailId: 'negroni', status: 'approved', imageUrl: 'https://cdn/negroni.jpg', source: 'commissioned', license: 'original' };
    expect(drinkPhotoUri({ kind: 'cocktail', item: cocktail })).toBe('https://cdn/negroni.jpg');
  });
});

describe('recipe photos', () => {
  it('a stored relative reference is resolved against the documents directory', () => {
    const recipe = { id: 'r', photoUri: 'recipe-photos/a.jpg' } as PersonalRecipe;
    expect(drinkPhotoUri({ kind: 'recipe', item: recipe })).toMatch(/^file:\/\/.*\/recipe-photos\/a\.jpg$/);
  });

  it('a published https photo is used as-is', () => {
    const recipe = { id: 'r', photoUri: 'https://x/photo?v=1' } as PersonalRecipe;
    expect(drinkPhotoUri({ kind: 'recipe', item: recipe })).toBe('https://x/photo?v=1');
  });
});
