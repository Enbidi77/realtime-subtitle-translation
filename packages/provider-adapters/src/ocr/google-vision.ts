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
import { createLogger, ILogger } from '@echo-lingo/logger';

const log: ILogger = createLogger('GoogleVisionOcrProvider');

interface GoogleVisionVertex {
  x?: number;
  y?: number;
}

interface GoogleVisionSymbol {
  text?: string;
  confidence?: number;
}

interface GoogleVisionWord {
  symbols?: GoogleVisionSymbol[];
  boundingBox?: {
    vertices?: GoogleVisionVertex[];
  };
  confidence?: number;
}

interface GoogleVisionParagraph {
  words?: GoogleVisionWord[];
  boundingBox?: {
    vertices?: GoogleVisionVertex[];
  };
  confidence?: number;
}

interface GoogleVisionBlock {
  paragraphs?: GoogleVisionParagraph[];
  boundingBox?: {
    vertices?: GoogleVisionVertex[];
  };
  confidence?: number;
  blockType?: string;
}

interface GoogleVisionPage {
  blocks?: GoogleVisionBlock[];
  property?: {
    detectedLanguages?: Array<{
      languageCode?: string;
      confidence?: number;
    }>;
  };
}

interface GoogleVisionAnnotateResponse {
  responses?: Array<{
    fullTextAnnotation?: {
      text?: string;
      pages?: GoogleVisionPage[];
    };
    error?: {
      code: number;
      message: string;
    };
  }>;
}

function boundingBoxFromVertices(vertices?: GoogleVisionVertex[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} | undefined {
  if (!vertices || vertices.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const v of vertices) {
    const x = typeof v.x === 'number' ? v.x : 0;
    const y = typeof v.y === 'number' ? v.y : 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  if (minX === Infinity || minY === Infinity) return undefined;

  return {
    x: Math.max(0, minX),
    y: Math.max(0, minY),
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

/**
 * Enterprise Google Cloud Vision OCR Provider.
 * Uses DOCUMENT_TEXT_DETECTION specifically optimized by Google for dense text,
 * cursive handwriting, and multilingual documents.
 */
export class GoogleVisionOcrProvider implements IOcrProvider {
  public readonly id: OcrProviderId = 'google-vision';
  public readonly displayName = 'Google Cloud Vision (Handwriting & Document)';
  public readonly isLocal = false;
  public readonly requiresApiKey = true;
  private apiKey = '';

  constructor(apiKey = '') {
    this.apiKey = apiKey.trim();
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey.trim();
  }

  public getSupportedLanguages(): OcrLanguageInfo[] {
    return OCR_SUPPORTED_LANGUAGES.map((l) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
    }));
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

    if (!this.apiKey) {
      throw new Error(
        'Google Cloud Vision API Key is not configured. Please add your API key in Settings -> Providers.'
      );
    }

    let base64Data: string;
    if (typeof request.imageBuffer === 'string') {
      base64Data = request.imageBuffer.replace(/^data:image\/\w+;base64,/, '');
    } else {
      base64Data = Buffer.from(request.imageBuffer).toString('base64');
    }

    const url = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(
      this.apiKey
    )}`;

    const imageContext: Record<string, unknown> = {};
    if (request.language && request.language !== 'auto') {
      imageContext.languageHints = [request.language];
    }

    const payload = {
      requests: [
        {
          image: {
            content: base64Data,
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION',
            },
          ],
          imageContext: Object.keys(imageContext).length > 0 ? imageContext : undefined,
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      log.error(`Google Cloud Vision API HTTP error ${response.status}: ${errText}`);
      throw new Error(`Google Cloud Vision error (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as GoogleVisionAnnotateResponse;
    const firstResult = data.responses?.[0];

    if (firstResult?.error) {
      throw new Error(`Google Cloud Vision error: ${firstResult.error.message}`);
    }

    const fullAnnotation = firstResult?.fullTextAnnotation;
    if (!fullAnnotation || !fullAnnotation.text) {
      return normalizeOcrResponse({
        text: '',
        blocks: [],
        lines: [],
        confidence: 1,
        durationMs: Date.now() - start,
        providerId: this.id,
      });
    }

    const blocks: OcrBlock[] = [];
    const allLines: OcrLine[] = [];
    let detectedLang = request.language;

    const pages = fullAnnotation.pages || [];
    for (const page of pages) {
      const pageLang = page.property?.detectedLanguages?.[0]?.languageCode;
      if (pageLang && (!detectedLang || detectedLang === 'auto')) {
        detectedLang = pageLang;
      }

      for (const block of page.blocks || []) {
        const blockLines: OcrLine[] = [];

        for (const paragraph of block.paragraphs || []) {
          const words: OcrWord[] = [];

          for (const w of paragraph.words || []) {
            const wordText = (w.symbols || []).map((s) => s.text || '').join('');
            if (!wordText) continue;

            const wordConfidence =
              typeof w.confidence === 'number' ? Math.max(0, Math.min(1, w.confidence)) : 0.95;

            words.push({
              text: wordText,
              confidence: wordConfidence,
              boundingBox: boundingBoxFromVertices(w.boundingBox?.vertices),
            });
          }

          if (words.length > 0) {
            const lineText = words.map((w) => w.text).join(' ');
            const paragraphConfidence =
              typeof paragraph.confidence === 'number'
                ? Math.max(0, Math.min(1, paragraph.confidence))
                : 0.95;

            const lineObj: OcrLine = {
              text: lineText,
              confidence: paragraphConfidence,
              words,
              boundingBox: boundingBoxFromVertices(paragraph.boundingBox?.vertices),
            };

            blockLines.push(lineObj);
            allLines.push(lineObj);
          }
        }

        if (blockLines.length > 0) {
          const blockText = blockLines.map((l) => l.text).join('\n');
          const blockConfidence =
            typeof block.confidence === 'number'
              ? Math.max(0, Math.min(1, block.confidence))
              : 0.95;

          blocks.push({
            text: blockText,
            confidence: blockConfidence,
            lines: blockLines,
            boundingBox: boundingBoxFromVertices(block.boundingBox?.vertices),
          });
        }
      }
    }

    return normalizeOcrResponse({
      text: fullAnnotation.text || '',
      blocks,
      lines: allLines,
      confidence: blocks.length > 0 ? blocks[0].confidence : 0.95,
      language: detectedLang,
      durationMs: Date.now() - start,
      providerId: this.id,
    });
  }

  public async healthCheck(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  public getCapability(): OcrProviderCapability {
    return {
      id: this.id,
      name: this.displayName,
      description:
        'Cloud-based OCR specializing in cursive handwriting, forms, and multilingual documents (Google Vision API)',
      isLocal: false,
      isAvailable: Boolean(this.apiKey && this.apiKey.length > 0),
      supportedLanguages: this.getSupportedLanguages(),
    };
  }
}
