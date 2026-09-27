import { Locale } from './types';

/**
 * Free-form ingredient notes on catalog cocktails ("top with soda water",
 * "floated on top", "or 1 sugar cube"...) are short, highly-repeated
 * phrases rather than cocktail-specific prose, so — unlike
 * description/steps/garnish, which are overlaid per-cocktail in
 * locales/tr/catalog.ts — these are translated by exact English-string
 * match. Every note string that currently exists anywhere in
 * src/data/catalog/cocktails/*.ts must have an entry here, or it renders
 * in English regardless of locale (this list was built by extracting
 * every distinct note string from the catalog; a data-integrity test
 * enforces that it stays complete as new cocktails are added — see
 * dataIntegrity.test.ts).
 *
 * Personal recipes are never looked up here — a user's own ingredient
 * notes are their own words, shown as entered, same rule as their
 * description/steps (see cocktailContent.ts's doc comment).
 */
const noteTranslationsTr: Record<string, string> = {
  'a couple of dashes on top to garnish': 'üzerine süslemek için birkaç damla',
  'a few drops on top to garnish': 'üzerine süslemek için birkaç damla',
  'a splash, for color': 'renk için bir tutam',
  'a squeeze of lime': 'bir sıkım misket limonu',
  'a squeeze, optional': 'bir sıkım, isteğe bağlı',
  'about a barspoon': 'yaklaşık bir bar kaşığı',
  'adjust to taste': 'damak tadına göre ayarlayın',
  'blended Scotch': 'blend İskoç viskisi',
  'drizzled on top': 'üzerine gezdirilir',
  'floated on top': 'üzerinde yüzdürülür',
  'for rimming the glass': 'kadehin kenarını kaplamak için',
  'hot water, to top': 'sıcak su, tamamlamak için',
  'lightly whipped, floated on top': 'hafifçe çırpılmış, üzerinde yüzdürülür',
  'one sugar cube': 'bir küp şeker',
  'optional, a couple of dashes on top to garnish': 'isteğe bağlı, üzerine süslemek için birkaç damla',
  'optional, for a frothy texture': 'isteğe bağlı, köpüklü doku için',
  'optional, for a silkier texture': 'isteğe bağlı, daha ipeksi bir doku için',
  'optional, for texture': 'isteğe bağlı, doku için',
  'optional; adds a pale violet hue': 'isteğe bağlı; açık menekşe bir ton katar',
  'or 1 sugar cube': 'ya da 1 küp şeker',
  'peated Scotch, floated on top': 'İslak (peated) İskoç viskisi, üzerinde yüzdürülür',
  'rinse the glass': 'kadehi çalkalayın',
  'rinse the glass, discard the excess': 'kadehi çalkalayın, fazlasını dökün',
  sliced: 'dilimlenmiş',
  'top with a splash of soda water': 'üzerine bir tutam soda suyu ile tamamlayın',
  'top with champagne': 'üzerine şampanya ile tamamlayın',
  'top with chilled champagne': 'üzerine soğuk şampanya ile tamamlayın',
  'top with cola': 'üzerine kola ile tamamlayın',
  'top with cold beer': 'üzerine soğuk bira ile tamamlayın',
  'top with ginger beer': 'üzerine zencefilli bira ile tamamlayın',
  'top with grapefruit soda': 'üzerine greyfurtlu soda ile tamamlayın',
  'top with soda water': 'üzerine soda suyu ile tamamlayın',
  'traditionally muddled fresh lime wedges': 'geleneksel olarak ezilmiş taze misket limonu dilimleri',
};

/** Falls back to the original English note if no translation exists, rather than rendering blank — matching the fallback policy used throughout locales/tr/catalog.ts. */
export function translateIngredientNote(note: string, locale: Locale): string {
  if (locale === 'en') return note;
  return noteTranslationsTr[note] ?? note;
}

/** Exported for dataIntegrity.test.ts to check every catalog note has a translation entry. */
export function getKnownNoteTranslationKeys(): string[] {
  return Object.keys(noteTranslationsTr);
}
