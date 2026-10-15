# EchoLingo Engineering & Agent Guidelines

## 1. Project Mission & Overview

**EchoLingo** is an offline-first, high-performance desktop application for real-time speech recognition, live subtitling, multi-engine translation, and on-screen OCR translation.

### Core Philosophy
- **Privacy-First & Zero Data Harvesting**: Speech recognition, OCR, and local translation run 100% locally and offline by default. No telemetry, no background analytics, and no silent cloud uploads.
- **Microsecond Precision & Low Latency**: 60fps glassmorphism UI thread is strictly decoupled from audio resampling, VAD calculations, OCR preprocessing, and AI inference.
- **Contract-Driven Design**: Every data structure, IPC call, and event payload is validated using Zod schemas defined in `@echo-lingo/contracts`.

### Technology Stack
- **Framework**: Electron (v32+), Electron-Vite (v2.3+), Node.js (v22+)
- **UI & Styling**: React 19, Tailwind CSS (v3.4), Lucide React, Glassmorphism design system
- **State Management**: Zustand (v5)
- **Monorepo Architecture**: pnpm workspaces
- **Testing**: Vitest (v3)
- **Storage**: SQLite with Write-Ahead Logging (WAL) and versioned migrations
- **Security**: Electron `safeStorage` (Windows DPAPI, macOS Keychain, Linux Secret Service)

---

## 2. Architectural Guardrails & Process Boundaries

### Strict Process Separation
1. **React Renderer (`apps/desktop/src/renderer`)**:
   - MUST NEVER import Electron APIs (`ipcRenderer`, `shell`, `remote`, etc.) or Node.js built-ins (`fs`, `path`, `child_process`, `crypto`).
   - All communication with the main process MUST pass exclusively through `window.electronAPI`, typed and exposed via `contextBridge`.
   - Never perform synchronous CPU-heavy work (resampling, VAD, binarization, Levenshtein loops) on the UI thread.
2. **Preload ContextBridge (`apps/desktop/src/preload`)**:
   - `contextIsolation: true` and `nodeIntegration: false` are strictly enforced on all browser windows.
   - Never expose raw `ipcRenderer.send`, `ipcRenderer.on`, or loose event emitters to the window.
   - Provide narrow, strongly-typed async methods and explicit unsubscribe functions for event listeners.
3. **Electron Main Process (`apps/desktop/src/main`)**:
   - Responsible for window lifecycles (`MainWindow`, `OverlayWindow`, `SelectionWindow`, `OcrPanelWindow`).
   - Owns system tray, global shortcut registration, hardware screen capture via `desktopCapturer`, OS credential encryption via `safeStorage`, and SQLite database storage.

### Contract-Driven Development
- All IPC channels, service boundaries, and event payloads MUST have corresponding TypeScript types and Zod schemas in `packages/contracts`.
- Never register untyped IPC channels or emit arbitrary loose objects across process boundaries.
- Inbound parameters must be validated with `.parse()` or `.safeParse()` in IPC routers.

### Security First
- **Encrypted Credentials**: Never store plaintext API keys in SQLite tables, configuration files, or console logs. All credentials must be encrypted using `safeStorage`.
- **Safe Subtitle Rendering**: Subtitle and OCR texts must ALWAYS be rendered as text strings in React DOM, NEVER using `dangerouslySetInnerHTML`.
- **Navigation Guardrails**: Arbitrary window navigation is blocked. External links must be opened via `shell.openExternal`.

---

## 3. Monorepo Directory Structure

