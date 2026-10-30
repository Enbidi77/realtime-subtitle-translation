import React, { useState, useEffect, useCallback, useTransition } from "react";
import {
  OcrProviderCapability,
  OcrHistoryItem,
  ContinuousOcrStats,
  OcrProfile,
  OcrProviderId,
} from "@echo-lingo/contracts";
import {
  OCR_SUPPORTED_LANGUAGES,
  TARGET_LANGUAGES,
} from "@echo-lingo/config";
import { createRendererLogger } from "@echo-lingo/logger";
import { GlassButton, GlassSelect } from "@/components/ui/index.js";
import { useSettingsStore } from "@/stores/settings-store.js";
import { useI18n } from "@/app/i18n/index.js";
import {
  CaptureTab,
  ContinuousTab,
  HandwritingPad,
  HistoryTab,
} from "./components/index.js";
import { Crop, Info, PenTool } from "lucide-react";

const log = createRendererLogger("ScreenTranslationView");

export const ScreenTranslationView: React.FC = () => {
  const { t } = useI18n();
  const { settings, updateSettings } = useSettingsStore();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "capture" | "continuous" | "handwriting" | "history"
  >("capture");

  // OCR & Translation State
  const [ocrProviders, setOcrProviders] = useState<OcrProviderCapability[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<OcrProviderId>(
    settings.screenTranslation?.ocrProvider || "windows-native",
  );
  const [ocrLanguage, setOcrLanguage] = useState<string>(
    settings.screenTranslation?.ocrLanguage || "auto",
  );
  const [targetLanguage, setTargetLanguage] = useState<string>(
    settings.targetLanguages?.[0] || "vi",
  );
  const [profile, setProfile] = useState<OcrProfile>(
    settings.screenTranslation?.profile || "none",
  );
  const [skipPreview, setSkipPreview] = useState<boolean>(
    settings.screenTranslation?.skipPreview || false,
  );
  const [keepMainWindowHidden, setKeepMainWindowHidden] = useState<boolean>(
    settings.screenTranslation?.keepMainWindowHiddenAfterCapture || false,
  );

  // Sync state if settings update from external sources (e.g. Floating Panel or Settings View)
  useEffect(() => {
    if (
      settings.screenTranslation?.ocrLanguage &&
      settings.screenTranslation.ocrLanguage !== ocrLanguage
    ) {
      setOcrLanguage(settings.screenTranslation.ocrLanguage);
    }
  }, [settings.screenTranslation?.ocrLanguage]);

  useEffect(() => {
    if (
      settings.targetLanguages?.[0] &&
      settings.targetLanguages[0] !== targetLanguage
    ) {
      setTargetLanguage(settings.targetLanguages[0]);
    }
  }, [settings.targetLanguages]);

  useEffect(() => {
    if (
      settings.screenTranslation?.profile &&
      settings.screenTranslation.profile !== profile
    ) {
      setProfile(settings.screenTranslation.profile);
    }
  }, [settings.screenTranslation?.profile]);

  const handleOcrLanguageChange = (newLang: string) => {
    setOcrLanguage(newLang);
    updateSettings({
      screenTranslation: {
        ...settings.screenTranslation,
        ocrLanguage: newLang,
      },
    });
  };

  const handleTargetLanguageChange = (newTarget: string) => {
    setTargetLanguage(newTarget);
    updateSettings({
      targetLanguages: [newTarget],
    });
  };

  const handleProfileChange = (newProfile: OcrProfile) => {
    setProfile(newProfile);
    updateSettings({
      screenTranslation: {
        ...settings.screenTranslation,
        profile: newProfile,
      },
    });
  };

  useEffect(() => {
    if (
      settings.screenTranslation?.keepMainWindowHiddenAfterCapture !== undefined
    ) {
      setKeepMainWindowHidden(
        settings.screenTranslation.keepMainWindowHiddenAfterCapture,
      );
    }
  }, [settings.screenTranslation?.keepMainWindowHiddenAfterCapture]);

  // Results State
  const [isCapturing, setIsCapturing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [recognizedText, setRecognizedText] = useState<string>("");
  const [editedText, setEditedText] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [translatedText, setTranslatedText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Continuous Mode State
  const [continuousState, setContinuousState] = useState<string>("idle");
  const [continuousStats, setContinuousStats] = useState<ContinuousOcrStats>({
    state: "idle",
    capturedCount: 0,
    recognizedCount: 0,
    translatedCount: 0,
    skippedCount: 0,
    averageDurationMs: 0,
  });
  const [continuousRegion, setContinuousRegion] = useState<any | null>(null);
  const [continuousHistory, setContinuousHistory] = useState<OcrHistoryItem[]>(
    [],
  );
  const [intervalMs, setIntervalMs] = useState<number>(
    settings.screenTranslation?.continuousIntervalMs || 2000,
  );
  const [changeThreshold, setChangeThreshold] = useState<number>(
    settings.screenTranslation?.changeThreshold ?? 0.15,
  );

  // History State
  const [historyItems, setHistoryItems] = useState<OcrHistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [, startTransition] = useTransition();

  // Load OCR Providers and History on mount
  useEffect(() => {
    if (window.electronAPI?.screenTranslation) {
      window.electronAPI.screenTranslation
        .getOcrProviders()
        .then((providers) => {
          setOcrProviders(providers);
          if (
            providers.length > 0 &&
            !providers.some((p) => p.id === selectedProvider)
          ) {
            setSelectedProvider(providers[0].id);
          }
        })
        .catch((err) => log.error("Failed to get OCR providers", err));

      loadHistory();

      // Subscribe to continuous status & events
      const unsubStatus =
        window.electronAPI.screenTranslation.onContinuousStatus?.((data) => {
          setContinuousState(data.state);
          setContinuousStats(data.stats);
        });

      const unsubEvent =
        window.electronAPI.screenTranslation.onContinuousEvent?.((data) => {
          if (data.isChange && data.historyItem) {
            setContinuousHistory((prev) =>
              [data.historyItem, ...prev].slice(0, 30),
            );
          }
        });

      return () => {
        if (unsubStatus) unsubStatus();
        if (unsubEvent) unsubEvent();
      };
    }
  }, []);

  const loadHistory = useCallback(async (query?: string) => {
    if (window.electronAPI?.screenTranslation) {
      try {
        const items = await window.electronAPI.screenTranslation.getHistory(
          query ? { query, limit: 100 } : { limit: 100 },
        );
        startTransition(() => {
          setHistoryItems(items);
        });
      } catch (err) {
        log.error("Failed to load history", err);
      }
    }
  }, []);

  // Trigger Region Selection & Capture
  const handleStartCapture = async () => {
    setErrorMessage(null);
    setIsCapturing(true);

    try {
      if (!window.electronAPI?.screenTranslation) {
        throw new Error(
          t(
            "ocr.messages.bridgeUnavailable",
            "Screen translation bridge is not available",
          ),
        );
      }

      // Step 1: Open interactive transparent selection overlay
      const region = await window.electronAPI.screenTranslation.selectRegion();
      if (!region) {
        setIsCapturing(false);
        return; // User cancelled with Escape
      }

      // Step 2: Capture, OCR and translate
      setIsTranslating(true);
      const effectiveSource =
        ocrLanguage && ocrLanguage !== "auto" ? ocrLanguage : "auto";
      const res = await window.electronAPI.screenTranslation.translateRegion({
        region,
        ocrLanguage,
        targetLanguages: [targetLanguage],
        sourceLanguage: effectiveSource,
        ocrProviderId: selectedProvider,
        translationProviderId: settings.translationProvider || "google-web",
        profile,
        skipPreview,
        keepMainWindowHidden,
      });

      setRecognizedText(res.ocrResult.text);
      setEditedText(res.ocrResult.text);
      setConfidence(res.ocrResult.confidence);
      setDurationMs(
        res.translationResult.durationMs + res.ocrResult.durationMs,
      );
      setTranslatedText(res.translationResult.translatedText);

      // Reload history list
      loadHistory();
    } catch (err: any) {
      log.error("Capture failed", err);
      setErrorMessage(
        err.message || t("ocr.messages.captureFailed", "Capture failed"),
      );
    } finally {
      setIsCapturing(false);
      setIsTranslating(false);
    }
  };

  // Re-translate after user manual correction
  const handleRetranslate = async () => {
    if (!editedText.trim() || !window.electronAPI?.translation) return;

    setIsTranslating(true);
    setErrorMessage(null);

    try {
      const effectiveSource =
        ocrLanguage && ocrLanguage !== "auto" ? ocrLanguage : "auto";
      const res = await window.electronAPI.translation.translate({
        text: editedText.trim(),
        sourceLanguage: effectiveSource,
        targetLanguage,
        priority: "high",
      });
      setTranslatedText(res.translatedText);
      setDurationMs(res.durationMs);
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          t("ocr.messages.retranslateFailed", "Retranslation failed"),
      );
    } finally {
      setIsTranslating(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Continuous Mode Handlers
  const handleSelectContinuousRegion = async () => {
    try {
      const region = await window.electronAPI?.screenTranslation.selectRegion();
      if (region) {
        setContinuousRegion(region);
      }
    } catch (err) {
      log.error("Failed to select continuous region", err);
    }
  };

  const handleToggleContinuous = async () => {
    if (!continuousRegion) {
      setErrorMessage(
        t(
          "ocr.messages.selectRegionFirst",
          "Please select a screen region first.",
        ),
      );
      return;
    }

    if (
      continuousState === "capturing" ||
      continuousState === "recognizing" ||
      continuousState === "translating"
    ) {
      await window.electronAPI?.screenTranslation.stopContinuous();
    } else {
      setErrorMessage(null);
      const effectiveSource =
        ocrLanguage && ocrLanguage !== "auto" ? ocrLanguage : "auto";
      await window.electronAPI?.screenTranslation.startContinuous({
        region: continuousRegion,
        intervalMs,
        changeThreshold,
        ignoreUnchanged: true,
        translateOnlyDiff: false,
        ocrProviderId: selectedProvider,
        ocrLanguage,
        translationProviderId: settings.translationProvider || "google-web",
        sourceLanguage: effectiveSource,
        targetLanguages: [targetLanguage],
        profile,
      });
    }
  };

  const handlePauseResumeContinuous = async () => {
    if (continuousState === "paused") {
      await window.electronAPI?.screenTranslation.resumeContinuous();
    } else {
      await window.electronAPI?.screenTranslation.pauseContinuous();
    }
  };

  // History Actions
  const handleDeleteHistoryItem = async (id: string) => {
    await window.electronAPI?.screenTranslation.deleteHistoryItem(id);
    loadHistory(historySearch);
  };

  const handleClearHistory = async () => {
    if (
      confirm(
        t(
          "ocr.history.clearConfirm",
          "Are you sure you want to clear all OCR translation history?",
        ),
      )
    ) {
      await window.electronAPI?.screenTranslation.clearHistory();
      setHistoryItems([]);
    }
  };

  const handleExportHistory = (format: "txt" | "json") => {
    if (historyItems.length === 0) return;

    let content = "";
    let mime = "text/plain";
    let ext = "txt";

    if (format === "json") {
      content = JSON.stringify(historyItems, null, 2);
      mime = "application/json";
      ext = "json";
    } else {
      content = historyItems
        .map(
          (h) =>
            `[${new Date(h.createdAt).toLocaleString()}] (${h.sourceLanguage} -> ${h.targetLanguage})\nOriginal: ${h.originalText}\nTranslated: ${h.translatedText}\n`,
        )
        .join("\n---\n\n");
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echolingo_ocr_history_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 space-y-5">
      {/* 1. Feature Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-primary border border-primary/20">
              <Crop className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t("ocr.title", "On-Screen OCR & Real-Time Translation")}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              "ocr.subtitle",
              "Capture dialogue from video games, stream subtitles, documents, or apps and translate in place.",
            )}
          </p>
        </div>

        {/* Global Shortcut Hint & Quick Trigger */}
        <div className="flex items-center gap-2.5">
          <GlassButton
            variant="primary"
            size="md"
            icon={<Crop className="w-4 h-4" />}
            isLoading={isCapturing || isTranslating}
            onClick={handleStartCapture}
            className="shadow-lg shadow-primary/20"
          >
            <span>{t("ocr.captureRegion", "Capture Region")}</span>
            <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-white/20 rounded text-white border border-white/30">
              Ctrl+Shift+T
            </kbd>
          </GlassButton>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-glass-border pb-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("capture")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              activeTab === "capture"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-glass-subtle border border-transparent"
            }`}
          >
            {t("ocr.tabs.capture", "One-Time Capture")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("continuous")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === "continuous"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-glass-subtle border border-transparent"
            }`}
          >
            <span>{t("ocr.tabs.continuous", "Continuous Monitoring")}</span>
            {continuousState !== "idle" && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("handwriting")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === "handwriting"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-glass-subtle border border-transparent"
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>{t("ocr.tabs.handwriting", "Handwriting Pad")}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              loadHistory(historySearch);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === "history"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-glass-subtle border border-transparent"
            }`}
          >
            <span>{t("ocr.tabs.history", "History")}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-glass-subtle border border-glass-border">
              {historyItems.length}
            </span>
          </button>
        </div>

        {/* Engine and Languages Pills */}
        <div className="hidden lg:flex items-center gap-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("ocr.engineLabel", "Engine:")}
            </span>
            <GlassSelect
              size="xs"
              containerClassName="w-auto"
              className="min-w-[155px]"
              value={selectedProvider}
              onChange={(e) =>
                setSelectedProvider(e.target.value as OcrProviderId)
              }
            >
              {ocrProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </GlassSelect>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("ocr.ocrLangLabel", "OCR Lang:")}
            </span>
            <GlassSelect
              size="xs"
              containerClassName="w-auto"
              className="min-w-[135px]"
              value={ocrLanguage}
              onChange={(e) => handleOcrLanguageChange(e.target.value)}
            >
              {OCR_SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}{" "}
                  {l.nativeName && l.nativeName !== l.name
                    ? `(${l.nativeName})`
                    : ""}
                </option>
              ))}
            </GlassSelect>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("ocr.targetLabel", "Target:")}
            </span>
            <GlassSelect
              size="xs"
              containerClassName="w-auto"
              className="min-w-[110px]"
              value={targetLanguage}
              onChange={(e) => handleTargetLanguageChange(e.target.value)}
            >
              {TARGET_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} {l.nativeName ? `(${l.nativeName})` : ""}
                </option>
              ))}
            </GlassSelect>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="hover:underline text-[11px]"
          >
            {t("ocr.messages.dismiss", "Dismiss")}
          </button>
        </div>
      )}

      {/* 3. Tab Contents */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* ================= TAB 1: ONE-TIME CAPTURE ================= */}
        {activeTab === "capture" && (
          <CaptureTab
            profile={profile}
            onProfileChange={handleProfileChange}
            ocrLanguage={ocrLanguage}
            onOcrLanguageChange={handleOcrLanguageChange}
            targetLanguage={targetLanguage}
            onTargetLanguageChange={handleTargetLanguageChange}
            skipPreview={skipPreview}
            onSkipPreviewChange={setSkipPreview}
            keepMainWindowHidden={keepMainWindowHidden}
            onKeepMainWindowHiddenChange={(val) => {
              setKeepMainWindowHidden(val);
              updateSettings({
                screenTranslation: {
                  ...settings.screenTranslation,
                  keepMainWindowHiddenAfterCapture: val,
                },
              });
            }}
            recognizedText={recognizedText}
            editedText={editedText}
            onEditedTextChange={setEditedText}
            confidence={confidence}
            durationMs={durationMs}
            translatedText={translatedText}
            isTranslating={isTranslating}
            onRetranslate={handleRetranslate}
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />
        )}

        {/* ================= TAB 2: CONTINUOUS MONITORING ================= */}
        {activeTab === "continuous" && (
          <ContinuousTab
            continuousRegion={continuousRegion}
            continuousState={continuousState}
            continuousStats={continuousStats}
            continuousHistory={continuousHistory}
            intervalMs={intervalMs}
            onIntervalMsChange={setIntervalMs}
            changeThreshold={changeThreshold}
            onChangeThresholdChange={setChangeThreshold}
            onSelectRegion={handleSelectContinuousRegion}
            onToggleContinuous={handleToggleContinuous}
            onPauseResumeContinuous={handlePauseResumeContinuous}
          />
        )}

        {/* ================= TAB 3: HANDWRITING RECOGNITION ================= */}
        {activeTab === "handwriting" && (
          <HandwritingPad
            ocrProviders={ocrProviders}
            ocrLanguage={ocrLanguage}
            onOcrLanguageChange={handleOcrLanguageChange}
            targetLanguage={targetLanguage}
            onTargetLanguageChange={handleTargetLanguageChange}
            selectedProvider={selectedProvider}
            onProviderChange={(p) => setSelectedProvider(p)}
            onSavedToHistory={() => loadHistory(historySearch)}
          />
        )}

        {/* ================= TAB 4: HISTORY ================= */}
        {activeTab === "history" && (
          <HistoryTab
            historyItems={historyItems}
            historySearch={historySearch}
            onSearchChange={(query) => {
              setHistorySearch(query);
              loadHistory(query);
            }}
            onClearHistory={handleClearHistory}
            onExportHistory={handleExportHistory}
            onDeleteItem={handleDeleteHistoryItem}
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />
        )}
      </div>
    </div>
  );
};
