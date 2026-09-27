import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { useLocaleStore } from '../localeStore';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

const mockGetLocales = Localization.getLocales as jest.Mock;

/** Resets the store to its pre-hydration defaults, as it is at real app boot. */
function resetToFreshBoot() {
  useLocaleStore.setState({ preference: 'system', locale: 'en', isLoaded: false });
}

describe('useLocaleStore — language switching and persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockGetLocales.mockReturnValue([{ languageCode: 'en' }]);
    resetToFreshBoot();
  });

  it('starts unhydrated with English as the safe default before load() runs', () => {
    const state = useLocaleStore.getState();
    expect(state.isLoaded).toBe(false);
    expect(state.locale).toBe('en');
  });

  it('on first launch (nothing persisted yet), follows the device locale when supported', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'tr' }]);
    await useLocaleStore.getState().load();

    const state = useLocaleStore.getState();
    expect(state.preference).toBe('system');
    expect(state.locale).toBe('tr');
    expect(state.isLoaded).toBe(true);
  });

  it('on first launch, falls back to English when the device language is unsupported', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'fr' }]);
    await useLocaleStore.getState().load();

    expect(useLocaleStore.getState().locale).toBe('en');
  });

  it('on first launch, falls back to English when the device reports no locales at all', async () => {
    mockGetLocales.mockReturnValue([]);
    await useLocaleStore.getState().load();

    expect(useLocaleStore.getState().locale).toBe('en');
  });

  it('switching to Turkish updates the resolved locale immediately', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en' }]);
    await useLocaleStore.getState().load();
    expect(useLocaleStore.getState().locale).toBe('en');

    await useLocaleStore.getState().setLanguage('tr');

    expect(useLocaleStore.getState().locale).toBe('tr');
    expect(useLocaleStore.getState().preference).toBe('tr');
  });

  it('switching back to English from Turkish updates the resolved locale immediately', async () => {
    await useLocaleStore.getState().setLanguage('tr');
    expect(useLocaleStore.getState().locale).toBe('tr');

    await useLocaleStore.getState().setLanguage('en');
    expect(useLocaleStore.getState().locale).toBe('en');
  });

  it('persists an explicit language choice across a simulated app restart', async () => {
    // Device is Turkish, but the user explicitly chose English.
    mockGetLocales.mockReturnValue([{ languageCode: 'tr' }]);
    await useLocaleStore.getState().setLanguage('en');
    expect(useLocaleStore.getState().locale).toBe('en');

    // Simulate the app being killed and relaunched: fresh in-memory state,
    // storage is all that survives, load() is what boot calls.
    resetToFreshBoot();
    await useLocaleStore.getState().load();

    const state = useLocaleStore.getState();
    expect(state.preference).toBe('en');
    expect(state.locale).toBe('en'); // explicit choice wins over the Turkish device locale
  });

  it('persists an explicit Turkish choice across a simulated app restart on an English device', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en' }]);
    await useLocaleStore.getState().setLanguage('tr');

    resetToFreshBoot();
    mockGetLocales.mockReturnValue([{ languageCode: 'en' }]); // device is still English
    await useLocaleStore.getState().load();

    expect(useLocaleStore.getState().locale).toBe('tr'); // stored preference wins
  });

  it('reverting to "system" after an explicit choice re-follows the device locale on restart', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en' }]);
    await useLocaleStore.getState().setLanguage('tr');
    await useLocaleStore.getState().setLanguage('system');
    expect(useLocaleStore.getState().locale).toBe('en');

    resetToFreshBoot();
    mockGetLocales.mockReturnValue([{ languageCode: 'tr' }]); // device switched to Turkish
    await useLocaleStore.getState().load();

    expect(useLocaleStore.getState().preference).toBe('system');
    expect(useLocaleStore.getState().locale).toBe('tr');
  });

  it('a full English -> Turkish -> English round trip persists correctly at each step', async () => {
    mockGetLocales.mockReturnValue([{ languageCode: 'en' }]);
    await useLocaleStore.getState().load();
    expect(useLocaleStore.getState().locale).toBe('en');

    await useLocaleStore.getState().setLanguage('tr');
    resetToFreshBoot();
    await useLocaleStore.getState().load();
    expect(useLocaleStore.getState().locale).toBe('tr');

    await useLocaleStore.getState().setLanguage('en');
    resetToFreshBoot();
    await useLocaleStore.getState().load();
    expect(useLocaleStore.getState().locale).toBe('en');
  });
});
