import { create } from 'zustand';
import { JsonStore } from '../data/storage/jsonStore';

function isOnboardingState(value: unknown): value is { completed: boolean } {
  return !!value && typeof value === 'object' && typeof (value as { completed?: unknown }).completed === 'boolean';
}

const store = new JsonStore<{ completed: boolean }>('@app/onboarding', isOnboardingState, { completed: false });

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  isLoaded: boolean;
  load: () => Promise<void>;
  complete: () => Promise<void>;
}

/**
 * Tracks whether the one-time first-launch onboarding has been shown —
 * device-scoped, not account-scoped (unlike favorites/inventory/journal/
 * shopping list): onboarding is about *this device* having seen the
 * intro, not about who's signed in, so it's deliberately NOT part of
 * accountScope.ts. A missing or corrupt flag defaults to `completed:
 * false` (JsonStore's fallback), which means "show onboarding" — the
 * safe direction to fail in is showing an extra intro screen once, never
 * silently skipping it in a way indistinguishable from having already
 * seen it.
 */
export const useOnboardingStore = create<OnboardingState>((set) => ({
  hasCompletedOnboarding: false,
  isLoaded: false,

  load: async () => {
    const { completed } = await store.read();
    set({ hasCompletedOnboarding: completed, isLoaded: true });
  },

  complete: async () => {
    set({ hasCompletedOnboarding: true });
    await store.write({ completed: true });
  },
}));
