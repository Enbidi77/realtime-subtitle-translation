# EchoLingo — Real-Time Subtitle & Translation Desktop App

EchoLingo is a desktop application engineered with **Electron**, **React 19**, **TypeScript**, and a modular pnpm monorepo. It delivers real-time speech transcription, live bilingual subtitles, translation between 100+ languages, persistent SQLite session storage, and an always-on-top floating subtitle overlay.

---

## ✨ Key Features

- 🎙️ **Real-Time Audio Capture**: Microphone and system audio (loopback/display media) capture with energy level meter.
- ⚡ **Real-Time Speech Recognition**: Offline local Whisper engine plus optional OpenAI and Groq Whisper cloud adapters.
- 🌐 **Instant Multi-Language Translation**: Free Google Translate (100+ languages out-of-the-box), Google Cloud Translation v2, DeepL (Free/Pro), LibreTranslate, and local LLMs via Ollama.
- 📺 **Floating Subtitle Overlay**: Frameless, transparent, always-on-top window with customizable opacity, font size, text alignment, and click-through mode for movies, Zoom/Teams meetings, and webinars.
- 💾 **Local Persistent Database**: High-speed SQLite database with Write-Ahead Logging (WAL), automatic schema migrations, and full session history.
- 📁 **Subtitle Import & Export**: Full round-trip import and export support for SubRip (`.srt`), WebVTT (`.vtt`), Plain Text (`.txt`), and structured JSON.
- 📚 **Custom Domain Glossary**: Define business, technical, or personal names for consistent terminology substitution.
- 🎨 **Google-Inspired Design System**: Material 3 / Google Dark Charcoal and Clean Light themes with instant toggle.
- 🌏 **Bilingual Localization**: Complete English and Vietnamese (Tiếng Việt) UI localization.
- 🔒 **Enterprise-Grade Security**: Context isolation, sandboxed renderer, encrypted credential storage via OS DPAPI/Keychain (`safeStorage`), and strict CSP.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Desktop Shell** | Electron 32 (Chromium 128 / Node 20.18) |
| **Frontend UI** | React 19, TypeScript strict mode, Vite, Tailwind CSS, Lucide Icons |
| **State & Navigation**| Zustand |
| **Audio Processing** | Web Audio API, Linear Resampler to 16kHz Mono PCM, Energy VAD |
| **Database** | SQLite with WAL mode, schema migrations, and relational repositories |
| **Testing** | Vitest unit and integration test suite |
| **Packaging** | electron-builder (Windows NSIS & portable, macOS, Linux) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20+ or v24+
- **pnpm**: v10+

### Installation & Development

```bash
# 1. Clone the repository
git clone <repository-url>
cd echo-lingo

# 2. Install workspace dependencies
pnpm install

# 3. Run the automated test suites
pnpm test

# 4. Launch EchoLingo in development mode
pnpm dev
```

### Production Build & Packaging

```bash
# Build production bundle
pnpm build

# Package unpacked distribution directory
pnpm --filter @echo-lingo/desktop run package:dir

# Build Windows installer (.exe)
pnpm --filter @echo-lingo/desktop run package:win
```

Packaged binaries are output to `apps/desktop/release/1.0.0/`.

---

## ⌨️ Global Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+Space` | Start / Stop active listening session |
| `Ctrl+Shift+P` | Pause / Resume speech recognition |
| `Ctrl+Shift+O` | Toggle Floating Subtitle Overlay window |
| `Ctrl+Shift+C` | Copy latest subtitle segment to clipboard |

---

## 📖 Architecture & Documentation

- [Architecture Overview](docs/architecture.md)
- [Audio Pipeline & VAD](docs/audio-pipeline.md)
- [Speech & Translation Providers](docs/providers.md)
- [Electron Security Model](docs/security.md)
- [Database Schema & Migrations](docs/database.md)
- [Development Guide](docs/development.md)
- [Troubleshooting Guide](docs/troubleshooting.md)
- [Agent Guidelines](AGENTS.md)

---

## 📄 License

MIT License. Copyright © 2026 EchoLingo Team.