```
echo-lingo/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main/                 # Electron main process (Services, IPC router, Windows)
│       │   │   ├── ipc/              # Typed IPC routers and handlers
│       │   │   ├── screen-capture/   # DesktopCapturer and display geometry manager
│       │   │   ├── services/         # SessionService, ScreenTranslationService, ShortcutsService
│       │   │   └── windows/          # MainWindow, OverlayWindow, SelectionWindow, OcrPanelWindow
│       │   ├── preload/              # Secure contextBridge exposed to renderer
│       │   └── renderer/             # React 19 application
│       │       ├── app/              # App root, providers, i18n dictionaries (en.json, vi.json)
│       │       ├── components/       # Glass UI kit (GlassButton, GlassCard, GlassModal, etc.)
│       │       ├── features/         # Feature views (dashboard, live, ocr, sessions, history, providers, settings)
│       │       ├── hooks/            # useAudioCapture, Web Audio processor
│       │       ├── stores/           # Zustand stores (session, settings, navigation)
│       │       ├── index.html        # Main app entry
│       │       ├── overlay.html      # Floating subtitle overlay entry
│       │       ├── selection.html    # Interactive screen selection overlay entry
│       │       └── ocr-panel.html    # Compact floating OCR result panel entry
│       ├── electron.vite.config.ts   # Electron-Vite multi-target build configuration
│       └── package.json
├── packages/
│   ├── contracts/                    # Pure TypeScript types & Zod schemas (Zero platform dependencies)
│   ├── config/                       # Language lists, audio params, OCR profiles, default settings
│   ├── shared/                       # Shared cross-cutting utilities (network downloaders, helpers)
│   ├── logger/                       # Winston structured file and console logger
│   ├── ocr-core/                     # Coordinate mapping, image preprocessing, deduplicator, continuous scheduler
│   ├── subtitle-core/                # SRT/VTT formatters, parsers, and SubtitleTimeline
│   ├── translation-core/             # Translation registry, LRU memory cache, GlossaryEngine
│   ├── speech-core/                  # 16kHz linear resampling, RMS meter, VAD, BoundedAudioQueue
│   ├── provider-adapters/            # Adapters: OCR (Windows WinRT, Tesseract.js), Speech, Translation
│   ├── database/                     # SQLite driver, versioned migrations, typed repository
│   └── test-utils/                   # Mock bridges, audio generators, test fixtures
├── docs/                             # Architecture and operational documentation
├── scripts/                          # Maintenance and clean-up utility scripts
└── AGENTS.md                         # Engineering and agent guidelines
```

---

## 4. Key Pipelines & Architecture

### A. Real-Time Speech & Subtitle Pipeline
```
[Microphone or System Audio]
         │
         ▼
[Web Audio API @ 44.1/48kHz]
         │
         ▼
[16kHz Mono Float32 Resampling + RMS Energy Meter]
         │
         ▼  (IPC: speech:process-chunk)
[Voice Activity Detector (VAD)]
  ├── Thresholding (default RMS 0.02)
  ├── Min speech window: 400ms
  └── Silence finalization: 800ms
         │
         ▼
[Speech Recognition Provider (Windows SAPI / Local Whisper / Groq / OpenAI)]
         │
         ▼  (Interim Partial & Final Events)
[Multi-Target Translation Engine]
  ├── LRU Cache Check (instant hit)
  ├── Glossary Terminology Substitution
  └── Cloud/Local Translation Provider
         │
         ▼
[SubtitleTimeline Deduplication & SQLite Persistence]
         │
    ┌────┴────┐
    ▼         ▼
[MainWindow] [OverlayWindow]
```

### B. On-Screen OCR & Translation Pipeline
```
[Shortcut: Ctrl+Shift+T / User Click]
         │
         ▼
[ScreenCaptureManager: desktopCapturer captures target display BEFORE overlay]
         │
         ▼
[SelectionWindow: Frameless transparent interactive cutout (selection.html)]
  ├── High-DPI physical-to-logical coordinate translation
  └── Multi-monitor negative space clamping
         │
         ▼
[Crop Buffer to Physical Bounding Box]
         │
         ▼
[ImageProcessor: Grayscale -> Contrast Stretch -> Otsu Binarization / Scaling]
         │
         ▼
[OCR Engine: Windows WinRT Media.Ocr / Tesseract.js WebAssembly]
         │
         ▼
[OCR Normalizer & TextDeduplicator (Levenshtein similarity change detection)]
         │
         ▼
[Translation Engine (Google Web / DeepL / LibreTranslate / Ollama)]
         │
    ┌────┴──────────────────────────┐
    ▼                               ▼
[Main App OCR View]        [Floating OCR Panel (ocr-panel.html)]
```

