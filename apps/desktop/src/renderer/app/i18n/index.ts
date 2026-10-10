import en from './en.json';
import vi from './vi.json';
import { useSettingsStore } from '../../stores/settings-store.js';

const dictionaries = { en, vi };

export function useI18n() {
  const locale = useSettingsStore((s) => s.settings.locale) || 'en';
  const dict = dictionaries[locale] || dictionaries.en;

  function t(path: string, fallback?: string): string {
    const keys = path.split('.');
    let current: any = dict;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return fallback || path;
      }
    }
    return typeof current === 'string' ? current : fallback || path;
  }

  return { t, locale };
}
