import {
  LanguageInfo,
  TranslationCapability,
  TranslationProviderId,
  TranslationRequest,
  TranslationResult,
} from '@echo-lingo/contracts';
import { ITranslationProvider } from '@echo-lingo/translation-core';
import { SUPPORTED_LANGUAGES, getLanguageName } from '@echo-lingo/config';

export class OllamaTranslationProvider implements ITranslationProvider {
  public readonly id: TranslationProviderId = 'ollama';
  public readonly name = 'Local LLM (Ollama)';
  public readonly isLocal = true;
  public readonly requiresApiKey = false;
  public readonly isPaid = false;
  private baseUrl = 'http://localhost:11434';
  private model = 'llama3.2';

  constructor(baseUrl = 'http://localhost:11434', model = 'llama3.2') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  public setConfig(baseUrl: string, model: string): void {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
  }

  public getCapability(): TranslationCapability {
    return {
      id: this.id,
      name: this.name,
      description: 'Private offline LLM translation running locally through Ollama.',
      isLocal: true,
      requiresApiKey: false,
      isConfigured: true,
      isPaid: this.isPaid,
      supportedLanguages: this.getSupportedLanguages(),
    };
  }

  public getSupportedLanguages(): LanguageInfo[] {
    return SUPPORTED_LANGUAGES;
  }

  public async initialize(config?: Record<string, unknown>): Promise<void> {
    if (config?.baseUrl && typeof config.baseUrl === 'string') {
      this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    }
    if (config?.model && typeof config.model === 'string') {
      this.model = config.model;
    }
  }

  public async translate(request: TranslationRequest): Promise<TranslationResult> {
    const text = request.text.trim();
    const start = Date.now();
    const targetLangName = getLanguageName(request.targetLanguage);

    const prompt = `You are a real-time subtitle translator. Translate the following text into ${targetLangName}. Return ONLY the direct translation without quotes, notes, or explanation.
Original text:
${text}`;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
          top_p: 0.9,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errText}`);
    }

    const json = (await response.json()) as { response?: string };
    const translatedText = (json.response || '').trim();

    return {
      originalText: text,
      translatedText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      provider: `${this.id} (${this.model})`,
      durationMs: Date.now() - start,
      fromCache: false,
    };
  }

  public async testConnection(): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (res.ok) {
        return { ok: true, message: `Connected to Ollama at ${this.baseUrl}` };
      }
      return { ok: false, message: `Ollama returned ${res.status}: ${res.statusText}` };
    } catch (err) {
      return { ok: false, message: 'Could not connect to Ollama. Make sure Ollama is running.' };
    }
  }
}
