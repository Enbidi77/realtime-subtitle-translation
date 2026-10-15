import {
  OcrLanguageInfo,
  OcrProviderCapability,
  OcrProviderId,
  OcrRecognizeRequest,
  OcrResponse,
  OcrBlock,
  OcrLine,
  OcrWord,
} from '@echo-lingo/contracts';
import { IOcrProvider, normalizeOcrResponse } from '@echo-lingo/ocr-core';
import { runOcrLanguagesScript, runOcrRecognizeScript } from '@echo-lingo/powershell';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('WindowsNativeOcrProvider');

export class WindowsNativeOcrProvider implements IOcrProvider {
  public readonly id: OcrProviderId = 'windows-native';
  public readonly displayName = 'Windows Native OCR (Hardware Accelerated)';
  public readonly isLocal = true;

  private cachedLanguages: OcrLanguageInfo[] | null = null;

  public getSupportedLanguages(): OcrLanguageInfo[] {
    if (this.cachedLanguages) return this.cachedLanguages;

    return [
      { code: 'auto', name: 'Auto Detect / System Default', nativeName: 'Tự động phát hiện' },
      { code: 'en-US', name: 'English (United States)', nativeName: 'English' },
      { code: 'zh-Hant-TW', name: 'Chinese (Traditional, Taiwan)', nativeName: '繁體中文' },
      { code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
    ];
  }

  public async refreshSupportedLanguages(): Promise<OcrLanguageInfo[]> {
    if (process.platform !== 'win32') {
      return this.getSupportedLanguages();
    }

    try {
      const { stdout } = await runOcrLanguagesScript({ timeout: 5000 });

      if (stdout && stdout.trim()) {
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        this.cachedLanguages = [
          { code: 'auto', name: 'Auto Detect / System Default', nativeName: 'Tự động phát hiện' },
          ...list.map((l: any) => ({
            code: l.code,
            name: l.name,
            nativeName: l.nativeName,
          })),
        ];
        return this.cachedLanguages;
      }
    } catch (err) {
      log.warn('Error detecting installed OCR languages:', err);
    }

    return this.getSupportedLanguages();
  }

  public async recognize(request: OcrRecognizeRequest): Promise<OcrResponse> {
    const start = Date.now();

    if (process.platform !== 'win32') {
      throw new Error('Windows Native OCR is only supported on Windows operating systems.');
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

    // Prepare temporary image file for PowerShell consumption
    const tempDir = os.tmpdir();
    const tempImagePath = path.join(tempDir, `echolingo_ocr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`);

    try {
      let buffer: Buffer;
      if (typeof request.imageBuffer === 'string') {
        const base64Data = request.imageBuffer.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(request.imageBuffer);
      }

      await fs.writeFile(tempImagePath, buffer);

      const langTag = request.language || 'auto';
      const { stdout, stderr } = await runOcrRecognizeScript(tempImagePath, langTag, {
        timeout: 15000,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (stderr && stderr.trim().length > 0) {
        log.warn('Stderr output:', stderr);
      }

      const trimmed = (stdout || '').trim();
      if (!trimmed) {
        throw new Error('Windows OCR produced empty output');
      }

      const jsonStart = trimmed.indexOf('{');
      const jsonEnd = trimmed.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error(`Invalid JSON output from Windows OCR: ${trimmed}`);
      }

      const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
      if (parsed.error) {
        throw new Error(`Windows OCR failed: ${parsed.error}`);
      }

      const lines: OcrLine[] = (parsed.lines || []).map((l: any) => ({
        text: l.text,
        confidence: l.confidence ?? 0.95,
        words: (l.words || []).map((w: any) => ({
          text: w.text,
          confidence: w.confidence ?? 0.95,
          boundingBox: w.boundingBox,
        })),
      }));

      const blocks: OcrBlock[] = [
        {
          text: parsed.text || '',
          confidence: parsed.confidence ?? 0.95,
          lines,
        },
      ];

      return normalizeOcrResponse({
        text: parsed.text || '',
        blocks,
        lines,
        confidence: parsed.confidence ?? 0.95,
        language: parsed.language || request.language,
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
    return process.platform === 'win32';
  }

  public getCapability(): OcrProviderCapability {
    return {
      id: this.id,
      name: this.displayName,
      description: 'Zero-download, native Windows 10/11 OCR engine with GPU acceleration',
      isLocal: true,
      isAvailable: process.platform === 'win32',
      supportedLanguages: [
        { code: 'auto', name: 'Auto Detect / System Default', nativeName: 'Tự động phát hiện' },
        { code: 'en-US', name: 'English (United States)', nativeName: 'English' },
        { code: 'zh-Hant-TW', name: 'Chinese (Traditional, Taiwan)', nativeName: '繁體中文' },
        { code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
      ],
    };
  }
}
