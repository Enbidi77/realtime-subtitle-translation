# @echo-lingo/powershell

Dedicated package for standalone PowerShell scripts and execution utilities used by EchoLingo.

## Structure

```
packages/powershell/
├── scripts/
│   ├── ocr-recognize.ps1          # Windows Media.Ocr runtime recognition
│   ├── ocr-languages.ps1          # Enumerate available Windows OCR language models
│   ├── speech-recognize.ps1       # Windows System.Speech SAPI recognition
│   ├── speech-recognizers.ps1     # Enumerate installed SAPI speech recognizers
│   └── expand-archive.ps1         # Safe archive extraction using Expand-Archive
├── src/
│   ├── index.ts                   # Package entry point
│   ├── scripts.ts                 # Script file mappings and path resolver
│   ├── runner.ts                  # Typed PowerShell execution runners
│   └── __tests__/                 # Vitest unit tests
├── package.json
└── tsconfig.json
```

## Features

- **Strict Separation**: All PowerShell code lives exclusively in individual `.ps1` files under `scripts/`. No in-place PowerShell script strings exist in TypeScript source code.
- **Dynamic Path Resolution**: `getPowerShellScriptPath(name)` resolves the physical `.ps1` file across monorepo workspace layouts and production resource paths.
- **Typed Execution Helpers**: High-level async functions (`runOcrRecognizeScript`, `runOcrLanguagesScript`, `runSpeechRecognizeScript`, `runSpeechRecognizersScript`, `runExpandArchiveScript`) handle parameter passing, process flags (`-NoProfile -NonInteractive -ExecutionPolicy Bypass`), and output streaming.
