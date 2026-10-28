import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "@/styles/globals.css";
import { AppSettings, FloatingPanelPayload } from "@echo-lingo/contracts";
import { OCR_SUPPORTED_LANGUAGES, TARGET_LANGUAGES } from "@echo-lingo/config";
import { applyTheme } from "@/stores/settings-store.js";
import { GlassButton } from "@/components/ui/GlassButton.js";
import { GlassSelect } from "@/components/ui/GlassSelect.js";
import { createRendererLogger } from "@echo-lingo/logger";
import { getDictionary } from "@/app/i18n/index.js";
import {
  GripHorizontal,
  X,
  Copy,
  Check,
  Crop,
  Clock,
} from "lucide-react";

const log = createRendererLogger("OcrPanel");

const FloatingResultPanel: React.FC = () => {
  const [data, setData] = useState<FloatingPanelPayload | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [locale, setLocale] = useState<string>("en");
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const dict = getDictionary(locale);

  useEffect(() => {
    // Sync theme, glass intensity, and locale from settings
    if (window.electronAPI?.settings) {
      window.electronAPI.settings
        .get()
        .then((loaded) => {
          setAppSettings(loaded);
          applyTheme(loaded.theme, loaded.glassIntensity);
          if (loaded.locale) setLocale(loaded.locale);
        })
        .catch((err) => log.error("Failed to load settings:", err));

      const unsubSettings = window.electronAPI.settings.onUpdate?.(
        (updated) => {
          setAppSettings(updated);
          applyTheme(updated.theme, updated.glassIntensity);
          if (updated.locale) setLocale(updated.locale);
        },
      );

      return () => {
        if (unsubSettings) unsubSettings();
      };
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.screenTranslation?.onFloatingPanelData) {
      const unsub = window.electronAPI.screenTranslation.onFloatingPanelData(
        (payload) => {
          setData(payload);
        },
      );
      return () => {
        if (unsub) unsub();
      };
    }
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleClose = () => {
    window.electronAPI?.screenTranslation?.hideFloatingPanel();
  };

  const handleSourceChange = async (newSource: string) => {
    if (!data) return;
    const updated = { ...data, sourceLanguage: newSource };
    setData(updated);

    if (window.electronAPI?.settings?.update) {
      await window.electronAPI.settings.update({
        screenTranslation: {
          ...appSettings?.screenTranslation,
          ocrLanguage: newSource,
        } as any,
      });
    }

    if (data.originalText && window.electronAPI?.translation?.translate) {
      try {
        const res = await window.electronAPI.translation.translate({
          text: data.originalText,
          sourceLanguage: newSource,
          targetLanguage: data.targetLanguage || "vi",
          priority: "high",
        });
        setData((prev) =>
          prev
            ? {
                ...prev,
                translatedText: res.translatedText,
                sourceLanguage: newSource,
                durationMs: res.durationMs,
              }
            : null,
        );
      } catch (err) {
        log.error("Failed to re-translate on source change:", err);
      }
    }
  };

  const handleTargetChange = async (newTarget: string) => {
    if (!data) return;
    const updated = { ...data, targetLanguage: newTarget };
    setData(updated);

    if (window.electronAPI?.settings?.update) {
      await window.electronAPI.settings.update({
        targetLanguages: [newTarget],
      });
    }

    if (data.originalText && window.electronAPI?.translation?.translate) {
      try {
        const res = await window.electronAPI.translation.translate({
          text: data.originalText,
          sourceLanguage: data.sourceLanguage || "auto",
          targetLanguage: newTarget,
          priority: "high",
        });
        setData((prev) =>
          prev
            ? {
                ...prev,
                translatedText: res.translatedText,
                targetLanguage: newTarget,
                durationMs: res.durationMs,
              }
            : null,
        );
      } catch (err) {
        log.error("Failed to re-translate on target change:", err);
      }
    }
  };

  const handleCaptureAnother = async () => {
    try {
      const region =
        await window.electronAPI?.screenTranslation?.selectRegion();
      if (region) {
        const effectiveOcrLang =
          data?.sourceLanguage && data.sourceLanguage !== "auto"
            ? data.sourceLanguage
            : appSettings?.screenTranslation?.ocrLanguage || "auto";
        const effectiveTargetLang =
          data?.targetLanguage || appSettings?.targetLanguages?.[0] || "vi";

        await window.electronAPI?.screenTranslation?.translateRegion({
          region,
          ocrLanguage: effectiveOcrLang,
          targetLanguages: [effectiveTargetLang],
          sourceLanguage: effectiveOcrLang,
          profile: appSettings?.screenTranslation?.profile || "general",
          skipPreview: true,
        });
      }
    } catch (err) {
      log.error("Failed to capture another region:", err);
    }
  };

  const handleStartDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, [role="button"]')) return;

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (moveEvt.movementX !== 0 || moveEvt.movementY !== 0) {
        window.electronAPI?.app.moveWindow(
          moveEvt.movementX,
          moveEvt.movementY,
        );
      }
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleStartResize = (
    e: React.MouseEvent,
    direction: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw",
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (moveEvt.movementX !== 0 || moveEvt.movementY !== 0) {
        window.electronAPI?.app.resizeWindow({
          deltaX: moveEvt.movementX,
          deltaY: moveEvt.movementY,
          direction,
        });
      }
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const renderResizeHandles = () => (
    <>
      {/* 4 Edge Resize Hitboxes */}
      <div
        onMouseDown={(e) => handleStartResize(e, "n")}
        className="absolute top-0 left-3 right-3 h-2 cursor-n-resize z-40 select-none"
      />
      <div
        onMouseDown={(e) => handleStartResize(e, "s")}
        className="absolute bottom-0 left-3 right-3 h-2 cursor-s-resize z-40 select-none"
      />
      <div
        onMouseDown={(e) => handleStartResize(e, "w")}
        className="absolute left-0 top-3 bottom-3 w-2 cursor-w-resize z-40 select-none"
      />
      <div
        onMouseDown={(e) => handleStartResize(e, "e")}
        className="absolute right-0 top-3 bottom-3 w-2 cursor-e-resize z-40 select-none"
      />

      {/* 4 Corner Resize Hitboxes */}
      <div
        onMouseDown={(e) => handleStartResize(e, "nw")}
        className="absolute top-0 left-0 w-3.5 h-3.5 cursor-nw-resize z-50 select-none"
      />
      <div
        onMouseDown={(e) => handleStartResize(e, "ne")}
        className="absolute top-0 right-0 w-3.5 h-3.5 cursor-ne-resize z-50 select-none"
      />
      <div
        onMouseDown={(e) => handleStartResize(e, "sw")}
        className="absolute bottom-0 left-0 w-3.5 h-3.5 cursor-sw-resize z-50 select-none"
      />
      <div
        onMouseDown={(e) => handleStartResize(e, "se")}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50 select-none"
      />
    </>
  );

  const renderResizeGrip = () => (
    <div
      onMouseDown={(e) => handleStartResize(e, "se")}
      className="absolute bottom-1 right-1 w-3.5 h-3.5 flex items-end justify-end cursor-se-resize text-muted-foreground/40 hover:text-foreground transition-colors p-0.5 z-40 select-none"
      title={locale === "vi" ? "Kéo để đổi kích thước" : "Drag to resize"}
    >
      <svg
        viewBox="0 0 10 10"
        className="w-2.5 h-2.5 stroke-current stroke-[1.4] stroke-linecap-round fill-none"
      >
        <line x1="8" y1="2" x2="2" y2="8" />
        <line x1="8" y1="5" x2="5" y2="8" />
        <line x1="8" y1="8" x2="8" y2="8" />
      </svg>
    </div>
  );

  if (!data) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center p-4 rounded-2xl overflow-hidden border border-glass-border-elevated bg-[var(--glass-surface-elevated)] shadow-[inset_0_1px_1.5px_0_var(--glass-highlight)] text-xs text-muted-foreground gap-2.5 relative select-none ${
          isResizing ? "pointer-events-none select-none" : ""
        }`}
      >
        <div
          onMouseDown={handleStartDrag}
          className="absolute inset-0 cursor-move"
        />
        <div className="flex items-center gap-2 pointer-events-none z-10">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
          <span className="font-semibold text-foreground">EchoLingo OCR</span>
        </div>
        <span className="text-[11px] text-muted-foreground pointer-events-none z-10">
          {dict.ocr?.floatingPanel?.waiting || "Waiting for translation result..."}
        </span>

        {renderResizeHandles()}
        {renderResizeGrip()}
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col rounded-2xl overflow-hidden border border-glass-border-elevated bg-[var(--glass-surface-elevated)] shadow-[inset_0_1px_1.5px_0_var(--glass-highlight)] text-foreground select-none relative ${
        isResizing ? "pointer-events-none select-none" : ""
      }`}
    >
      {/* Decorative ambient specular highlight in corner */}
      <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-primary/20 via-indigo-500/10 to-transparent rounded-full blur-xl pointer-events-none" />

      {/* Draggable Title Header */}
      <div
        onMouseDown={handleStartDrag}
        className="flex items-center justify-between px-3.5 py-2 border-b border-glass-border bg-glass-surface-toolbar backdrop-blur-md cursor-move shrink-0 z-10"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/70 pointer-events-none" />
          <div className="flex items-center gap-1.5 app-no-drag pointer-events-auto">
            <GlassSelect
              size="xs"
              containerClassName="w-auto"
              className="min-w-[130px] max-w-[160px]"
              value={data.sourceLanguage || "auto"}
              onChange={(e) => handleSourceChange(e.target.value)}
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

            <span className="text-muted-foreground/50 text-[11px] pointer-events-none">→</span>

            <GlassSelect
              size="xs"
              containerClassName="w-auto"
              className="min-w-[110px] max-w-[145px]"
              value={data.targetLanguage || "vi"}
              onChange={(e) => handleTargetChange(e.target.value)}
            >
              {TARGET_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}{" "}
                  {l.nativeName && l.nativeName !== l.name
                    ? `(${l.nativeName})`
                    : ""}
                </option>
              ))}
            </GlassSelect>
          </div>
          {(data.durationMs ?? 0) > 0 && (
            <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-mono pointer-events-none">
              <Clock className="w-2.5 h-2.5" />
              {data.durationMs}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-glass hover:text-foreground text-muted-foreground cursor-pointer transition-colors border border-transparent hover:border-glass-border"
            title={dict.ocr?.floatingPanel?.dismiss || "Dismiss Panel"}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 select-text app-no-drag z-10">
        {/* Original Recognized Text */}
        {data.originalText && (
          <div className="text-[11px] font-mono text-muted-foreground/90 bg-glass-subtle p-2.5 rounded-xl border border-glass-border/50 whitespace-pre-wrap leading-relaxed max-h-[35%] overflow-y-auto backdrop-blur-sm">
            {data.originalText}
          </div>
        )}

        {/* Translation Output */}
        <div className="text-sm font-semibold text-foreground leading-relaxed whitespace-pre-wrap selection:bg-primary/25">
          {data.translatedText}
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="app-no-drag px-3 py-2 border-t border-glass-border bg-glass-surface-toolbar/80 backdrop-blur-md flex items-center justify-between text-xs shrink-0 z-10 pr-6">
        <div className="flex items-center gap-1.5">
          <GlassButton
            size="xs"
            variant="glass"
            onClick={() => handleCopy(data.translatedText, "trans")}
            icon={
              copiedKey === "trans" ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )
            }
          >
            <span>
              {copiedKey === "trans"
                ? dict.ocr?.floatingPanel?.copied || "Copied"
                : dict.common?.copy || "Copy"}
            </span>
          </GlassButton>

          <GlassButton
            size="xs"
            variant="subtle"
            onClick={() =>
              handleCopy(
                `${data.originalText}\n\n${data.translatedText}`,
                "both",
              )
            }
          >
            <span>
              {copiedKey === "both"
                ? dict.ocr?.floatingPanel?.copiedBoth || "Copied Both"
                : dict.ocr?.result?.copyBoth || "Copy Both"}
            </span>
          </GlassButton>
        </div>

        <GlassButton
          size="xs"
          variant="primary"
          onClick={handleCaptureAnother}
          icon={<Crop className="w-3 h-3" />}
        >
          <span>{dict.ocr?.floatingPanel?.captureNext || "Capture Next"}</span>
        </GlassButton>
      </div>

      {/* Resize hitboxes and visual corner grip */}
      {renderResizeHandles()}
      {renderResizeGrip()}
    </div>
  );
};

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <FloatingResultPanel />
    </React.StrictMode>,
  );
}
