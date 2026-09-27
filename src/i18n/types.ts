export type Locale = 'en' | 'tr';

export const supportedLocales: Locale[] = ['en', 'tr'];

export function isSupportedLocale(value: string): value is Locale {
  return (supportedLocales as string[]).includes(value);
}

/** A leaf value that varies by count (English "1 item" / "2 items"; Turkish repeats the same form). */
export interface PluralString {
  one: string;
  other: string;
}

export type LeafValue = string | PluralString;

/** Mirrors a dictionary's shape but widens every leaf to a plain (non-literal) translated string — used to type-check locale files against the `en` source of truth without forcing them to match its exact literal text. */
export type DeepDict<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends PluralString
      ? PluralString
      : DeepDict<T[K]>;
};

type Join<P extends string, K extends string> = P extends '' ? K : `${P}.${K}`;

/** All valid dot-path translation keys for a dictionary shape, e.g. "home.greeting.morning". */
export type PathsOf<T, P extends string = ''> = T extends LeafValue
  ? P
  : {
      [K in keyof T & string]: PathsOf<T[K], Join<P, K>>;
    }[keyof T & string];
