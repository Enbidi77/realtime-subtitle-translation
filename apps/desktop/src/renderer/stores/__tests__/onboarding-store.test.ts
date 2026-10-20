import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOnboardingStore } from '../onboarding-store.js';
import { useSettingsStore } from '../settings-store.js';
import { getCommandRegistry } from '../../features/global-search/command-registry.js';
import { SearchResultItem } from '../../features/global-search/types.js';

describe('OnboardingStore & Tour Integration', () => {
  beforeEach(() => {
    useOnboardingStore.setState({
      isOpen: false,
      currentStep: 0,
      totalSteps: 6,
    });
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        hasCompletedOnboarding: false,
      },
    });
  });

  it('initializes with default state', () => {
    const state = useOnboardingStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.currentStep).toBe(0);
    expect(state.totalSteps).toBe(6);
  });

  it('opens and closes tour correctly', () => {
    useOnboardingStore.getState().openTour(2);
    expect(useOnboardingStore.getState().isOpen).toBe(true);
    expect(useOnboardingStore.getState().currentStep).toBe(2);

    useOnboardingStore.getState().closeTour();
    expect(useOnboardingStore.getState().isOpen).toBe(false);
  });

  it('traverses steps with bounds clamping', () => {
    const store = useOnboardingStore.getState();
    store.openTour(0);

    // Prev step clamped at 0
    store.prevStep();
    expect(useOnboardingStore.getState().currentStep).toBe(0);

    // Next step increments
    store.nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe(1);

    // Jump to step
    store.goToStep(4);
    expect(useOnboardingStore.getState().currentStep).toBe(4);

    // Jump to invalid step ignores
    store.goToStep(99);
    expect(useOnboardingStore.getState().currentStep).toBe(4);
  });

  it('completes tour on final step and persists setting', async () => {
    const store = useOnboardingStore.getState();
    store.openTour(5); // Last step

    await store.nextStep(); // Triggers completion
    expect(useOnboardingStore.getState().isOpen).toBe(false);
    expect(useSettingsStore.getState().settings.hasCompletedOnboarding).toBe(true);
  });

  it('resets tour to step 0 and clears completed flag', async () => {
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        hasCompletedOnboarding: true,
      },
    });

    await useOnboardingStore.getState().resetTour();
    expect(useOnboardingStore.getState().isOpen).toBe(true);
    expect(useOnboardingStore.getState().currentStep).toBe(0);
    expect(useSettingsStore.getState().settings.hasCompletedOnboarding).toBe(false);
  });

  it('executes tour:open from command registry', async () => {
    const registry = getCommandRegistry();
    const item: SearchResultItem = {
      id: 'help:interactive-tour',
      category: 'command',
      title: 'Interactive App Tour',
      icon: 'Sparkles',
      action: {
        type: 'command',
        payload: { commandId: 'tour:open', step: 3 },
      },
    };

    const res = await registry.execute(item);
    expect(res.success).toBe(true);
    expect(useOnboardingStore.getState().isOpen).toBe(true);
    expect(useOnboardingStore.getState().currentStep).toBe(3);
  });
});

