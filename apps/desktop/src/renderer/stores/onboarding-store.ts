import { create } from 'zustand';
import { createLogger } from '@echo-lingo/logger';
import { useSettingsStore } from './settings-store.js';

const log = createLogger('OnboardingStore');

export interface OnboardingStore {
  isOpen: boolean;
  currentStep: number;
  totalSteps: number;
  openTour: (step?: number) => void;
  closeTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  completeTour: () => Promise<void>;
  resetTour: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  isOpen: false,
  currentStep: 0,
  totalSteps: 6,

  openTour: (step = 0) => set({ isOpen: true, currentStep: Math.max(0, Math.min(step, get().totalSteps - 1)) }),
  closeTour: () => set({ isOpen: false }),

  nextStep: () => {
    const { currentStep, totalSteps, completeTour } = get();
    if (currentStep < totalSteps - 1) {
      set({ currentStep: currentStep + 1 });
    } else {
      completeTour();
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      set({ currentStep: currentStep - 1 });
    }
  },

  goToStep: (step: number) => {
    const { totalSteps } = get();
    if (step >= 0 && step < totalSteps) {
      set({ currentStep: step });
    }
  },

  completeTour: async () => {
    set({ isOpen: false });
    try {
      await useSettingsStore.getState().updateSettings({ hasCompletedOnboarding: true });
    } catch (err) {
      log.error('Failed to persist onboarding completion', err);
    }
  },

  resetTour: async () => {
    try {
      await useSettingsStore.getState().updateSettings({ hasCompletedOnboarding: false });
    } catch (err) {
      log.error('Failed to reset onboarding setting', err);
    }
    set({ isOpen: true, currentStep: 0 });
  },
}));