### C. Continuous Screen Monitoring
- Continuous capture loop operates at configurable intervals (500ms – 5000ms).
- Uses `ContinuousOcrScheduler` with **backpressure protection**: never queues overlapping executions if inference takes longer than the interval.
- `TextDeduplicator` computes normalized Levenshtein similarity to ignore static or unchanged frames, protecting CPU resources and translation quotas.

---

## 5. Database & Persistence Standards

- **Engine**: SQLite running via `NodeSqliteDriver` / `sql.js` compatibility layer.
- **WAL Mode**: `PRAGMA journal_mode = WAL;` is mandatory to ensure non-blocking concurrent reads while audio segments are continuously recorded.
- **Foreign Keys**: `PRAGMA foreign_keys = ON;` is enforced for automatic cascading deletions.
- **Schema Migrations**:
  - Migration 1: `initial_schema` (`sessions`, `subtitle_segments`, `glossary`, `app_settings`).
  - Migration 2: `ocr_history_schema` (`ocr_history` table and indexes).
  - Always add new migrations in `packages/database/src/schema.ts` with incrementing version numbers.

---

## 6. Internationalization (i18n) Rules

- **Dictionary Files**:
  - English: `apps/desktop/src/renderer/app/i18n/en.json`
  - Vietnamese: `apps/desktop/src/renderer/app/i18n/vi.json`
- **Hook**: Use `useI18n()` from `@/app/i18n/index.js` in renderer components:
  ```tsx
  const { t, locale } = useI18n();
  return <h1>{t('dashboard.welcome', 'Welcome to EchoLingo')}</h1>;
  ```
- **Symmetry Rule**: When introducing or editing translation keys, ALWAYS update both `en.json` and `vi.json` symmetrically. Never leave untranslated raw strings in UI components.

---

## 7. Development & Verification Workflows

### Essential Commands

```bash
# Install dependencies across all workspaces
pnpm install

# Run application in live development mode (Electron + React HMR)
pnpm dev

# Run all unit and integration tests (Vitest)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Typecheck all packages and applications
pnpm typecheck

# Build all packages and desktop application bundle
pnpm build

# Package desktop application installer for current platform
pnpm package
```

### Pre-Commit / Pre-Completion Verification Checklist
Before marking any feature or bug fix complete:
1. **Tests Pass**: Run `pnpm test` and verify all test suites pass with zero regressions.
2. **Build Succeeds**: Run `pnpm build` and verify TypeScript compilation and Vite bundling succeed without errors or unresolved modules.
3. **No Process Boundary Leaks**: Verify renderer files never import Node.js built-ins or Electron APIs directly.
4. **i18n Consistency**: Ensure new user-facing strings are added to both `en.json` and `vi.json`.
5. **Lint & Clean State**: No unhandled promise rejections, memory leaks (unregister event handlers / intervals on unmount), or dangling scratch files.

---

## 8. Specific Agent Coding Rules

1. **Package Dependency Hierarchy**:
   - `contracts` (no dependencies)
   - `shared` (zero dependencies, cross-cutting utilities and network helpers)
   - `config` (depends on `contracts`)
   - `logger` (structured Winston logger)
   - Core packages (`speech-core`, `subtitle-core`, `translation-core`, `ocr-core`) depend on `contracts`, `config`, and `shared`.
   - `provider-adapters` depends on core packages, `contracts`, `config`, and `shared`.
   - `database` depends on `contracts` and `config`.
   - `apps/desktop` depends on all packages.
   - NEVER introduce circular dependencies between packages.
2. **Coordinate Mathematics**:
   - Always account for multi-monitor displays where $X$ or $Y$ offsets can be negative.
   - Always convert between CSS logical points and physical pixels using Device Pixel Ratio (`DPR = scaleFactor`).
3. **Audio Buffers**:
   - Audio chunks exchanged across IPC are 16,000 Hz, single-channel (mono), 32-bit float PCM buffers.
4. **Documentation Integrity**:
   - Preserve all existing code comments, docstrings, and architectural invariants unless explicitly asked to modify them.
