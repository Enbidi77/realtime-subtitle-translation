import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/globals.css';
import { FloatingPanelPayload } from '@echo-lingo/contracts';
import {
  GripHorizontal,
  X,
  Copy,
  Check,
  Crop,
  Clock,
} from 'lucide-react';

const FloatingResultPanel: React.FC = () => {
  const [data, setData] = useState<FloatingPanelPayload | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (window.electronAPI?.screenTranslation?.onFloatingPanelData) {
      const unsub = window.electronAPI.screenTranslation.onFloatingPanelData((payload) => {
        setData(payload);
      });
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
      const region = await window.electronAPI?.screenTranslation?.selectRegion();
      if (region) {
        await window.electronAPI?.screenTranslation?.translateRegion({
          region,
          ocrLanguage: 'auto',
          targetLanguages: [data?.targetLanguage || 'vi'],
          sourceLanguage: 'auto',
          skipPreview: true,
        });
      }
    } catch (err) {
      console.error('Failed to capture another region:', err);
    }
  };

  const handleStartDrag = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, [role="button"]')) return;

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (moveEvt.movementX !== 0 || moveEvt.movementY !== 0) {
        window.electronAPI?.app.moveWindow(moveEvt.movementX, moveEvt.movementY);
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4 rounded-2xl glass-panel-elevated text-xs text-muted-foreground">
        Waiting for OCR translation...
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col rounded-2xl glass-panel-elevated border border-white/20 shadow-2xl overflow-hidden text-foreground select-none backdrop-blur-xl bg-background/90">
      {/* Draggable Title Header */}
      <div
        onMouseDown={handleStartDrag}
        className="flex items-center justify-between px-3 py-2 border-b border-glass-border bg-glass-subtle cursor-move"
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/60" />
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="uppercase text-muted-foreground">{data.sourceLanguage}</span>
            <span className="text-muted-foreground/50">→</span>
            <span className="uppercase text-primary font-bold">{data.targetLanguage}</span>
          </div>
          {(data.durationMs ?? 0) > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {data.durationMs}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-glass hover:text-foreground text-muted-foreground cursor-pointer transition-colors"
            title="Dismiss Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-2 select-text app-no-drag">
        {/* Original Recognized Text */}
        {data.originalText && (
          <div className="text-[11px] font-mono text-muted-foreground/90 bg-glass-subtle p-2 rounded-lg border border-glass-border/40 whitespace-pre-wrap leading-relaxed max-h-20 overflow-y-auto">
            {data.originalText}
          </div>
        )}

        {/* Translation Output */}
        <div className="text-sm font-semibold text-foreground leading-relaxed whitespace-pre-wrap">
          {data.translatedText}
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="app-no-drag px-3 py-2 border-t border-glass-border bg-glass-subtle flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleCopy(data.translatedText, 'trans')}
            className="px-2.5 py-1 rounded-lg bg-glass hover:bg-glass-elevated border border-glass-border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer text-foreground transition-colors"
          >
            {copiedKey === 'trans' ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>Copy</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy(`${data.originalText}\n\n${data.translatedText}`, 'both')}
            className="px-2.5 py-1 rounded-lg bg-glass-subtle hover:bg-glass border border-glass-border/50 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            {copiedKey === 'both' ? 'Copied Both' : 'Copy Both'}
          </button>
        </div>

        <button
          type="button"
          onClick={handleCaptureAnother}
          className="px-2.5 py-1 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Crop className="w-3 h-3" />
          <span>Capture Next</span>
        </button>
      </div>
    </div>
  );
};

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <FloatingResultPanel />
    </React.StrictMode>
  );
}
