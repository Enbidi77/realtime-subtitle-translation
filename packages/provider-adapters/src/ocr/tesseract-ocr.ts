import fs from 'fs';
import path from 'path';
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
import { OCR_SUPPORTED_LANGUAGES } from '@echo-lingo/config';
import { createWorker, Worker } from 'tesseract.js';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('TesseractOcrProvider');

export interface TesseractOcrOptions {
  workerPath?: string;
  corePath?: string;
  langPath?: string;
  cachePath?: string;
}

/**
 * Resolves the physical path to the Tesseract.js node worker script (`worker-script/node/index.js`).
 * This is required in Electron and bundled environments where default relative `__dirname`
 * lookups resolve to nonexistent paths inside bundled output directories.
 */
export function resolveTesseractWorkerPath(customWorkerPath?: string): string | undefined {
  if (customWorkerPath && fs.existsSync(customWorkerPath)) {
    return customWorkerPath;
  }

  const checkCandidate = (candidate: string): string | undefined => {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      // If packed in ASAR archive, verify the unpacked location
      if (candidate.includes('.asar') && !candidate.includes('.asar.unpacked')) {
        const unpacked = candidate.replace(/\.asar([\\/])/, '.asar.unpacked$1');
        if (fs.existsSync(unpacked)) {
          return unpacked;
        }
      }
    } catch {
      // Ignore filesystem access errors
    }
    return undefined;
  };

  // 1. Try require.resolve if available
  try {
    const resolved = require.resolve('tesseract.js/src/worker-script/node/index.js');
    const checked = checkCandidate(resolved);
    if (checked) return checked;
  } catch {
    // Ignore require.resolve errors in bundlers
  }

  // 2. Check Electron packaged resources directory
  const electronProcess = process as unknown as { resourcesPath?: string };
  if (electronProcess.resourcesPath) {
    const electronCandidates = [
      path.join(electronProcess.resourcesPath, 'app.asar.unpacked/node_modules/tesseract.js/src/worker-script/node/index.js'),
      path.join(electronProcess.resourcesPath, 'node_modules/tesseract.js/src/worker-script/node/index.js'),
    ];
    for (const c of electronCandidates) {
      const checked = checkCandidate(c);
      if (checked) return checked;
    }
  }

  // 3. Search common workspace and filesystem roots upward
  const searchRoots = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '../..'),
    __dirname,
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '../..'),
    path.resolve(__dirname, '../../..'),
    path.resolve(__dirname, '../../../..'),
  ];

  for (const root of searchRoots) {
    const candidates = [
      path.join(root, 'packages/provider-adapters/node_modules/tesseract.js/src/worker-script/node/index.js'),
      path.join(root, 'node_modules/tesseract.js/src/worker-script/node/index.js'),
      path.join(root, 'apps/desktop/node_modules/tesseract.js/src/worker-script/node/index.js'),
    ];

    for (const c of candidates) {
      const checked = checkCandidate(c);
      if (checked) return checked;
    }

    // Check inside .pnpm directory
    const pnpmDir = path.join(root, 'node_modules/.pnpm');
    try {
      if (fs.existsSync(pnpmDir)) {
        const entries = fs.readdirSync(pnpmDir).filter((e) => e.startsWith('tesseract.js@'));
        for (const e of entries) {
          const pnpmCandidate = path.join(pnpmDir, e, 'node_modules/tesseract.js/src/worker-script/node/index.js');
          const checked = checkCandidate(pnpmCandidate);
          if (checked) return checked;
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return undefined;
}

export class TesseractOcrProvider implements IOcrProvider {
  public readonly id: OcrProviderId = 'tesseract';
  public readonly displayName = 'Tesseract OCR (Local / Multi-language)';
  public readonly isLocal = true;

  private workerMap = new Map<string, Worker>();
  private isDisposed = false;
  private options: TesseractOcrOptions;

  constructor(options?: TesseractOcrOptions) {
    this.options = options || {};
  }

  public getSupportedLanguages(): OcrLanguageInfo[] {
    return OCR_SUPPORTED_LANGUAGES.map((l) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
    }));
  }

  private mapLanguageCode(langCode: string): string {
    if (!langCode || langCode === 'auto') return 'eng';

    const match = OCR_SUPPORTED_LANGUAGES.find(
      (l) =>
        l.code.toLowerCase() === langCode.toLowerCase() ||
        l.tesseractCode.toLowerCase() === langCode.toLowerCase()
    );

    return match ? match.tesseractCode : langCode;
  }

  private async getWorker(langCode: string): Promise<Worker> {
    if (this.isDisposed) {
      throw new Error('TesseractOcrProvider has already been disposed');
    }

    const tessLang = this.mapLanguageCode(langCode);

    if (this.workerMap.has(tessLang)) {
      return this.workerMap.get(tessLang)!;
    }

    const workerOptions: Record<string, unknown> = {};
    const resolvedWorker = resolveTesseractWorkerPath(this.options.workerPath);
    if (resolvedWorker) {
      workerOptions.workerPath = resolvedWorker;
    }
    if (this.options.corePath) {
      workerOptions.corePath = this.options.corePath;
    }
    if (this.options.langPath) {
      workerOptions.langPath = this.options.langPath;
    }
    if (this.options.cachePath) {
      workerOptions.cachePath = this.options.cachePath;
    }

    try {
      const worker = await createWorker(tessLang, 1, workerOptions);
      this.workerMap.set(tessLang, worker);
      return worker;
    } catch (err) {
      log.error(`Failed to initialize Tesseract worker for language ${tessLang}:`, err);
      throw new Error(
        `Failed to initialize Tesseract OCR engine for language "${tessLang}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  public async recognize(request: OcrRecognizeRequest): Promise<OcrResponse> {
    const start = Date.now();

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

    let buffer: Buffer;
    if (typeof request.imageBuffer === 'string') {
      const base64Data = request.imageBuffer.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = Buffer.from(request.imageBuffer);
    }

    const lang = request.language || 'eng';
    const worker = await this.getWorker(lang);

    if (request.preprocessOptions?.profile === 'handwritten') {
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: '6' as any,
        });
      } catch {
        // ignore parameter setting error if unsupported in mock or web env
      }
    }

    const result = await worker.recognize(buffer);
    const data = result.data;

    const blocks: OcrBlock[] = [];
    const allLines: OcrLine[] = [];

    if (data.blocks && data.blocks.length > 0) {
      for (const b of data.blocks) {
        const blockLines: OcrLine[] = [];

        if (b.paragraphs) {
          for (const p of b.paragraphs) {
            if (p.lines) {
              for (const l of p.lines) {
                const words: OcrWord[] = (l.words || []).map((w) => ({
                  text: w.text,
                  confidence: Math.round(w.confidence) / 100,
                  boundingBox: {
                    x: w.bbox.x0,
                    y: w.bbox.y0,
                    width: w.bbox.x1 - w.bbox.x0,
                    height: w.bbox.y1 - w.bbox.y0,
                  },
                }));

                const lineObj: OcrLine = {
                  text: l.text,
                  confidence: Math.round(l.confidence) / 100,
                  words,
                  boundingBox: {
                    x: l.bbox.x0,
                    y: l.bbox.y0,
                    width: l.bbox.x1 - l.bbox.x0,
                    height: l.bbox.y1 - l.bbox.y0,
                  },
                };

                blockLines.push(lineObj);
                allLines.push(lineObj);
              }
            }
          }
        }

        blocks.push({
          text: b.text,
          confidence: Math.round(b.confidence) / 100,
          lines: blockLines,
          boundingBox: {
            x: b.bbox.x0,
            y: b.bbox.y0,
            width: b.bbox.x1 - b.bbox.x0,
            height: b.bbox.y1 - b.bbox.y0,
          },
        });
      }
    }

    const overallConfidence =
      typeof data.confidence === 'number'
        ? Math.round(data.confidence) / 100
        : 0.9;

    return normalizeOcrResponse({
      text: data.text || '',
      blocks,
      lines: allLines,
      confidence: overallConfidence,
      language: lang,
      durationMs: Date.now() - start,
      providerId: this.id,
    });
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const worker = await this.getWorker('eng');
      return Boolean(worker);
    } catch {
      return false;
    }
  }

  public getCapability(): OcrProviderCapability {
    return {
      id: this.id,
      name: this.displayName,
      description: 'Portable, multi-language neural network OCR powered by Tesseract',
      isLocal: true,
      isAvailable: true,
      supportedLanguages: this.getSupportedLanguages(),
    };
  }

  public async dispose(): Promise<void> {
    this.isDisposed = true;
    for (const [lang, worker] of this.workerMap.entries()) {
      try {
        await worker.terminate();
      } catch (err) {
        log.warn(`Error terminating worker for ${lang}:`, err);
      }
    }
    this.workerMap.clear();
  }
}
