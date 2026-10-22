import React, { useEffect, useState } from "react";
import {
  TranslationCapability,
  SpeechModelStatus,
  GlossaryEntry,
} from "@echo-lingo/contracts";
import {
  isPaidSpeechEngine,
  isPaidTranslationProvider,
} from "@echo-lingo/config";
import { useI18n } from "@/app/i18n/index.js";
import { useSettingsStore } from "@/stores/settings-store.js";
import { GlassCard } from "@/components/ui/GlassCard.js";
import { GlassButton } from "@/components/ui/GlassButton.js";
import { GlassInput } from "@/components/ui/GlassInput.js";
import { GlassBadge } from "@/components/ui/GlassBadge.js";
import { GlassModal } from "@/components/ui/GlassModal.js";
import { createRendererLogger } from "@echo-lingo/logger";
import {
  Cpu,
  Globe,
  Key,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  BookA,
  Check,
  ExternalLink,
  Sparkles,
  Download,
  HardDrive,
} from "lucide-react";

interface ConfigurableProvider {
  id: string;
  name: string;
  description: string;
  isConfigured: boolean;
  requiresApiKey: boolean;
  isLocal: boolean;
  isPaid?: boolean;
  signupUrl?: string;
}

const log = createRendererLogger("ProvidersView");

export const ProvidersView: React.FC = () => {
  const { t } = useI18n();
  const speechEngine = useSettingsStore((s) => s.settings.speechEngine);
  const localWhisperModel = useSettingsStore(
    (s) => s.settings.localWhisperModel || "tiny",
  );
  const showPaidProviders = useSettingsStore(
    (s) => s.settings.showPaidProviders ?? false,
  );
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const [models, setModels] = useState<SpeechModelStatus[]>([]);
  const [providers, setProviders] = useState<TranslationCapability[]>([]);
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);

  // Speech engine providers with credential states
  const [speechEngines, setSpeechEngines] = useState<ConfigurableProvider[]>([
    {
      id: "groq-whisper",
      name: "Groq Cloud Whisper (Ultra-Fast & Free)",
      description:
        "Ultra-fast (<300ms) transcription powered by whisper-large-v3-turbo. Free tier includes 14,400 audio seconds per day.",
      requiresApiKey: true,
      isConfigured: false,
      isLocal: false,
      isPaid: false,
      signupUrl: "https://console.groq.com/keys",
    },
    {
      id: "openai-whisper",
      name: "OpenAI Whisper Cloud",
      description:
        "Official OpenAI whisper-1 cloud transcription with high punctuation and multi-lingual grammar accuracy.",
      requiresApiKey: true,
      isConfigured: false,
      isLocal: false,
      isPaid: true,
      signupUrl: "https://platform.openai.com/api-keys",
    },
    {
      id: "mock",
      name: "Mock Speech Engine (Instant Test & Demo)",
      description:
        "Simulates live speech subtitles on audio energy detection. Zero API key needed, ideal for testing the pipeline over YouTube.",
      requiresApiKey: false,
      isConfigured: true,
      isLocal: true,
      isPaid: false,
    },
    {
      id: "windows-speech",
      name: "Windows System Speech (SAPI)",
      description:
        "Native Windows built-in speech recognition (SAPI 5.4 / System.Speech). 100% offline, zero setup or downloads required.",
      requiresApiKey: false,
      isConfigured: true,
      isLocal: true,
      isPaid: false,
    },
    {
      id: "whisper-local",
      name: "Local Whisper Engine",
      description:
        "Offline speech inference using managed local worker or whisper.cpp.",
      requiresApiKey: false,
      isConfigured: true,
      isLocal: true,
      isPaid: false,
    },
  ]);

  // Key config modal
  const [editingProvider, setEditingProvider] = useState<{
    id: string;
    name: string;
    signupUrl?: string;
  } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // New glossary entry modal
  const [showAddGlossary, setShowAddGlossary] = useState(false);
  const [sourceTerm, setSourceTerm] = useState("");
  const [targetTerm, setTargetTerm] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);

  const loadData = async () => {
    if (!window.electronAPI) return;
    try {
      const [m, p, g, hasGroq, hasOpenAI] = await Promise.all([
        window.electronAPI.speech.getModels(),
        window.electronAPI.translation.getProviders(),
        window.electronAPI.glossary.list(),
        window.electronAPI.translation.hasCredential("groq-whisper"),
        window.electronAPI.translation.hasCredential("openai-whisper"),
      ]);
      setModels(m);
      setProviders(p);
      setGlossary(g);
      setSpeechEngines((prev) =>
        prev.map((eng) => {
          if (eng.id === "groq-whisper")
            return { ...eng, isConfigured: Boolean(hasGroq) };
          if (eng.id === "openai-whisper")
            return { ...eng, isConfigured: Boolean(hasOpenAI) };
          return eng;
        }),
      );
    } catch (e) {
      log.error("Failed to load provider data", e);
    }
  };

  useEffect(() => {
    loadData();

    if (window.electronAPI?.speech?.onModelProgress) {
      const unsub = window.electronAPI.speech.onModelProgress((status) => {
        setModels((prev) =>
          prev.map((m) => (m.id === status.id ? { ...m, ...status } : m)),
        );
      });
      return () => {
        unsub();
      };
    }
  }, []);

  const handleDownloadModel = async (modelId: string) => {
    if (!window.electronAPI?.speech?.downloadModel) return;
    try {
      setModels((prev) =>
        prev.map((m) =>
          m.id === modelId
            ? { ...m, isInstalled: false, downloadProgress: 1 }
            : m,
        ),
      );
      await window.electronAPI.speech.downloadModel(modelId);
      await loadData();
    } catch (err) {
      log.error("Failed to download model", err);
      await loadData();
    }
  };

  const handleSaveKey = async () => {
    if (!editingProvider || !window.electronAPI) return;
    try {
      await window.electronAPI.translation.setCredential(
        editingProvider.id,
        apiKeyInput,
      );
      if (
        editingProvider.id === "groq-whisper" ||
        editingProvider.id === "openai-whisper"
      ) {
        await updateSettings({ speechEngine: editingProvider.id as any });
      }
      setApiKeyInput("");
      setEditingProvider(null);
      await loadData();
    } catch (e) {
      log.error("Failed to save credential", e);
    }
  };

  const handleTestConnection = async (provider: TranslationCapability) => {
    if (!window.electronAPI) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await window.electronAPI.translation.translate({
        text: "Hello, welcome to EchoLingo!",
        sourceLanguage: "en",
        targetLanguage: "vi",
        priority: "high",
      });
      setTestResult(`Success: "${res.translatedText}" (${res.durationMs}ms)`);
    } catch (err) {
      setTestResult(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddGlossary = async () => {
    if (!sourceTerm.trim() || !targetTerm.trim() || !window.electronAPI) return;
    const entry: GlossaryEntry = {
      id: "gl_" + Date.now(),
      sourceTerm: sourceTerm.trim(),
      targetTerm: targetTerm.trim(),
      sourceLanguage: "auto",
      targetLanguage: "vi",
      caseSensitive,
      createdAt: Date.now(),
    };
    await window.electronAPI.glossary.add(entry);
    setSourceTerm("");
    setTargetTerm("");
    setShowAddGlossary(false);
    await loadData();
  };

  const handleDeleteGlossary = async (id: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.glossary.delete(id);
    await loadData();
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary" />
          <span>{t("providers.title")}</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("providers.subtitle")}
        </p>
      </div>

      {/* Speech Recognition Engines */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          <span>Speech Recognition Engines</span>
        </h2>

        <div className="space-y-2.5">
          {speechEngines
            .filter(
              (eng) =>
                showPaidProviders ||
                (!eng.isPaid && !isPaidSpeechEngine(eng.id)),
            )
            .map((eng) => {
              const isPaid = eng.isPaid || isPaidSpeechEngine(eng.id);
              return (
                <GlassCard
                  key={eng.id}
                  variant="default"
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-semibold text-xs text-foreground">
                        {eng.name}
                      </span>
                      {speechEngine === eng.id && (
                        <GlassBadge variant="accent" className="font-semibold">
                          <Check className="w-3 h-3" />
                          ACTIVE
                        </GlassBadge>
                      )}
                      {eng.isConfigured ? (
                        <GlassBadge variant="success">
                          <CheckCircle2 className="w-3 h-3" />
                          {t("providers.configured")}
                        </GlassBadge>
                      ) : (
                        <GlassBadge variant="warning">
                          <AlertCircle className="w-3 h-3" />
                          {t("providers.notConfigured")}
                        </GlassBadge>
                      )}
                      {isPaid ? (
                        <GlassBadge variant="warning">
                          {t("providers.paid", "Paid API")}
                        </GlassBadge>
                      ) : (
                        <GlassBadge variant="neutral">
                          {t("providers.free", "Free")}
                        </GlassBadge>
                      )}
                      {eng.isLocal && (
                        <GlassBadge variant="neutral">Local</GlassBadge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {eng.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {speechEngine !== eng.id &&
                      (eng.isConfigured || !eng.requiresApiKey) && (
                        <GlassButton
                          variant="glass"
                          size="sm"
                          onClick={() =>
                            updateSettings({ speechEngine: eng.id as any })
                          }
                        >
                          Activate
                        </GlassButton>
                      )}

                    {eng.signupUrl && (
                      <a
                        href={eng.signupUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-glass-border bg-glass-subtle text-xs text-primary hover:bg-glass hover:border-glass-border-elevated transition-colors"
                      >
                        <span>Get Key</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {eng.requiresApiKey && (
                      <GlassButton
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setEditingProvider(eng);
                          setApiKeyInput("");
                        }}
                        icon={<Key className="w-3.5 h-3.5" />}
                      >
                        <span>API Key</span>
                      </GlassButton>
                    )}
                  </div>
                </GlassCard>
              );
            })}
        </div>
      </div>

      {/* Offline Speech Models (Local Whisper) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" />
            <span>Offline Speech Models (whisper.cpp)</span>
          </h2>
          <GlassBadge variant="neutral" className="text-[10px]">
            100% Offline • On-Device Neural
          </GlassBadge>
        </div>

        <div className="space-y-2.5">
          {models.map((m) => {
            const isDownloading =
              !m.isInstalled &&
              (m.downloadProgress ?? 0) > 0 &&
              (m.downloadProgress ?? 0) < 100;
            const isSelected = localWhisperModel === m.id;
            const mbSize = m.sizeBytes
              ? `${Math.round(m.sizeBytes / (1024 * 1024))} MB`
              : "";

            return (
              <GlassCard
                key={m.id}
                variant={isSelected ? "elevated" : "default"}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  isSelected ? "border-primary/40 shadow-sm" : ""
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-semibold text-xs text-foreground">
                      {m.name}
                    </span>
                    {mbSize && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        ({mbSize})
                      </span>
                    )}
                    {isSelected && (
                      <GlassBadge variant="accent" className="font-semibold">
                        <Check className="w-3 h-3" />
                        SELECTED
                      </GlassBadge>
                    )}
                    {m.isInstalled ? (
                      <GlassBadge variant="success">
                        <CheckCircle2 className="w-3 h-3" />
                        INSTALLED
                      </GlassBadge>
                    ) : isDownloading ? (
                      <GlassBadge variant="neutral" pulse>
                        Downloading {m.downloadProgress}%
                      </GlassBadge>
                    ) : (
                      <GlassBadge variant="neutral">Not Downloaded</GlassBadge>
                    )}
                  </div>
                  {m.error && (
                    <p className="text-xs text-destructive">{m.error}</p>
                  )}
                  {isDownloading && (
                    <div className="w-full bg-glass-subtle rounded-full h-1.5 mt-2 overflow-hidden border border-glass-border">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${m.downloadProgress}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {m.isInstalled ? (
                    !isSelected && (
                      <GlassButton
                        variant="glass"
                        size="sm"
                        onClick={() => {
                          updateSettings({ localWhisperModel: m.id as any });
                        }}
                      >
                        Use Model
                      </GlassButton>
                    )
                  ) : (
                    <GlassButton
                      variant="primary"
                      size="sm"
                      disabled={isDownloading}
                      onClick={() => handleDownloadModel(m.id)}
                      icon={<Download className="w-3.5 h-3.5" />}
                    >
                      <span>
                        {isDownloading ? `${m.downloadProgress}%` : "Download"}
                      </span>
                    </GlassButton>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Translation Providers */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <span>{t("providers.translationProviders")}</span>
        </h2>

        <div className="space-y-2.5">
          {providers
            .filter(
              (p) =>
                showPaidProviders ||
                (!p.isPaid && !isPaidTranslationProvider(p.id)),
            )
            .map((p) => {
              const isPaid = p.isPaid || isPaidTranslationProvider(p.id);
              return (
                <GlassCard
                  key={p.id}
                  variant="default"
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-semibold text-xs text-foreground">
                        {p.name}
                      </span>
                      {p.isConfigured ? (
                        <GlassBadge variant="success">
                          <CheckCircle2 className="w-3 h-3" />
                          {t("providers.configured")}
                        </GlassBadge>
                      ) : (
                        <GlassBadge variant="warning">
                          <AlertCircle className="w-3 h-3" />
                          {t("providers.notConfigured")}
                        </GlassBadge>
                      )}
                      {isPaid ? (
                        <GlassBadge variant="warning">
                          {t("providers.paid", "Paid API")}
                        </GlassBadge>
                      ) : (
                        <GlassBadge variant="neutral">
                          {t("providers.free", "Free")}
                        </GlassBadge>
                      )}
                      {p.isLocal && (
                        <GlassBadge variant="neutral">Local</GlassBadge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <GlassButton
                      variant="glass"
                      size="sm"
                      onClick={() => handleTestConnection(p)}
                      disabled={
                        isTesting || (!p.isConfigured && p.requiresApiKey)
                      }
                    >
                      {isTesting ? "Testing..." : t("providers.testConnection")}
                    </GlassButton>

                    {p.requiresApiKey && (
                      <GlassButton
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setEditingProvider(p);
                          setApiKeyInput("");
                        }}
                        icon={<Key className="w-3.5 h-3.5" />}
                      >
                        <span>API Key</span>
                      </GlassButton>
                    )}
                  </div>
                </GlassCard>
              );
            })}
        </div>

        {testResult && (
          <GlassCard
            variant="subtle"
            className="p-3 text-xs text-foreground font-mono"
          >
            {testResult}
          </GlassCard>
        )}
      </div>

      {/* Glossary Manager */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookA className="w-4 h-4 text-primary" />
            <span>{t("providers.glossary")}</span>
          </h2>
          <GlassButton
            variant="glass"
            size="sm"
            onClick={() => setShowAddGlossary(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            <span>{t("providers.addTerm")}</span>
          </GlassButton>
        </div>

        {glossary.length === 0 ? (
          <GlassCard className="p-6 text-center text-xs text-muted-foreground">
            No custom terms defined. Add domain-specific terms or company names
            for consistent translations.
          </GlassCard>
        ) : (
          <div className="space-y-1.5">
            {glossary.map((entry) => (
              <GlassCard
                key={entry.id}
                variant="default"
                className="p-3 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">
                    {entry.sourceTerm}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium text-primary">
                    {entry.targetTerm}
                  </span>
                  {entry.caseSensitive && (
                    <GlassBadge variant="neutral" className="text-[10px]">
                      Case-sensitive
                    </GlassBadge>
                  )}
                </div>
                <GlassButton
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDeleteGlossary(entry.id)}
                  title="Delete term"
                  aria-label="Delete term"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </GlassButton>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* API Key Modal */}
      <GlassModal
        isOpen={!!editingProvider}
        onClose={() => setEditingProvider(null)}
        title={`Configure ${editingProvider?.name}`}
        description="Enter your API credentials. Encrypted safely in local system storage."
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">
              API Key / Token
            </label>
            <GlassInput
              type="password"
              placeholder="Paste your API key here..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              autoFocus
            />
          </div>

          {editingProvider?.signupUrl && (
            <p className="text-[11px] text-muted-foreground">
              Don't have a key?{" "}
              <a
                href={editingProvider.signupUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
              >
                Get one here <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-glass-border">
            <GlassButton
              variant="subtle"
              size="sm"
              onClick={() => setEditingProvider(null)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={handleSaveKey}
              disabled={!apiKeyInput.trim()}
            >
              Save Key
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Add Glossary Modal */}
      <GlassModal
        isOpen={showAddGlossary}
        onClose={() => setShowAddGlossary(false)}
        title="Add Custom Glossary Term"
        description="Define preferred translations for product names, jargon, or brand terms."
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">
              Source Term (Original)
            </label>
            <GlassInput
              placeholder="e.g. EchoLingo, Kubernetes"
              value={sourceTerm}
              onChange={(e) => setSourceTerm(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-foreground font-medium">
              Target Term (Replacement)
            </label>
            <GlassInput
              placeholder="e.g. EchoLingo, Kubernetes"
              value={targetTerm}
              onChange={(e) => setTargetTerm(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="rounded accent-primary"
            />
            <span className="text-foreground">Case sensitive match</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-glass-border">
            <GlassButton
              variant="subtle"
              size="sm"
              onClick={() => setShowAddGlossary(false)}
            >
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={handleAddGlossary}
              disabled={!sourceTerm.trim() || !targetTerm.trim()}
            >
              Add Term
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};
