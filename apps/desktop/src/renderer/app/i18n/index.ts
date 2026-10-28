import en from "@/app/i18n/en.json";
import vi from "@/app/i18n/vi.json";
import zh from "@/app/i18n/zh.json";
import ja from "@/app/i18n/ja.json";
import ko from "@/app/i18n/ko.json";
import es from "@/app/i18n/es.json";
import fr from "@/app/i18n/fr.json";
import de from "@/app/i18n/de.json";
import ru from "@/app/i18n/ru.json";
import { useSettingsStore } from "@/stores/settings-store.js";

export const dictionaries: Record<string, typeof en> = {
  en,
  vi,
  zh,
  ja,
  ko,
  es,
  fr,
  de,
  ru,
};

export function getDictionary(locale?: string): typeof en {
  if (!locale) return dictionaries.en;
  return dictionaries[locale] || dictionaries.en;
}

export function useI18n() {
  const locale = useSettingsStore((s) => s.settings.locale) || "en";
  const dict = getDictionary(locale);

  function t(path: string, fallback?: string): string {
    const keys = path.split(".");
    let current: any = dict;
    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return fallback || path;
      }
    }
    return typeof current === "string" ? current : fallback || path;
  }

  return { t, locale };
}
