# EchoLingo Providers Guide

## Speech Recognition Providers

| Provider | Type | API Key | Notes |
|---|---|---|---|
| **Windows System Speech** | Local / Offline | Not required | Built-in offline Windows SAPI recognition (`System.Speech`). Zero external setup or models needed. |
| **Local Whisper** | Local / Offline | Not required | Runs locally using ONNX runtime / whisper.cpp with zero external dependencies. |
| **OpenAI Whisper** | Cloud | Required | Official OpenAI Audio API (`whisper-1`). High accuracy across 99+ languages. |
| **Groq Whisper** | Cloud | Required | Ultra-low latency Whisper (`whisper-large-v3-turbo`) with response times < 250ms. |
| **Mock Engine** | Local | Not required | Deterministic engine for CI and unit test execution. |

## Translation Providers

| Provider | Type | API Key | Notes |
|---|---|---|---|
| **Google Translate (Free)** | Web | Not required | Out-of-the-box translation between 100+ languages without any credentials. |
| **Google Cloud Translation** | Cloud | Required | Enterprise v2/v3 Google Translation API with high rate limits. |
| **DeepL Translator** | Cloud | Required | Supports both Free (`api-free.deepl.com`) and Pro (`api.deepl.com`) keys. |
| **LibreTranslate** | Self-hosted / Cloud | Optional | Open source machine translation supporting localhost and private clouds. |
| **Ollama Local LLM** | Local / Offline | Not required | 100% private offline translation via local Ollama instances (`llama3.2`, `qwen2.5`). |
| **Mock Translator** | Local | Not required | Deterministic offline translation for testing. |

## Credential Security

All API keys are encrypted at rest using Electron's `safeStorage` API, which interfaces directly with:
- **Windows**: DPAPI (Data Protection API)
- **macOS**: Keychain
- **Linux**: Secret Service API / libsecret

Plaintext credentials are never stored in SQLite database tables or transmitted back to the untrusted renderer process.
