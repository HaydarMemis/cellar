import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../state/settingsStore';
import { dark, light, Palette } from './colors';
import { radii, spacing } from './spacing';
import { typography } from './typography';

export interface Theme {
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  scheme: 'light' | 'dark';
}

export function useTheme(): Theme {
  const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const themePreference = useSettingsStore((s) => s.themePreference);
  const scheme = themePreference === 'system' ? systemScheme : themePreference;

  return {
    colors: scheme === 'dark' ? dark : light,
    spacing,
    radii,
    typography,
    scheme,
  };
}
