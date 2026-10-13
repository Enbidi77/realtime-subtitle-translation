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

export class TesseractOcrProvider implements IOcrProvider {
  public readonly id: OcrProviderId = 'tesseract';
  public readonly displayName = 'Tesseract OCR (Local / Multi-language)';
  public readonly isLocal = true;

  private workerMap = new Map<string, Worker>();
  private isDisposed = false;

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

    const worker = await createWorker(tessLang);
    this.workerMap.set(tessLang, worker);
    return worker;
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
        console.warn(`[TesseractOcrProvider] Error terminating worker for ${lang}:`, err);
      }
    }
    this.workerMap.clear();
  }
}
