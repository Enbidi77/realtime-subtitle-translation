# EchoLingo Engineering & Agent Guidelines

## 1. Architectural Guardrails

- **Strict Process Separation**:
  - The React renderer (`apps/desktop/src/renderer`) must NEVER import Electron APIs or Node.js built-ins (`fs`, `path`, `child_process`).
  - All communication between renderer and main process must traverse the typed `window.electronAPI` contextBridge.
- **Contract Driven Development**:
  - All IPC requests, responses, and events must be modeled as Zod schemas in `packages/contracts`.
  - Never register untyped IPC channels or emit arbitrary loose objects.
- **Security First**:
  - Never store plain text API keys in ordinary database settings or logs.
  - Subtitle text must always be rendered as text strings in React DOM, never via `dangerouslySetInnerHTML`.
- **Zero Heavy Inference on UI Thread**:
  - Audio resampling, VAD calculations, and speech recognition pipeline logic are executed in the audio worker / main process pipeline without blocking the 60fps renderer thread.

## 2. Directory Structure

```
echo-lingo/
├── apps/
│   └── desktop/            # Electron main, preload, and React renderer (includes Selection & OCR panel windows)
├── packages/
│   ├── contracts/          # Pure TypeScript types & Zod schemas (Audio, Subtitles, OCR, Settings, IPC)
│   ├── config/             # Constants, language lists, default settings, and OCR presets
│   ├── ocr-core/           # Coordinate mapping, image preprocessing, deduplication, normalizer, scheduler
│   ├── subtitle-core/      # SRT/VTT formatters, parsers, and timeline
│   ├── translation-core/   # Translation registry, LRU cache, glossary
│   ├── speech-core/        # 16kHz resampling, VAD, audio queues
│   ├── provider-adapters/  # OCR (Windows, Tesseract), Speech, and Translation adapters
│   ├── database/           # SQLite driver, schema migrations, repositories
│   └── test-utils/         # Test fixtures, mock bridges, audio generators
├── docs/                   # Architectural & operational documentation
└── AGENTS.md               # Repository workflows and agent rules
```

## 3. Testing Workflows

```bash
# Run all unit and integration test suites
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build all packages and application
pnpm build
```
