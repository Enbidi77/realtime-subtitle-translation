import { describe, it, expect } from 'vitest';
import { NAV_PAGE_META } from '../Breadcrumbs.js';
import { AppPageSchema, AppPage } from '@echo-lingo/contracts';
import enDict from '@/app/i18n/en.json';

describe('Breadcrumbs & PageMeta Mappings', () => {
  const allAppPages = AppPageSchema.options as AppPage[];

  it('provides a page meta definition for every AppPage in the contracts schema', () => {
    for (const page of allAppPages) {
      expect(NAV_PAGE_META[page], `Missing page meta for AppPage: ${page}`).toBeDefined();
      expect(NAV_PAGE_META[page].id).toBe(page);
      expect(NAV_PAGE_META[page].labelKey).toBeTypeOf('string');
      expect(NAV_PAGE_META[page].defaultLabel).toBeTypeOf('string');
      expect(NAV_PAGE_META[page].icon).toBeDefined();
    }
  });

  it('ensures all labelKey references resolve to valid keys in en.json', () => {
    for (const page of allAppPages) {
      const { labelKey } = NAV_PAGE_META[page];
      const parts = labelKey.split('.');
      let current: any = enDict;
      for (const part of parts) {
        current = current?.[part];
      }
      expect(current, `labelKey ${labelKey} for page ${page} not found in en.json`).toBeDefined();
      expect(typeof current).toBe('string');
    }
  });

  it('includes workspace layout key in en.json', () => {
    expect(enDict.layout.workspace).toBeDefined();
    expect(typeof enDict.layout.workspace).toBe('string');
  });
});

