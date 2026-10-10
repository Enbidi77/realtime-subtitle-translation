import { create } from 'zustand';
import {
  CreateSessionRequest,
  SessionMetadata,
  SubtitleSegment,
  TranscriptionEvent,
} from '@echo-lingo/contracts';

interface SessionStore {
  activeSession: SessionMetadata | null;
  segments: SubtitleSegment[];
  activePartial: SubtitleSegment | null;
  isListening: boolean;
  isPaused: boolean;
  audioRms: number;
  audioPeak: number;
  pipelineLatencyMs: number;
  searchQuery: string;
  audioError: string | null;

  // Actions
  startSession: (req: CreateSessionRequest) => Promise<SessionMetadata>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setAudioLevels: (rms: number, peak: number) => void;
  setAudioError: (err: string | null) => void;
  handleTranscriptionEvent: (evt: TranscriptionEvent) => void;
  updateSegment: (id: string, updates: Partial<SubtitleSegment>) => Promise<void>;
  deleteSegment: (id: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  activeSession: null,
  segments: [],
  activePartial: null,
  isListening: false,
  isPaused: false,
  audioRms: 0,
  audioPeak: 0,
  pipelineLatencyMs: 0,
  searchQuery: '',
  audioError: null,

  startSession: async (req) => {
    if (!window.electronAPI) throw new Error('Electron API not available');
    const session = await window.electronAPI.sessions.create(req);
    set({
      activeSession: session,
      segments: [],
      activePartial: null,
      isListening: true,
      isPaused: false,
      audioError: null,
    });
    return session;
  },

  pauseSession: async () => {
    if (window.electronAPI) {
      await window.electronAPI.audio.pause();
    }
    set({ isPaused: true });
  },

  resumeSession: async () => {
    if (window.electronAPI) {
      await window.electronAPI.audio.resume();
    }
    set({ isPaused: false });
  },

  stopSession: async () => {
    if (window.electronAPI) {
      await window.electronAPI.audio.stop();
    }
    const current = get().activeSession;
    if (current) {
      set({
        activeSession: { ...current, status: 'ended' },
        isListening: false,
        isPaused: false,
        activePartial: null,
        audioRms: 0,
      });
    } else {
      set({ isListening: false, isPaused: false, activePartial: null, audioRms: 0 });
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setAudioLevels: (audioRms, audioPeak) => set({ audioRms, audioPeak }),

  setAudioError: (audioError) => set({ audioError }),

  handleTranscriptionEvent: (evt) => {
    const { segment, translations = {}, pipelineLatencyMs } = evt;
    const { segments, activeSession } = get();

    if (!activeSession || activeSession.id !== evt.sessionId) return;

    if (segment.isFinal) {
      // Add final segment to list
      const updated = [...segments];
      const existingIdx = updated.findIndex((s) => s.id === segment.id);

      const subSeg: SubtitleSegment = {
        id: segment.id,
        sessionId: segment.sessionId,
        startTime: segment.startMs,
        endTime: segment.endMs,
        originalText: segment.text,
        translations,
        sourceLanguage: segment.language || activeSession.sourceLanguage,
        targetLanguages: activeSession.targetLanguages,
        status: 'final',
        confidence: segment.confidence,
        speechProvider: segment.provider,
        translationProvider: activeSession.translationProvider,
        createdAt: segment.createdAt,
        updatedAt: Date.now(),
      };

      if (existingIdx !== -1) {
        updated[existingIdx] = subSeg;
      } else {
        updated.push(subSeg);
      }

      set({
        segments: updated,
        activePartial: null,
        pipelineLatencyMs: pipelineLatencyMs ?? get().pipelineLatencyMs,
      });
    } else {
      // Update partial segment
      set({
        activePartial: {
          id: segment.id,
          sessionId: segment.sessionId,
          startTime: segment.startMs,
          endTime: segment.endMs,
          originalText: segment.text,
          translations,
          sourceLanguage: segment.language || activeSession.sourceLanguage,
          targetLanguages: activeSession.targetLanguages,
          status: 'partial',
          confidence: segment.confidence,
          speechProvider: segment.provider,
          translationProvider: activeSession.translationProvider,
          createdAt: segment.createdAt,
          updatedAt: Date.now(),
        },
        pipelineLatencyMs: pipelineLatencyMs ?? get().pipelineLatencyMs,
      });
    }
  },

  updateSegment: async (id, updates) => {
    const { segments } = get();
    const next = segments.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s));
    set({ segments: next });
    if (window.electronAPI) {
      await window.electronAPI.sessions.updateSegment(id, updates);
    }
  },

  deleteSegment: async (id) => {
    const { segments } = get();
    const next = segments.filter((s) => s.id !== id);
    set({ segments: next });
    if (window.electronAPI) {
      await window.electronAPI.sessions.deleteSegment(id);
    }
  },

  loadSession: async (sessionId) => {
    if (!window.electronAPI) return;
    const session = await window.electronAPI.sessions.get(sessionId);
    const segs = await window.electronAPI.sessions.getSegments(sessionId);
    set({
      activeSession: session,
      segments: segs,
      activePartial: null,
      isListening: session?.status === 'active',
      isPaused: session?.status === 'paused',
    });
  },
}));
