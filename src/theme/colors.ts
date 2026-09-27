export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  favorite: string;
  success: string;
  danger: string;
}

export const light: Palette = {
  background: '#FAF8F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F1ECE4',
  textPrimary: '#1C1A17',
  textSecondary: '#6E675E',
  // Darkened from the original #A69E93 (2.5:1) to meet WCAG AA (4.5:1) for
  // real content — section labels, field labels, etc. all use this tier.
  // Kept a shade lighter than textSecondary rather than merged with it, so
  // the hierarchy still reads, just no longer at the expense of legibility.
  textTertiary: '#6C6863',
  border: '#E7E0D5',
  // Darkened from #B25E2E (4.4:1, just under AA) to comfortably clear 4.5:1
  // as text color, while reading as the same copper/amber brand hue.
  accent: '#9D5328',
  accentSoft: '#F1DCC5',
  onAccent: '#FFFFFF',
  favorite: '#B23A32',
  success: '#3D7A55',
  danger: '#B23A32',
};

export const dark: Palette = {
  background: '#121110',
  surface: '#1B1917',
  surfaceAlt: '#242220',
  textPrimary: '#F5F1EA',
  textSecondary: '#A69E93',
  // See light.textTertiary — lightened from #726A5F (3.5:1) to pass AA.
  textTertiary: '#948E87',
  border: '#332F2A',
  accent: '#E08A4D',
  accentSoft: '#3A2A1B',
  onAccent: '#1C1A17',
  favorite: '#E0685C',
  success: '#5FA97C',
  danger: '#E0685C',
};
