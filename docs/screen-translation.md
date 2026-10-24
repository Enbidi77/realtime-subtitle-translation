# On-Screen OCR & Translation Architecture & Guide

EchoLingo provides production-grade **On-Screen OCR & Translation** enabling users to capture any region of their desktop, recognize printed or stylized text, translate it using configurable translation engines, and inspect or copy results seamlessly.

---

## 1. Supported Workflows

### Workflow A: One-Time Region Capture & Translate
1. User triggers capture via keyboard shortcut (`CmdOrCtrl+Shift+T`), UI button, or system tray.
2. EchoLingo captures the desktop snapshot via `desktopCapturer` *before* displaying any overlay to eliminate self-capture feedback loops.
3. A transparent, borderless, frameless selection window (`selection.html`) covers the active display with a dimmed background, crosshair cursor, selection outline, and live dimension indicators.
4. User drags a rectangle over the target area (with Esc to cancel or Enter to confirm).
5. On mouse release, CSS coordinates are translated to physical display pixel bounds taking device pixel ratio (DPR) into account.
6. The cropped image is preprocessed (e.g., grayscale, Otsu binarization, contrast stretching) according to the selected profile (`general`, `game-subtitles`, `small-ui`, `high-contrast`, `cjk`).
7. OCR engine extracts text and confidence metrics.
8. The recognized text is displayed in an editable preview (allowing user corrections), alongside confidence indicators.
9. Translation is performed using the user's selected translation provider (Google Web, Google Cloud, DeepL, LibreTranslate, Ollama).
10. The result is presented with one-click copy, retranslation, export, and history persistence.

### Workflow B: Quick OCR Translation (Floating Mode)
1. User activates quick OCR capture with `skipPreview: true`.
2. EchoLingo immediately captures, recognizes, and translates the selected region.
3. The result pops up in a compact, floating, frameless draggable panel (`ocr-panel.html`) positioned near the selection and clamped to the display's usable work area.
4. The floating panel offers instant 1-click clipboard copy (`Copy Translation`, `Copy Both`) and a `Capture Next` button for rapid sequential captures.

### Workflow C: Continuous Screen OCR Monitoring
1. Designed for changing on-screen text (video subtitles, game dialogues, live presentations).
2. Runs a background capture loop at a configurable interval (500ms – 5000ms).
3. Utilizes `ContinuousOcrScheduler` with **backpressure protection** (never queues redundant overlapping captures if an OCR pass takes longer than the interval).
4. Employs `TextDeduplicator` using normalized Levenshtein similarity to detect meaningful changes:
   - Identical or sub-threshold text changes are skipped, avoiding redundant translation API calls and CPU overhead.
   - Only genuine changes trigger translation and dispatch events to the UI and floating panel.
5. Emits real-time diagnostic stats (FPS, processed count, skipped count, average latency).

---

## 2. Architecture & Module Structure

