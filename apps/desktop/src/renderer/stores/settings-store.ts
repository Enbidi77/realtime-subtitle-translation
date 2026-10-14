import { create } from 'zustand';
import { AppSettings } from '@echo-lingo/contracts';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';

interface SettingsStore {
  settings: AppSettings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_APP_SETTINGS,
  isLoading: true,

  loadSettings: async () => {
    try {
      if (window.electronAPI?.settings) {
        const loaded = await window.electronAPI.settings.get();
        set({ settings: loaded, isLoading: false });
        applyTheme(loaded.theme, loaded.glassIntensity);
      } else {
        set({ isLoading: false });
        applyTheme(DEFAULT_APP_SETTINGS.theme, DEFAULT_APP_SETTINGS.glassIntensity);
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
      set({ isLoading: false });
    }
  },

  updateSettings: async (updates) => {
    const next = { ...get().settings, ...updates };
    set({ settings: next });
    if (updates.theme || updates.glassIntensity) {
      applyTheme(next.theme, next.glassIntensity);
    }
    if (window.electronAPI?.settings) {
      try {
        const saved = await window.electronAPI.settings.update(updates);
        set({ settings: saved });
      } catch (err) {
        console.error('Failed to persist settings:', err);
      }
    }
  },

  resetSettings: async () => {
    if (window.electronAPI?.settings) {
      const reset = await window.electronAPI.settings.reset();
      set({ settings: reset });
      applyTheme(reset.theme, reset.glassIntensity);
    } else {
      set({ settings: DEFAULT_APP_SETTINGS });
      applyTheme(DEFAULT_APP_SETTINGS.theme, DEFAULT_APP_SETTINGS.glassIntensity);
    }
  },
}));

export function applyTheme(
  theme: 'system' | 'light' | 'dark',
  glassIntensity: 'subtle' | 'balanced' | 'strong' = 'balanced'
) {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }

  if (glassIntensity) {
    root.setAttribute('data-glass-intensity', glassIntensity);
  }
}
