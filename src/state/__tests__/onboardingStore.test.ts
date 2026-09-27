import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOnboardingStore } from '../onboardingStore';

/** Resets the store to its pre-hydration defaults, as it is at real app boot. */
function resetToFreshBoot() {
  useOnboardingStore.setState({ hasCompletedOnboarding: false, isLoaded: false });
}

describe('useOnboardingStore — first-launch flag persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetToFreshBoot();
  });

  it('starts unloaded with onboarding NOT completed — the safe default (show it rather than skip it)', () => {
    const state = useOnboardingStore.getState();
    expect(state.isLoaded).toBe(false);
    expect(state.hasCompletedOnboarding).toBe(false);
  });

  it('on a genuine first launch (nothing persisted), load() reports onboarding as not completed', async () => {
    await useOnboardingStore.getState().load();

    const state = useOnboardingStore.getState();
    expect(state.hasCompletedOnboarding).toBe(false);
    expect(state.isLoaded).toBe(true);
  });

  it('complete() flips state immediately and persists it', async () => {
    await useOnboardingStore.getState().load();
    await useOnboardingStore.getState().complete();

    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
  });

  it('a completed flag survives a simulated app restart — onboarding does not repeat', async () => {
    await useOnboardingStore.getState().complete();

    // Simulate the app being killed and relaunched: fresh in-memory state,
    // storage is all that survives, load() is what boot calls.
    resetToFreshBoot();
    await useOnboardingStore.getState().load();

    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
  });

  it('a corrupted/malformed persisted value falls back safely to "show onboarding"', async () => {
    // Simulates an unrelated or damaged value under the onboarding key —
    // must never crash boot and must never assume "already seen it".
    await AsyncStorage.setItem('@app/onboarding', JSON.stringify({ unexpected: 'shape' }));

    resetToFreshBoot();
    await useOnboardingStore.getState().load();

    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
    expect(useOnboardingStore.getState().isLoaded).toBe(true);
  });

  it('a missing (never-written) persisted value defaults to "show onboarding"', async () => {
    // No AsyncStorage.setItem call at all — true fresh install.
    await useOnboardingStore.getState().load();

    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
  });
});
