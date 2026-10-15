# EchoLingo Global Search Architecture & Developer Guide

## 1. Overview

EchoLingo features a production-grade **Global Search & Command Palette** designed with the responsiveness, precision, and elegance of modern desktop productivity tools (e.g. VS Code, Raycast, Linear).

### Key Highlights
- **Universal Shortcuts**: `Ctrl + K` / `Cmd + K` (Global Search) and `Ctrl + Shift + P` / `Cmd + Shift + P` (Command Palette).
- **Accessible Titlebar Search Button**: Centered directly in the frameless glass TitleBar for immediate one-click activation.
- **Contract-Driven IPC**: All IPC channels, payloads, and search items are validated via Zod schemas in `@echo-lingo/contracts`.
- **Offline & Private**: Indexes and queries local SQLite WAL database (sessions, transcripts, OCR history, glossary) without cloud dependencies or telemetry.
- **Multilingual Unicode Matching**: Diacritic-insensitive and accent-folding normalization (e.g. Vietnamese `cài đặt` matches `cai dat`).
- **Resilient Multi-Provider Engine**: Concurrent execution with timeouts, cancellation of obsolete searches via `AbortController`, fuzzy ranking, and stable deduplication.

---

## 2. Architecture Diagram

```
[User Input: Ctrl+K / Ctrl+Shift+P / Titlebar Click]
                       │
                       ▼
              [GlobalSearchModal]
                       │
                       ▼
            [useGlobalSearchStore]
                       │
                       ▼
                 [SearchEngine]
   ┌───────────────────┼───────────────────┐
   ▼                   ▼                   ▼
[NavigationProvider] [CommandsProvider]  [SettingsProvider]
   │                   │                   │
   ▼                   ▼                   ▼
[HelpProvider]     [RecentProvider]    [DatabaseProvider]
                                           │ (IPC: search:database)
                                           ▼
                                 [Electron Main Process]
                                           │
                                           ▼
                                    [SQLite WAL DB]
                               (Sessions, Segments, OCR, Glossary)
```

---

## 3. Search Providers

All searchable sources implement the `ISearchProvider` interface:

```typescript
export interface ISearchProvider {
  id: string;
  category: SearchResultCategory; // 'navigation' | 'command' | 'settings' | 'session' | 'ocr' | 'glossary' | 'help'
  name: string;
  getResults(query: string, signal?: AbortSignal): Promise<SearchResultItem[]> | SearchResultItem[];
  getInitialItems?(): Promise<SearchResultItem[]> | SearchResultItem[];
}
```

### Registered Providers
1. **`NavigationProvider`**: Application pages (`dashboard`, `live-subtitles`, `ocr-translate`, `sessions`, `history`, `providers`, `settings`).
2. **`CommandsProvider`**: Executable actions (Start/stop listening, capture screen OCR, toggle continuous OCR, toggle subtitle overlay, change theme, switch UI language, open logs, clear history).
3. **`SettingsProvider`**: Granular settings (Appearance, Theme, Glass Intensity, Font size, Opacity, VAD Sensitivity, Speech Engine, Whisper model, Translation provider, Close behavior).
4. **`DatabaseProvider`**: Queries SQLite via IPC (`search:database`) for historical sessions, subtitle segments, OCR history items, and glossary terms.
5. **`HelpProvider`**: Built-in user documentation, keyboard cheatsheets, and audio driver troubleshooting.
6. **`RecentHistoryManager`**: Manages recent search queries and executed items stored in local storage for instant suggestions on empty query.

---

## 4. Registering a New Search Provider

To add a new searchable data source:

1. Implement `ISearchProvider`:
   ```typescript
   import { ISearchProvider, SearchResultItem } from '@/features/global-search/types.js';
   import { scoreSearchResult } from '@/features/global-search/scoring.js';

   export class CustomProvider implements ISearchProvider {
     public readonly id = 'custom-provider';
     public readonly category = 'command';
     public readonly name = 'Custom Items';

     public getResults(query: string): SearchResultItem[] {
       const items: SearchResultItem[] = [/* your items */];
       return items
         .map((item) => {
           const match = scoreSearchResult(item, query);
           return match.score > 0 ? { ...item, score: match.score, titleHighlights: match.titleHighlights } : null;
         })
         .filter(Boolean) as SearchResultItem[];
     }
   }
   ```
2. Register the provider in `SearchEngine`:
   ```typescript
   import { getSearchEngine } from '@/features/global-search/search-engine.js';
   getSearchEngine().registerProvider(new CustomProvider());
   ```

---

## 5. Registering Executable Commands

Commands are registered in `CommandRegistry`:

```typescript
import { getCommandRegistry } from '@/features/global-search/command-registry.js';

getCommandRegistry().register('my-action:trigger', async (payload) => {
  // Execute action logic here
  return { success: true, message: 'Action completed' };
});
```

When a search result with action `{ type: 'command', payload: { commandId: 'my-action:trigger' } }` is activated (via `Enter` or mouse click), `CommandRegistry` executes the handler and closes the search palette.

---

## 6. Scoring, Ranking & Highlighting

Matching uses a multi-tier scoring heuristic:
1. **Exact Title Match**: 1000+ points
2. **Start-of-Title Prefix Match**: 800+ points
3. **Word Boundary Match**: 700+ points
4. **Acronym Match** (e.g. `ocr` → Optical Character Recognition): 650+ points
5. **Substring Match in Title**: 600+ points
6. **Multi-Word Token Coverage**: +350 points when all query tokens match
7. **Description / Subtitle Match**: 300+ points
8. **Typo Tolerance (Levenshtein Distance)**: 280 points for single-letter edits
9. **Recent Item Boost**: +50 points (controlled, never overwhelming a strong direct query match)

Highlighting computes exact matching character intervals `[start, end]` in original display text, rendered via safe React DOM `<mark>` nodes without `dangerouslySetInnerHTML`.

---

## 7. Testing

Run all Global Search unit tests:

```bash
pnpm vitest run apps/desktop/src/renderer/features/global-search
pnpm vitest run packages/contracts/src/__tests__/search.test.ts
pnpm vitest run packages/database/src/__tests__/database.test.ts
```

