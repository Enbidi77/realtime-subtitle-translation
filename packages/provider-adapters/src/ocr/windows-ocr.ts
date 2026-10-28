import {
  OcrBlock,
  OcrLanguageInfo,
  OcrLine,
  OcrProviderCapability,
  OcrProviderId,
  OcrRecognizeRequest,
  OcrResponse,
  OcrWord,
} from '@echo-lingo/contracts';
import { IOcrProvider, normalizeOcrResponse } from '@echo-lingo/ocr-core';
import { OCR_SUPPORTED_LANGUAGES } from '@echo-lingo/config';
import {
  dotnetBridge,
  DotnetBridge,
  OcrLanguageDto,
  OcrRecognizeResult,
} from '@echo-lingo/dotnet-bridge';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('WindowsNativeOcrProvider');

export interface WindowsNativeOcrConfig {
  /** Custom DotnetBridge instance; defaults to the shared singleton dotnetBridge */
  bridge?: DotnetBridge;
}

function mapToBcp47(langCode?: string): string {
  if (!langCode || langCode === 'auto') return 'auto';
  const match = OCR_SUPPORTED_LANGUAGES.find(
    (l) =>
      l.code.toLowerCase() === langCode.toLowerCase() ||
      l.bcp47.toLowerCase() === langCode.toLowerCase()
  );
  return match ? match.bcp47 : langCode;
}

function computeBoundingBox(boxes: Array<{ x: number; y: number; width: number; height: number }>): {
  x: number;
  y: number;
  width: number;
  height: number;
} | undefined {
  if (!boxes || boxes.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const b of boxes) {
    if (typeof b?.x !== 'number' || typeof b?.y !== 'number') continue;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }

  if (minX === Infinity || minY === Infinity) return undefined;

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

/**
 * Hardware-accelerated Windows Native OCR Provider (Windows.Media.Ocr).
 * Communicates with the C# .NET 8 IPC server (/ipc) over Named Pipes
 * using @echo-lingo/dotnet-bridge.
 */
export class WindowsNativeOcrProvider implements IOcrProvider {
  public readonly id: OcrProviderId = 'windows-native';
  public readonly displayName = 'Windows Native OCR (Hardware Accelerated)';
  public readonly isLocal = true;

  private bridge: DotnetBridge;
  private isCustomBridge: boolean;
  private cachedLanguages: OcrLanguageInfo[] | null = null;

  constructor(config: WindowsNativeOcrConfig = {}) {
    this.bridge = config.bridge ?? dotnetBridge;
    this.isCustomBridge = Boolean(config.bridge);
  }

  public getSupportedLanguages(): OcrLanguageInfo[] {
    if (this.cachedLanguages) return this.cachedLanguages;

    return OCR_SUPPORTED_LANGUAGES.map((l) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
    }));
  }

  public async refreshSupportedLanguages(): Promise<OcrLanguageInfo[]> {
    if (process.platform !== 'win32') {
      return this.getSupportedLanguages();
    }

    if (!this.bridge.isAvailable()) {
      log.warn('.NET IPC Bridge (EchoLingo.Ipc) is not available for listing OCR languages.');
      return this.getSupportedLanguages();
    }

    try {
      const langs = await this.bridge.ocr.getAvailableLanguages();
      if (langs && langs.length > 0) {
        this.cachedLanguages = [
          { code: 'auto', name: 'Auto Detect / System Default', nativeName: 'Tự động phát hiện' },
          ...langs.map((l: OcrLanguageDto) => ({
            code: l.languageTag,
            name: l.displayName,
            nativeName: l.displayName,
          })),
        ];
        return this.cachedLanguages;
      }
    } catch (err) {
      log.warn('DotnetBridge OCR languages error:', err);
    }

    return this.getSupportedLanguages();
  }

  public async recognize(
    request: OcrRecognizeRequest,
    _options?: Record<string, unknown>
  ): Promise<OcrResponse> {
    const start = Date.now();

    if (process.platform !== 'win32') {
      throw new Error('Windows Native OCR is only supported on Windows operating systems.');
    }

    if (!this.bridge.isAvailable()) {
      throw new Error('.NET IPC Bridge (EchoLingo.Ipc) is not available on this system.');
    }

    if (!request.imageBuffer) {
      return normalizeOcrResponse({
        text: '',
        blocks: [],
        lines: [],
        confidence: 0,
        durationMs: 0,
        providerId: this.id,
      });
    }

    const tempDir = os.tmpdir();
    const tempImagePath = path.join(
      tempDir,
      `echolingo_ocr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`
    );

    try {
      let buffer: Buffer;
      if (typeof request.imageBuffer === 'string') {
        const base64Data = request.imageBuffer.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(request.imageBuffer);
      }

      await fs.writeFile(tempImagePath, buffer);

      const langTag = mapToBcp47(request.language);
      const parsed: OcrRecognizeResult = await this.bridge.ocr.recognize(tempImagePath, langTag);

      if (!parsed) {
        throw new Error('Windows OCR returned empty response from .NET IPC bridge');
      }

      if (parsed.error) {
        throw new Error(`Windows OCR failed: ${parsed.error}`);
      }

      const lines: OcrLine[] = (parsed.lines || []).map((l) => {
        const words: OcrWord[] = (l.words || []).map((w) => ({
          text: w.text,
          confidence: w.confidence ?? 0.95,
          boundingBox: w.boundingBox,
        }));

        const wordBoxes = words
          .map((w) => w.boundingBox)
          .filter((box): box is NonNullable<typeof box> => Boolean(box));

        return {
          text: l.text,
          confidence: l.confidence ?? 0.95,
          words,
          boundingBox: computeBoundingBox(wordBoxes),
        };
      });

      const lineBoxes = lines
        .map((l) => l.boundingBox)
        .filter((box): box is NonNullable<typeof box> => Boolean(box));

      const blocks: OcrBlock[] = [
        {
          text: parsed.text || '',
          confidence: 0.95,
          lines,
          boundingBox: computeBoundingBox(lineBoxes),
        },
      ];

      return normalizeOcrResponse({
        text: parsed.text || '',
        blocks,
        lines,
        confidence: 0.95,
        language: parsed.detectedLanguage || request.language,
        durationMs: Date.now() - start,
        providerId: this.id,
      });
    } finally {
      // Clean up temporary image file promptly
      try {
        await fs.unlink(tempImagePath);
      } catch {
        // ignore cleanup error
      }
    }
  }

  public async healthCheck(): Promise<boolean> {
    return process.platform === 'win32' && this.bridge.isAvailable();
  }

  public getCapability(): OcrProviderCapability {
    return {
      id: this.id,
      name: this.displayName,
      description: 'Zero-download, native Windows 10/11 OCR engine with GPU acceleration (via .NET IPC)',
      isLocal: true,
      isAvailable: process.platform === 'win32' && this.bridge.isAvailable(),
      supportedLanguages: this.getSupportedLanguages(),
    };
  }

  public async dispose(): Promise<void> {
    if (this.isCustomBridge) {
      await this.bridge.dispose();
    }
  }
}
