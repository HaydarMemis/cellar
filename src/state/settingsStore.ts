import { create } from 'zustand';
import { JsonStore } from '../data/storage/jsonStore';
import { UnitPreference } from '../domain/formatAmount';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  units: UnitPreference;
  themePreference: ThemePreference;
}

const defaultSettings: Settings = { units: 'ml', themePreference: 'system' };

function isSettings(value: unknown): value is Settings {
  const v = value as Partial<Settings> | null;
  return !!v && (v.units === 'ml' || v.units === 'oz') && typeof v.themePreference === 'string';
}

const store = new JsonStore<Settings>('@bar/settings', isSettings, defaultSettings);

interface SettingsState extends Settings {
  isLoaded: boolean;
  load: () => Promise<void>;
  setUnits: (units: UnitPreference) => Promise<void>;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,
  isLoaded: false,

  load: async () => {
    const settings = await store.read();
    set({ ...settings, isLoaded: true });
  },

  setUnits: async (units) => {
    const next = { units, themePreference: get().themePreference };
    set(next);
    await store.write(next);
  },

  setThemePreference: async (themePreference) => {
    const next = { units: get().units, themePreference };
    set(next);
    await store.write(next);
  },
}));
