import React, { useState } from 'react';
import { useVideoSubtitleStore } from '../stores/video-subtitle-store.js';
import { formatDisplayTime } from '@echo-lingo/subtitle-core';
import { SubtitleSegment } from '@echo-lingo/contracts';
import {
  ListPlus,
  Trash2,
  Clock,
  Languages,
  Play,
  FileText,
  Download,
  Check,
} from 'lucide-react';

export const SubtitleCueList: React.FC = () => {
  const segments = useVideoSubtitleStore((s) => s.segments);
  const selectedSegmentId = useVideoSubtitleStore((s) => s.selectedSegmentId);
  const currentTime = useVideoSubtitleStore((s) => s.currentTime);
  const duration = useVideoSubtitleStore((s) => s.duration);
  const targetLang = useVideoSubtitleStore((s) => s.targetLang);

  const selectSegment = useVideoSubtitleStore((s) => s.selectSegment);
  const setCurrentTime = useVideoSubtitleStore((s) => s.setCurrentTime);
  const updateSegment = useVideoSubtitleStore((s) => s.updateSegment);
  const removeSegment = useVideoSubtitleStore((s) => s.removeSegment);
  const addSegment = useVideoSubtitleStore((s) => s.addSegment);
  const exportSubtitleFile = useVideoSubtitleStore((s) => s.exportSubtitleFile);

  const [isExportingFile, setIsExportingFile] = useState(false);
  const [exportedStatus, setExportedStatus] = useState<string | null>(null);

  const handleQuickExportSrt = async () => {
    setIsExportingFile(true);
    try {
      const ok = await exportSubtitleFile('srt', true);
      if (ok) {
        setExportedStatus('Saved!');
        setTimeout(() => setExportedStatus(null), 3000);
      }
    } finally {
      setIsExportingFile(false);
    }
  };

  const currentMs = currentTime * 1000;

  const handleAddNewCue = () => {
    const startMs = Math.round(currentTime * 1000);
    const endMs = Math.min(startMs + 3000, Math.round(duration * 1000) || startMs + 3000);

    const newSeg: SubtitleSegment = {
      id: 'cue_' + Date.now(),
      sessionId: 'video_session',
      startTime: startMs,
      endTime: endMs,
      originalText: 'New subtitle cue',
      translations: { [targetLang]: 'Phụ đề mới' },
      sourceLanguage: 'auto',
      targetLanguages: [targetLang],
      status: 'final',
      speechProvider: 'manual',
      translationProvider: 'manual',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    addSegment(newSeg);
    selectSegment(newSeg.id);
  };

  const handleSeekToCue = (startTimeMs: number, segId: string) => {
    setCurrentTime(startTimeMs / 1000 + 0.05);
    selectSegment(segId);
  };

  return (
    <div className="w-full glass-card p-4 rounded-2xl border border-white/10 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-semibold text-foreground">
            Subtitle Timeline ({segments.length} cues)
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          {segments.length > 0 && (
            <button
              type="button"
              onClick={handleQuickExportSrt}
              disabled={isExportingFile}
              className="px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-foreground transition-all flex items-center gap-1.5 cursor-pointer border border-border dark:border-white/10 shadow-sm disabled:opacity-50"
              title="Export subtitles as .SRT file"
            >
              {exportedStatus ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{exportedStatus}</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-blue-500" />
                  <span>Export .SRT</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleAddNewCue}
            className="px-2.5 py-1 rounded-xl text-xs font-medium bg-blue-600/80 hover:bg-blue-600 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>Add Cue Here</span>
          </button>
        </div>
      </div>

      {/* Cues Scroll Area */}
      <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {segments.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border dark:border-white/10 rounded-xl">
            No subtitles yet. Click <strong className="text-foreground font-semibold">Auto-Transcribe</strong>, <strong className="text-foreground font-semibold">Import .SRT</strong>, or <strong className="text-foreground font-semibold">Add Cue Here</strong>.
          </div>
        ) : (
          segments.map((seg, idx) => {
            const isActive = currentMs >= seg.startTime && currentMs <= seg.endTime;
            const isSelected = selectedSegmentId === seg.id;
            const translationText =
              seg.translations[targetLang] || Object.values(seg.translations)[0] || '';

            return (
              <div
                key={seg.id}
                onClick={() => {
                  selectSegment(seg.id);
                  handleSeekToCue(seg.startTime, seg.id);
                }}
                className={`p-3 rounded-xl border transition-all text-xs flex flex-col gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/40 shadow-sm'
                    : isSelected
                    ? 'bg-accent/40 dark:bg-glass border-border dark:border-white/20'
                    : 'bg-glass-subtle hover:bg-glass border-border/50 dark:border-white/5'
                }`}
              >
                {/* Top: Index, Time range, Seek & Delete */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground font-medium w-5">#{idx + 1}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeekToCue(seg.startTime, seg.id);
                      }}
                      className="flex items-center gap-1 font-mono text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors cursor-pointer"
                      title="Seek video to cue start"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>{formatDisplayTime(seg.startTime)}</span>
                      <span>→</span>
                      <span>{formatDisplayTime(seg.endTime)}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSegment(seg.id);
                    }}
                    className="p-1 text-muted-foreground hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                    title="Delete cue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Text Editors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Original</label>
                    <input
                      type="text"
                      value={seg.originalText}
                      onChange={(e) => updateSegment(seg.id, { originalText: e.target.value })}
                      className="w-full bg-background/80 dark:bg-black/30 border border-input dark:border-white/10 rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Translation ({targetLang})</label>
                    <input
                      type="text"
                      value={translationText}
                      onChange={(e) =>
                        updateSegment(seg.id, {
                          translations: { ...seg.translations, [targetLang]: e.target.value },
                        })
                      }
                      className="w-full bg-background/80 dark:bg-black/30 border border-input dark:border-white/10 rounded-lg px-2.5 py-1 text-xs text-amber-700 dark:text-yellow-300 font-medium focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

