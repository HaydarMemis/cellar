import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../settingsStore';

function resetToFreshBoot() {
  useSettingsStore.setState({ units: 'ml', themePreference: 'system', isLoaded: false });
}

describe('useSettingsStore — units and theme persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetToFreshBoot();
  });

  it('defaults to ml and system theme before load()', () => {
    const state = useSettingsStore.getState();
    expect(state.units).toBe('ml');
    expect(state.themePreference).toBe('system');
    expect(state.isLoaded).toBe(false);
  });

  it('changing units updates state immediately', async () => {
    await useSettingsStore.getState().setUnits('oz');
    expect(useSettingsStore.getState().units).toBe('oz');
  });

  it('changing theme updates state immediately', async () => {
    await useSettingsStore.getState().setThemePreference('dark');
    expect(useSettingsStore.getState().themePreference).toBe('dark');
  });

  it('changing units does not clobber an already-chosen theme, and vice versa', async () => {
    await useSettingsStore.getState().setThemePreference('dark');
    await useSettingsStore.getState().setUnits('oz');

    const state = useSettingsStore.getState();
    expect(state.themePreference).toBe('dark');
    expect(state.units).toBe('oz');
  });

  it('persists units across a simulated app restart', async () => {
    await useSettingsStore.getState().setUnits('oz');

    resetToFreshBoot();
    await useSettingsStore.getState().load();

    expect(useSettingsStore.getState().units).toBe('oz');
  });

  it('persists theme across a simulated app restart', async () => {
    await useSettingsStore.getState().setThemePreference('dark');

    resetToFreshBoot();
    await useSettingsStore.getState().load();

    expect(useSettingsStore.getState().themePreference).toBe('dark');
  });

  it('persists both units and theme together across a restart', async () => {
    await useSettingsStore.getState().setUnits('oz');
    await useSettingsStore.getState().setThemePreference('light');

    resetToFreshBoot();
    await useSettingsStore.getState().load();

    const state = useSettingsStore.getState();
    expect(state.units).toBe('oz');
    expect(state.themePreference).toBe('light');
  });
});
