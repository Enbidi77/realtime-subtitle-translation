import React, { useEffect, useState } from 'react';
import { TranslationCapability, SpeechModelStatus, GlossaryEntry } from '@echo-lingo/contracts';
import { useI18n } from '../../app/i18n/index.js';
import { useSettingsStore } from '../../stores/settings-store.js';
import {
  Cpu,
  Globe,
  Key,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  BookA,
  X,
  Check,
  ExternalLink,
} from 'lucide-react';

interface ConfigurableProvider {
  id: string;
  name: string;
  description: string;
  isConfigured: boolean;
  requiresApiKey: boolean;
  isLocal: boolean;
  signupUrl?: string;
}

export const ProvidersView: React.FC = () => {
  const { t } = useI18n();
  const speechEngine = useSettingsStore((s) => s.settings.speechEngine);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [models, setModels] = useState<SpeechModelStatus[]>([]);
  const [providers, setProviders] = useState<TranslationCapability[]>([]);
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);

  // Speech engine providers with credential states
  const [speechEngines, setSpeechEngines] = useState<ConfigurableProvider[]>([
    {
      id: 'groq-whisper',
      name: 'Groq Cloud Whisper (Ultra-Fast & Free)',
      description: 'Ultra-fast (<300ms) transcription powered by whisper-large-v3-turbo. Free tier includes 14,400 audio seconds per day.',
      requiresApiKey: true,
      isConfigured: false,
      isLocal: false,
      signupUrl: 'https://console.groq.com/keys',
    },
    {
      id: 'openai-whisper',
      name: 'OpenAI Whisper Cloud',
      description: 'Official OpenAI whisper-1 cloud transcription with high punctuation and multi-lingual grammar accuracy.',
      requiresApiKey: true,
      isConfigured: false,
      isLocal: false,
      signupUrl: 'https://platform.openai.com/api-keys',
    },
    {
      id: 'mock',
      name: 'Mock Speech Engine (Instant Test & Demo)',
      description: 'Simulates live speech subtitles on audio energy detection. Zero API key needed, ideal for testing the pipeline over YouTube.',
      requiresApiKey: false,
      isConfigured: true,
      isLocal: true,
    },
    {
      id: 'whisper-local',
      name: 'Local Whisper Engine',
      description: 'Offline speech inference using managed local worker or whisper.cpp.',
      requiresApiKey: false,
      isConfigured: true,
      isLocal: true,
    },
  ]);

  // Key config modal
  const [editingProvider, setEditingProvider] = useState<{ id: string; name: string; signupUrl?: string } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // New glossary entry modal
  const [showAddGlossary, setShowAddGlossary] = useState(false);
  const [sourceTerm, setSourceTerm] = useState('');
  const [targetTerm, setTargetTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);

  const loadData = async () => {
    if (!window.electronAPI) return;
    try {
      const [m, p, g, hasGroq, hasOpenAI] = await Promise.all([
        window.electronAPI.speech.getModels(),
        window.electronAPI.translation.getProviders(),
        window.electronAPI.glossary.list(),
        window.electronAPI.translation.hasCredential('groq-whisper'),
        window.electronAPI.translation.hasCredential('openai-whisper'),
      ]);
      setModels(m);
      setProviders(p);
      setGlossary(g);
      setSpeechEngines((prev) =>
        prev.map((eng) => {
          if (eng.id === 'groq-whisper') return { ...eng, isConfigured: Boolean(hasGroq) };
          if (eng.id === 'openai-whisper') return { ...eng, isConfigured: Boolean(hasOpenAI) };
          return eng;
        })
      );
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveKey = async () => {
    if (!editingProvider || !window.electronAPI) return;
    try {
      await window.electronAPI.translation.setCredential(editingProvider.id, apiKeyInput);
      if (editingProvider.id === 'groq-whisper' || editingProvider.id === 'openai-whisper') {
        await updateSettings({ speechEngine: editingProvider.id as any });
      }
      setApiKeyInput('');
      setEditingProvider(null);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestConnection = async (provider: TranslationCapability) => {
    if (!window.electronAPI) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await window.electronAPI.translation.translate({
        text: 'Hello, welcome to EchoLingo!',
        sourceLanguage: 'en',
        targetLanguage: 'vi',
      });
      setTestResult(`Success: "${res.translatedText}" (${res.durationMs}ms)`);
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddGlossary = async () => {
    if (!sourceTerm.trim() || !targetTerm.trim() || !window.electronAPI) return;
    const entry: GlossaryEntry = {
      id: 'gl_' + Date.now(),
      sourceTerm: sourceTerm.trim(),
      targetTerm: targetTerm.trim(),
      sourceLanguage: 'auto',
      targetLanguage: 'vi',
      caseSensitive,
      createdAt: Date.now(),
    };
    await window.electronAPI.glossary.add(entry);
    setSourceTerm('');
    setTargetTerm('');
    setShowAddGlossary(false);
    await loadData();
  };

  const handleDeleteGlossary = async (id: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.glossary.delete(id);
    await loadData();
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary" />
          <span>{t('providers.title')}</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('providers.subtitle')}
        </p>
      </div>

      {/* Speech Recognition Engines */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          <span>Speech Recognition Engines</span>
        </h2>

        <div className="space-y-2.5">
          {speechEngines.map((eng) => (
            <div
              key={eng.id}
              className="p-4 rounded-xl bg-card border border-border flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-foreground">{eng.name}</span>
                  {speechEngine === eng.id ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/15 border border-primary/30 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                      ACTIVE
                    </span>
                  ) : null}
                  {eng.isConfigured ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      {t('providers.configured')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" />
                      {t('providers.notConfigured')}
                    </span>
                  )}
                  {eng.isLocal && (
                    <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Local
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{eng.description}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {speechEngine !== eng.id && (eng.isConfigured || !eng.requiresApiKey) && (
                  <button
                    onClick={() => updateSettings({ speechEngine: eng.id as any })}
                    className="px-2.5 py-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 text-xs font-medium transition-colors"
                  >
                    Activate
                  </button>
                )}

                {eng.signupUrl && (
                  <a
                    href={eng.signupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-primary hover:bg-muted transition-colors"
                  >
                    <span>Get Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {eng.requiresApiKey && (
                  <button
                    onClick={() => {
                      setEditingProvider(eng);
                      setApiKeyInput('');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>API Key</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Translation Providers */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <span>{t('providers.translationProviders')}</span>
        </h2>

        <div className="space-y-2.5">
          {providers.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-xl bg-card border border-border flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-foreground">{p.name}</span>
                  {p.isConfigured ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      {t('providers.configured')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" />
                      {t('providers.notConfigured')}
                    </span>
                  )}
                  {p.isLocal && (
                    <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Local
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{p.description}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleTestConnection(p)}
                  disabled={isTesting || (!p.isConfigured && p.requiresApiKey)}
                  className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                >
                  {isTesting ? 'Testing...' : t('providers.testConnection')}
                </button>

                {p.requiresApiKey && (
                  <button
                    onClick={() => {
                      setEditingProvider(p);
                      setApiKeyInput('');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>API Key</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {testResult && (
          <div className="p-3 rounded-lg bg-muted text-xs text-foreground font-mono">
            {testResult}
          </div>
        )}
      </div>

      {/* Glossary Manager */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookA className="w-4 h-4 text-primary" />
            <span>{t('providers.glossary')}</span>
          </h2>
          <button
            onClick={() => setShowAddGlossary(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('providers.addTerm')}</span>
          </button>
        </div>

        {glossary.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-card border border-border text-xs text-muted-foreground">
            No custom terms defined. Add domain-specific terms or company names for consistent translations.
          </div>
        ) : (
          <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border">
            {glossary.map((entry) => (
              <div
                key={entry.id}
                className="p-3 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">{entry.sourceTerm}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium text-primary">{entry.targetTerm}</span>
                  {entry.caseSensitive && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Case-sensitive
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteGlossary(entry.id)}
                  className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Key Modal */}
      {editingProvider && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Set API Key: {editingProvider.name}
              </h3>
              <button
                onClick={() => setEditingProvider(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Credentials are encrypted with your operating system keychain and never stored in plain text.
              </p>
              <input
                type="password"
                placeholder="Enter API key..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono text-[11px]"
              />
              {editingProvider.signupUrl && (
                <div className="pt-1">
                  <a
                    href={editingProvider.signupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 font-medium text-[11px]"
                  >
                    <span>Get a free API key here</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setEditingProvider(null)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveKey}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 shadow-sm"
              >
                Save Encrypted
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Glossary Modal */}
      {showAddGlossary && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {t('providers.addTerm')}
              </h3>
              <button
                onClick={() => setShowAddGlossary(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Source Term</label>
                <input
                  type="text"
                  placeholder="e.g. EchoLingo"
                  value={sourceTerm}
                  onChange={(e) => setSourceTerm(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground font-medium">Target Replacement Term</label>
                <input
                  type="text"
                  placeholder="e.g. EchoLingo App"
                  value={targetTerm}
                  onChange={(e) => setTargetTerm(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-foreground"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="caseSens"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                  className="rounded text-primary"
                />
                <label htmlFor="caseSens" className="text-foreground">
                  Match exact case
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setShowAddGlossary(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleAddGlossary}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
