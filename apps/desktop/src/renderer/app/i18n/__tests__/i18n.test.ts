import { describe, it, expect } from "vitest";
import { dictionaries, getDictionary } from "../index.js";

function getFlattenedKeys(obj: Record<string, any>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return getFlattenedKeys(v, fullKey);
    }
    return [fullKey];
  });
}

function findEmptyValues(obj: Record<string, any>, prefix = ""): string[] {
  const emptyKeys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      emptyKeys.push(...findEmptyValues(v, fullKey));
    } else if (typeof v === "string" && v.trim().length === 0) {
      emptyKeys.push(fullKey);
    }
  }
  return emptyKeys;
}

describe("i18n Localization Dictionaries", () => {
  const supportedLocales = [
    "en",
    "vi",
    "zh",
    "ja",
    "ko",
    "es",
    "fr",
    "de",
    "ru",
  ] as const;

  it("exports all 9 supported dictionaries", () => {
    for (const loc of supportedLocales) {
      expect(dictionaries[loc]).toBeDefined();
      expect(typeof dictionaries[loc]).toBe("object");
    }
  });

  it("ensures all dictionaries have 100% symmetrical keys matching en.json", () => {
    const baseKeys = getFlattenedKeys(dictionaries.en);
    expect(baseKeys.length).toBeGreaterThan(500);

    for (const loc of supportedLocales) {
      const locKeys = getFlattenedKeys(dictionaries[loc]);
      const missingKeys = baseKeys.filter((k) => !locKeys.includes(k));
      const extraKeys = locKeys.filter((k) => !baseKeys.includes(k));

      expect(missingKeys, `Missing keys in ${loc}.json`).toEqual([]);
      expect(extraKeys, `Unexpected extra keys in ${loc}.json`).toEqual([]);
      expect(locKeys.length).toBe(baseKeys.length);
    }
  });

  it("ensures no dictionary entries have blank or empty string values", () => {
    for (const loc of supportedLocales) {
      const emptyKeys = findEmptyValues(dictionaries[loc]);
      expect(emptyKeys, `Found empty strings in ${loc}.json`).toEqual([]);
    }
  });

  it("getDictionary returns expected dictionary or falls back to en", () => {
    expect(getDictionary("vi").nav.dashboard).toBe("Trang chủ");
    expect(getDictionary("zh").nav.dashboard).toBe("主页");
    expect(getDictionary("ja").nav.dashboard).toBe("ホーム");
    expect(getDictionary("ko").nav.dashboard).toBe("홈");
    expect(getDictionary("es").nav.dashboard).toBe("Inicio");
    expect(getDictionary("fr").nav.dashboard).toBe("Accueil");
    expect(getDictionary("de").nav.dashboard).toBe("Startseite");
    expect(getDictionary("ru").nav.dashboard).toBe("Главная");
    expect(getDictionary("en").nav.dashboard).toBe("Home");
    // Fallback on unknown
    expect(getDictionary("unknown-locale" as any).nav.dashboard).toBe("Home");
    expect(getDictionary(undefined).nav.dashboard).toBe("Home");
  });
});

