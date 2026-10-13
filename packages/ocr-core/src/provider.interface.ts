import {
  OcrLanguageInfo,
  OcrProviderCapability,
  OcrProviderId,
  OcrRecognizeRequest,
  OcrResponse,
} from '@echo-lingo/contracts';

export interface IOcrProvider {
  readonly id: OcrProviderId;
  readonly displayName: string;
  readonly isLocal: boolean;

  /**
   * Retrieves all supported languages for this OCR engine.
   */
  getSupportedLanguages(): OcrLanguageInfo[];

  /**
   * Performs optical character recognition on an image buffer or base64 string.
   */
  recognize(
    request: OcrRecognizeRequest,
    options?: Record<string, unknown>
  ): Promise<OcrResponse>;

  /**
   * Verifies engine readiness, available binaries, or worker status.
   */
  healthCheck(): Promise<boolean>;

  /**
   * Retrieves provider capabilities and availability status.
   */
  getCapability(): OcrProviderCapability;

  /**
   * Optional resource cleanup on application shutdown.
   */
  dispose?(): Promise<void>;
}
