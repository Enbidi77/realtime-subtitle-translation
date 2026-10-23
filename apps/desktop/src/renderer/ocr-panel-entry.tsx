import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "@/styles/globals.css";
import { FloatingPanelPayload } from "@echo-lingo/contracts";
import { applyTheme } from "@/stores/settings-store.js";
import { GlassButton } from "@/components/ui/GlassButton.js";
import { GlassBadge } from "@/components/ui/GlassBadge.js";
import { createRendererLogger } from "@echo-lingo/logger";
import {
  GripHorizontal,
  X,
  Copy,
  Check,
  Crop,
  Clock,
  Sparkles,
} from "lucide-react";

const log = createRendererLogger("OcrPanel");

const FloatingResultPanel: React.FC = () => {
  const [data, setData] = useState<FloatingPanelPayload | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [locale, setLocale] = useState<string>("en");

  useEffect(() => {
    // Sync theme, glass intensity, and locale from settings
    if (window.electronAPI?.settings) {
      window.electronAPI.settings
        .get()
        .then((loaded) => {
          applyTheme(loaded.theme, loaded.glassIntensity);
          if (loaded.locale) setLocale(loaded.locale);
        })
        .catch((err) => log.error("Failed to load settings:", err));

      const unsubSettings = window.electronAPI.settings.onUpdate?.(
        (updated) => {
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

  const handleCaptureAnother = async () => {
    try {
      const region =
        await window.electronAPI?.screenTranslation?.selectRegion();
      if (region) {
        await window.electronAPI?.screenTranslation?.translateRegion({
          region,
          ocrLanguage: "auto",
          targetLanguages: [data?.targetLanguage || "vi"],
          sourceLanguage: "auto",
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

  if (!data) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 rounded-2xl overflow-hidden border border-glass-border-elevated bg-[var(--glass-surface-elevated)] shadow-[inset_0_1px_1.5px_0_var(--glass-highlight)] text-xs text-muted-foreground gap-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
          <span className="font-semibold text-foreground">EchoLingo OCR</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {locale === "vi"
            ? "Đang chờ kết quả dịch thuật..."
            : "Waiting for translation result..."}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col rounded-2xl overflow-hidden border border-glass-border-elevated bg-[var(--glass-surface-elevated)] shadow-[inset_0_1px_1.5px_0_var(--glass-highlight)] text-foreground select-none relative">
      {/* Decorative ambient specular highlight in corner */}
      <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-primary/20 via-indigo-500/10 to-transparent rounded-full blur-xl pointer-events-none" />

      {/* Draggable Title Header */}
      <div
        onMouseDown={handleStartDrag}
        className="flex items-center justify-between px-3.5 py-2 border-b border-glass-border bg-glass-surface-toolbar backdrop-blur-md cursor-move shrink-0 z-10"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/70" />
          <div className="flex items-center gap-1.5">
            <GlassBadge
              variant="neutral"
              className="px-1.5 py-0 text-[10px] uppercase font-mono"
            >
              {data.sourceLanguage}
            </GlassBadge>
            <span className="text-muted-foreground/50 text-[11px]">→</span>
            <GlassBadge
              variant="accent"
              className="px-1.5 py-0 text-[10px] uppercase font-mono font-bold"
            >
              {data.targetLanguage}
            </GlassBadge>
          </div>
          {(data.durationMs ?? 0) > 0 && (
            <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-mono">
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
            title={locale === "vi" ? "Đóng bảng điều khiển" : "Dismiss Panel"}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 select-text app-no-drag z-10">
        {/* Original Recognized Text */}
        {data.originalText && (
          <div className="text-[11px] font-mono text-muted-foreground/90 bg-glass-subtle p-2.5 rounded-xl border border-glass-border/50 whitespace-pre-wrap leading-relaxed max-h-20 overflow-y-auto backdrop-blur-sm">
            {data.originalText}
          </div>
        )}

        {/* Translation Output */}
        <div className="text-sm font-semibold text-foreground leading-relaxed whitespace-pre-wrap selection:bg-primary/25">
          {data.translatedText}
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="app-no-drag px-3 py-2 border-t border-glass-border bg-glass-surface-toolbar/80 backdrop-blur-md flex items-center justify-between text-xs shrink-0 z-10">
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
                ? locale === "vi"
                  ? "Đã sao chép"
                  : "Copied"
                : locale === "vi"
                  ? "Sao chép"
                  : "Copy"}
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
                ? locale === "vi"
                  ? "Đã sao chép cả hai"
                  : "Copied Both"
                : locale === "vi"
                  ? "Sao chép cả hai"
                  : "Copy Both"}
            </span>
          </GlassButton>
        </div>

        <GlassButton
          size="xs"
          variant="primary"
          onClick={handleCaptureAnother}
          icon={<Crop className="w-3 h-3" />}
        >
          <span>{locale === "vi" ? "Chụp tiếp" : "Capture Next"}</span>
        </GlassButton>
      </div>
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
