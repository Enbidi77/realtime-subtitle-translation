import {
  OcrProviderCapability,
  OcrProviderId,
  OcrRecognizeRequest,
  OcrResponse,
} from '@echo-lingo/contracts';
import { IOcrProvider } from '@echo-lingo/ocr-core/provider.interface.js';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('OcrRegistry');

export class OcrRegistry {
  private providers = new Map<OcrProviderId, IOcrProvider>();
  private activeProviderId: OcrProviderId = 'windows-native';

  public register(provider: IOcrProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: OcrProviderId): IOcrProvider | undefined {
    return this.providers.get(id);
  }

  public getActiveProvider(): IOcrProvider {
    const active = this.providers.get(this.activeProviderId);
    if (active) return active;

    // Fallback to first available provider
    const first = Array.from(this.providers.values())[0];
    if (!first) {
      throw new Error('No OCR providers registered in OcrRegistry');
    }
    return first;
  }

  public setActiveProvider(id: OcrProviderId): boolean {
    if (this.providers.has(id)) {
      this.activeProviderId = id;
      return true;
    }
    return false;
  }

  public getAllCapabilities(): OcrProviderCapability[] {
    return Array.from(this.providers.values()).map((p) => p.getCapability());
  }

  public async recognize(
    request: OcrRecognizeRequest,
    providerId?: OcrProviderId
  ): Promise<OcrResponse> {
    const provider = providerId ? this.getProvider(providerId) : this.getActiveProvider();
    if (!provider) {
      throw new Error(`OCR Provider "${providerId || this.activeProviderId}" is not available.`);
    }

    return provider.recognize(request);
  }

  public async dispose(): Promise<void> {
    for (const provider of this.providers.values()) {
      if (provider.dispose) {
        try {
          await provider.dispose();
        } catch (err) {
          log.error(`Error disposing provider ${provider.id}:`, err);
        }
      }
    }
    this.providers.clear();
  }
}
