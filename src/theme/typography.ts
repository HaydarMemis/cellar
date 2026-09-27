import { Platform } from 'react-native';

// System fonts only — no bundled font assets. On iOS this renders in San
// Francisco (with the Display optical size at the larger weights, which
// already reads as editorial rather than "UI chrome"); on Android in Roboto.
const serifDisplay = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
const sans = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });

export const typography = {
  display: { fontFamily: serifDisplay, fontSize: 34, lineHeight: 40, fontWeight: '600' as const },
  title: { fontFamily: serifDisplay, fontSize: 24, lineHeight: 30, fontWeight: '600' as const },
  headline: { fontFamily: sans, fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontFamily: sans, fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontFamily: sans, fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  caption: { fontFamily: sans, fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  captionStrong: { fontFamily: sans, fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  label: { fontFamily: sans, fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
} as const;

export type TypographyVariant = keyof typeof typography;
