# EchoLingo Architecture Documentation

## 1. High-Level Architecture

EchoLingo is architected as an offline-first, high-concurrency desktop application separating desktop lifecycle infrastructure, core processing engines, provider abstractions, and user interface.

```
┌─────────────────────────────────────────────────────────────┐
│                 React 19 Renderer Process                   │
│   (Dashboard, Live Workspace, Sessions, Overlay, Settings)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ ContextBridge (Zod-validated)
┌──────────────────────────────▼──────────────────────────────┐
│                    Electron Preload Layer                   │
│            Typed window.electronAPI (Zero IPC leak)         │
└──────────────────────────────┬──────────────────────────────┘
                               │ Strongly-typed IPC
┌──────────────────────────────▼──────────────────────────────┐
│                   Electron Main Process                     │
│  ├── Window Managers (MainWindow, Floating OverlayWindow)   │
│  ├── SessionService (Speech -> Translate -> Timeline -> DB) │
│  ├── TranslationService (Registry, LRU Cache, Glossary)     │
│  ├── SpeechService (Local Whisper, OpenAI, Groq, Mock)      │
│  ├── SQLite Database Layer (node:sqlite, Migrations, WAL)   │
│  └── CredentialsService (OS SafeStorage / Keychain)         │
└─────────────────────────────────────────────────────────────┘
```

## 2. Package Boundaries & Responsibilities

- **`packages/contracts`**: Pure TypeScript definitions and Zod validation schemas. Defines data contracts for audio, speech segments, translation requests, sessions, and IPC communication. Contains zero Electron or platform dependencies.
- **`packages/config`**: Shared configuration defaults, 20+ supported language definitions with native names, VAD audio parameters (16kHz mono PCM, 512 frame size), and keyboard shortcuts.
- **`packages/subtitle-core`**: Subtitle manipulation engine. Timestamp formatters (`HH:MM:SS,mmm` and `HH:MM:SS.mmm`), SubRip (.srt) / WebVTT (.vtt) / Plain Text (.txt) / JSON serializers and robust fault-tolerant parsers, plus `SubtitleTimeline` for stream deduplication and search.
- **`packages/translation-core`**: Provider-agnostic translation engine. Multi-target dispatch, LRU memory cache with TTL, `GlossaryEngine` for custom terminology replacement, and retry policies.
- **`packages/speech-core`**: Resampling algorithms (linear interpolation from any sampling rate to 16kHz mono), RMS and peak meter calculations, energy-based Voice Activity Detection (`VoiceActivityDetector`), and bounded queue management (`BoundedAudioQueue`).
- **`packages/provider-adapters`**: Concrete adapter implementations for speech (`LocalWhisperProvider`, `OpenAIWhisperProvider`, `GroqWhisperProvider`, `MockSpeechProvider`) and translation (`GoogleWebTranslationProvider`, `GoogleCloudTranslationProvider`, `DeepLTranslationProvider`, `LibreTranslateProvider`, `OllamaTranslationProvider`, `MockTranslationProvider`).
- **`packages/database`**: Versioned SQLite database storage layer using `NodeSqliteDriver`, schema migrations, and high-level typed repository.
- **`apps/desktop`**: Electron main, preload, and React renderer application with Material 3 / Google Dark Charcoal design system.
