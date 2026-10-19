import React from 'react';
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

        <button
          type="button"
          onClick={handleAddNewCue}
          className="px-2.5 py-1 rounded-xl text-xs font-medium bg-blue-600/80 hover:bg-blue-600 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <ListPlus className="w-3.5 h-3.5" />
          <span>Add Cue Here</span>
        </button>
      </div>

      {/* Cues Scroll Area */}
      <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {segments.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground/60 border border-dashed border-white/5 rounded-xl">
            No subtitles yet. Click <strong>Auto-Transcribe</strong>, <strong>Import .SRT</strong>, or <strong>Add Cue Here</strong>.
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
                    ? 'bg-blue-500/15 border-blue-500/40 shadow-sm'
                    : isSelected
                    ? 'bg-glass border-white/20'
                    : 'bg-glass-subtle hover:bg-glass border-white/5'
                }`}
              >
                {/* Top: Index, Time range, Seek & Delete */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground/50 w-5">#{idx + 1}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeekToCue(seg.startTime, seg.id);
                      }}
                      className="flex items-center gap-1 font-mono text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
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
                    className="p-1 text-muted-foreground/40 hover:text-rose-400 transition-colors"
                    title="Delete cue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Text Editors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Original</label>
                    <input
                      type="text"
                      value={seg.originalText}
                      onChange={(e) => updateSegment(seg.id, { originalText: e.target.value })}
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Translation ({targetLang})</label>
                    <input
                      type="text"
                      value={translationText}
                      onChange={(e) =>
                        updateSegment(seg.id, {
                          translations: { ...seg.translations, [targetLang]: e.target.value },
                        })
                      }
                      className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-yellow-300/90 focus:outline-none focus:border-blue-500"
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

