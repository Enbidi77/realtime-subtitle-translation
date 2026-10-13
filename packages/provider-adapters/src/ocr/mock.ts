import {
  OcrLanguageInfo,
  OcrProviderCapability,
  OcrProviderId,
  OcrRecognizeRequest,
  OcrResponse,
} from '@echo-lingo/contracts';
import { IOcrProvider } from '@echo-lingo/ocr-core';
import { normalizeOcrResponse } from '@echo-lingo/ocr-core';

export class MockOcrProvider implements IOcrProvider {
  public readonly id: OcrProviderId = 'mock';
  public readonly displayName = 'Mock OCR Provider (Testing)';
  public readonly isLocal = true;

  private mockText = 'EchoLingo On-Screen OCR Translation';
  private mockConfidence = 0.98;

  constructor(options?: { mockText?: string; mockConfidence?: number }) {
    if (options?.mockText) this.mockText = options.mockText;
    if (options?.mockConfidence !== undefined) this.mockConfidence = options.mockConfidence;
  }

  public setMockResult(text: string, confidence = 0.98): void {
    this.mockText = text;
    this.mockConfidence = confidence;
  }

  public getSupportedLanguages(): OcrLanguageInfo[] {
    return [
      { code: 'auto', name: 'Auto Detect', nativeName: 'Tự động phát hiện' },
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
    ];
  }

  public async recognize(request: OcrRecognizeRequest): Promise<OcrResponse> {
    const start = Date.now();

    const words = this.mockText.split(/\s+/).map((w, i) => ({
      text: w,
      confidence: this.mockConfidence,
      boundingBox: { x: i * 80, y: 10, width: 75, height: 25 },
    }));

    const lines = [
      {
        text: this.mockText,
        confidence: this.mockConfidence,
        words,
        boundingBox: { x: 0, y: 10, width: words.length * 80, height: 25 },
      },
    ];

    const blocks = [
      {
        text: this.mockText,
        confidence: this.mockConfidence,
        lines,
        boundingBox: { x: 0, y: 10, width: words.length * 80, height: 25 },
      },
    ];

    const raw: Partial<OcrResponse> & { text: string; providerId: string } = {
      text: this.mockText,
      blocks,
      lines,
      confidence: this.mockConfidence,
      language: request.language || 'en',
      durationMs: Date.now() - start,
      providerId: this.id,
    };

    return normalizeOcrResponse(raw);
  }

  public async healthCheck(): Promise<boolean> {
    return true;
  }

  public getCapability(): OcrProviderCapability {
    return {
      id: this.id,
      name: this.displayName,
      description: 'Deterministic mock OCR engine for automated testing and CI',
      isLocal: true,
      isAvailable: true,
      supportedLanguages: this.getSupportedLanguages(),
    };
  }
}