```
echo-lingo/
├── packages/contracts/src/
│   ├── ocr.ts                      # OCR bounding boxes, lines, blocks, responses, profiles, capabilities
│   └── screen-translation.ts       # Region, capture results, continuous state/stats, history, floating panel
├── packages/config/src/
│   └── ocr.ts                      # OCR presets, default settings, supported OCR language lists
├── packages/ocr-core/              # Provider-neutral OCR orchestration & math
│   ├── coordinate-converter.ts     # DPR scaling, multi-monitor bounds, window coordinate transformations
│   ├── image-processor.ts          # Raw pixel buffers: grayscale, Otsu binarization, contrast stretching, scaling
│   ├── ocr-normalizer.ts           # Whitespace cleanup, punctuation fixes, duplicate rolling line removal
│   ├── text-deduplicator.ts        # Levenshtein similarity, change thresholding, incremental line extraction
│   ├── continuous-scheduler.ts     # Asynchronous loop with backpressure protection and deduplication
│   └── ocr-registry.ts             # Provider registry and dispatch
├── packages/provider-adapters/src/ocr/
│   ├── windows-ocr.ts              # Windows 10/11 native WinRT Windows.Media.Ocr adapter (PowerShell bridge)
│   ├── tesseract-ocr.ts            # Local WebAssembly/Worker Tesseract.js adapter with language model caching
│   └── mock.ts                     # Mock OCR provider for automated unit testing
├── packages/database/src/
│   ├── schema.ts                   # Migration 2: ocr_history table and indexes
│   └── repository.ts               # insertOcrHistoryItem, getOcrHistoryItem, getAllOcrHistory, searchOcrHistory
└── apps/desktop/
    ├── src/main/screen-capture/    # ScreenCaptureManager (display enumeration, desktopCapturer capture)
    ├── src/main/windows/           # SelectionWindow and OcrPanelWindow lifecycles
    ├── src/main/services/          # ScreenTranslationService and ShortcutsService
    ├── src/preload/index.ts        # window.electronAPI.screenTranslation contextBridge
    └── src/renderer/
        ├── features/screen-translation/ # ScreenTranslationView (One-time, Continuous, History tabs)
        ├── selection.html          # HTML entry for region selection window
        └── ocr-panel.html          # HTML entry for compact floating panel
```

---

## 3. Coordinate Transformations & Multi-Monitor Support

When selecting screen regions on modern multi-monitor systems, coordinate spaces differ significantly:
- **Logical Desktop Coordinates**: Electron `screen.getDisplayMatching(rect).bounds` in CSS points. Display coordinates can be negative on secondary displays.
- **Physical Pixel Space**: Screenshots captured by `desktopCapturer` are sized to physical pixels (`width * scaleFactor`).
- **Normalized Box Calculation**: `CoordinateConverter.toPhysicalCropRegion` handles:
  - Inverted drag coordinates (user dragged bottom-right to top-left).
  - Clamp-to-bounds (ensures selections cannot exceed display dimensions).
  - High-DPI physical coordinate scaling ($X_{phys} = X_{local} \times DPR$).
  - Negative display origins without coordinate corruption.
  - Floating panel placement clamped within the target display's `workArea`.

---

## 4. OCR Engines

### Windows Native WinRT OCR (`windows-native`)
- Native to Windows 10 and Windows 11 (`Windows.Media.Ocr.OcrEngine`).
- Zero external binary downloads; runs with hardware acceleration on Windows.
- Automatically uses installed Windows language packs (e.g. English, Traditional Chinese, Japanese, etc.).
- Invoked via high-performance .NET 8 WinRT IPC server (Named Pipe via `@echo-lingo/dotnet-bridge`).

### Local Tesseract.js OCR (`tesseract`)
- Fully offline, cross-platform WebAssembly OCR engine.
- Supports 100+ languages with automatic model downloading and caching.
- Emits bounding boxes, confidence values, lines, and words.

---

## 5. Security & Privacy Principles

1. **Zero Silent Cloud Uploads**: Screenshots and cropped images are processed strictly locally by default.
2. **Ephemerality**: Image buffers are kept in memory and garbage-collected immediately. Screenshots are never written to disk or database unless the user explicitly enables `persistScreenshots` in settings.
3. **Safe Storage**: API keys for optional cloud translation providers are stored encrypted using Electron's `safeStorage`.
4. **Renderer Isolation**: The React renderer has zero access to Node.js or Electron internals. All capture and OCR requests pass through the typed, Zod-validated contextBridge.

---

## 6. Keyboard Shortcuts

| Shortcut | Description |
|---|---|
| `CmdOrCtrl+Shift+T` | One-time screen capture & OCR translation |
| `CmdOrCtrl+Shift+R` | Toggle continuous screen OCR monitoring |
| `Escape` | Cancel region selection or dismiss floating panel |
| `Enter` | Confirm selection in region selector window |
