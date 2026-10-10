import {
  TranslationCapability,
  TranslationProviderId,
  TranslationRequest,
  TranslationResult,
} from '@echo-lingo/contracts';
import { TranslationRegistry, TranslationCache, GlossaryEngine } from '@echo-lingo/translation-core';
import {
  GoogleWebTranslationProvider,
  GoogleCloudTranslationProvider,
  DeepLTranslationProvider,
  LibreTranslateProvider,
  OllamaTranslationProvider,
  MockTranslationProvider,
} from '@echo-lingo/provider-adapters';
import { CredentialsService } from './credentials-service.js';
import { getDatabase } from '../database/db-instance.js';

export class TranslationService {
  private registry: TranslationRegistry;
  private googleWeb: GoogleWebTranslationProvider;
  private googleCloud: GoogleCloudTranslationProvider;
  private deepL: DeepLTranslationProvider;
  private libre: LibreTranslateProvider;
  private ollama: OllamaTranslationProvider;
  private mock: MockTranslationProvider;

  constructor() {
    const cache = new TranslationCache();
    const glossary = new GlossaryEngine();
    this.registry = new TranslationRegistry({ cache, glossary });

    this.googleWeb = new GoogleWebTranslationProvider();
    this.googleCloud = new GoogleCloudTranslationProvider();
    this.deepL = new DeepLTranslationProvider();
    this.libre = new LibreTranslateProvider();
    this.ollama = new OllamaTranslationProvider();
    this.mock = new MockTranslationProvider();

    this.registry.register(this.googleWeb);
    this.registry.register(this.googleCloud);
    this.registry.register(this.deepL);
    this.registry.register(this.libre);
    this.registry.register(this.ollama);
    this.registry.register(this.mock);

    this.loadSavedCredentials();
    this.reloadGlossary();
  }

  public loadSavedCredentials(): void {
    const gcKey = CredentialsService.getCredential('google-cloud');
    if (gcKey) this.googleCloud.setApiKey(gcKey);

    const deepLKey = CredentialsService.getCredential('deepl');
    if (deepLKey) this.deepL.setApiKey(deepLKey);

    const libreKey = CredentialsService.getCredential('libretranslate');
    if (libreKey) this.libre.setConfig('https://libretranslate.com', libreKey);
  }

  public reloadGlossary(): void {
    const db = getDatabase();
    const entries = db.getGlossary();
    this.registry.getGlossary().setEntries(entries);
  }

  public getCapabilities(): TranslationCapability[] {
    this.loadSavedCredentials();
    return this.registry.getAllCapabilities();
  }

  public setActiveProvider(id: TranslationProviderId): boolean {
    return this.registry.setActiveProvider(id);
  }

  public translate(request: TranslationRequest, providerId?: TranslationProviderId): Promise<TranslationResult> {
    return this.registry.translate(request, providerId);
  }

  public translateMultiple(
    text: string,
    sourceLanguage: string,
    targetLanguages: string[],
    providerId?: TranslationProviderId
  ): Promise<Record<string, string>> {
    return this.registry.translateMultiple(text, sourceLanguage, targetLanguages, providerId);
  }
}

let translationServiceInstance: TranslationService | null = null;
export function getTranslationService(): TranslationService {
  if (!translationServiceInstance) {
    translationServiceInstance = new TranslationService();
  }
  return translationServiceInstance;
}
