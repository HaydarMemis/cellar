import { cocktails, cocktailsById } from '../catalog';
import { Cocktail } from '../../domain/types';

/**
 * Read-only — the built-in catalog is bundled, never mutated. Defined as an
 * interface (rather than importing the catalog module directly from
 * screens/state) so a future backend-backed catalog can implement the same
 * shape without touching callers.
 */
export interface CocktailRepository {
  getAll(): Cocktail[];
  getById(id: string): Cocktail | undefined;
}

export const catalogCocktailRepository: CocktailRepository = {
  getAll: () => cocktails,
  getById: (id) => cocktailsById.get(id),
};
