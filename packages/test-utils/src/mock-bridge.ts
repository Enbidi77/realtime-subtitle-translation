import {
  AppSettings,
  AudioDeviceInfo,
  AudioPipelineStatus,
  GlossaryEntry,
  SessionMetadata,
  SubtitleSegment,
  SystemInfo,
  TranslationCapability,
} from '@echo-lingo/contracts';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';
import { SAMPLE_SEGMENTS } from './fixtures.js';

export function createMockElectronBridge() {
  let settings: AppSettings = { ...DEFAULT_APP_SETTINGS };
  let sessions: SessionMetadata[] = [];
  let segments: SubtitleSegment[] = [...SAMPLE_SEGMENTS];
  let glossary: GlossaryEntry[] = [];
  let isListening = false;

  const listeners = new Map<string, Set<(...args: any[]) => void>>();

  const on = (channel: string, callback: (...args: any[]) => void) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel)!.add(callback);
    return () => listeners.get(channel)?.delete(callback);
  };

  const emit = (channel: string, ...args: any[]) => {
    listeners.get(channel)?.forEach((cb) => cb(...args));
  };

  return {
    app: {
      getSystemInfo: async (): Promise<SystemInfo> => ({
        platform: 'win32',
        arch: 'x64',
        appVersion: '1.0.0',
        electronVersion: '34.0.0',
        nodeVersion: '24.14.0',
        userDataPath: 'C:\\Users\\Mock\\AppData\\Roaming\\EchoLingo',
      }),
      minimize: () => {},
      maximize: () => {},
      close: () => {},
    },
    audio: {
      getDevices: async (): Promise<AudioDeviceInfo[]> => [
        { id: 'default', label: 'Default Microphone (Realtek Audio)', kind: 'audioinput', isDefault: true },
        { id: 'mic-2', label: 'USB Headset Microphone', kind: 'audioinput' },
      ],
      start: async () => {
        isListening = true;
      },
      stop: async () => {
        isListening = false;
      },
      pause: async () => {},
      resume: async () => {},
      processChunk: async () => {},
      onLevel: (cb: (evt: any) => void) => on('audio:level-stream', cb),
      onStatus: (cb: (status: AudioPipelineStatus) => void) => on('audio:status', cb),
    },
    speech: {
      onTranscription: (cb: (evt: any) => void) => on('transcription:event', cb),
      getModels: async () => [
        { id: 'tiny', name: 'Whisper Tiny', isInstalled: true, downloadProgress: 100 },
      ],
      downloadModel: async () => {},
    },
    translation: {
      getProviders: async (): Promise<TranslationCapability[]> => [
        {
          id: 'google-web',
          name: 'Google Translate (Free)',
          description: 'Web translation',
          isLocal: false,
          requiresApiKey: false,
          isConfigured: true,
          supportedLanguages: [],
        },
      ],
      translate: async (req: any) => ({
        originalText: req.text,
        translatedText: `[VI] ${req.text}`,
        sourceLanguage: req.sourceLanguage,
        targetLanguage: req.targetLanguage,
        provider: 'mock',
        durationMs: 15,
        fromCache: false,
      }),
      setCredential: async () => {},
      hasCredential: async () => true,
      deleteCredential: async () => {},
    },
    sessions: {
      create: async (req: any): Promise<SessionMetadata> => {
        const sess: SessionMetadata = {
          id: 'mock-session-' + Date.now(),
          title: req.title || 'Live Session',
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          durationSeconds: 0,
          sourceLanguage: req.sourceLanguage || 'auto',
          targetLanguages: req.targetLanguages || ['vi'],
          segmentCount: 0,
          speechProvider: req.speechProvider || 'whisper-local',
          translationProvider: req.translationProvider || 'google-web',
          audioSourceType: req.audioSourceType || 'microphone',
        };
        sessions.unshift(sess);
        return sess;
      },
      get: async (id: string) => sessions.find((s) => s.id === id) || null,
      list: async () => sessions,
      delete: async (id: string) => {
        sessions = sessions.filter((s) => s.id !== id);
      },
      getSegments: async (_id: string) => segments,
      updateSegment: async (id: string, updates: any) => {
        const seg = segments.find((s) => s.id === id);
        if (seg) Object.assign(seg, updates);
      },
      deleteSegment: async (id: string) => {
        segments = segments.filter((s) => s.id !== id);
      },
      export: async () => '1\n00:00:01,000 --> 00:00:04,000\nHello\n',
      import: async () => ({ count: 1 }),
    },
    glossary: {
      list: async () => glossary,
      add: async (e: GlossaryEntry) => {
        glossary.push(e);
      },
      delete: async (id: string) => {
        glossary = glossary.filter((g) => g.id !== id);
      },
    },
    settings: {
      get: async () => settings,
      update: async (partial: Partial<AppSettings>) => {
        settings = { ...settings, ...partial };
        return settings;
      },
      reset: async () => {
        settings = { ...DEFAULT_APP_SETTINGS };
        return settings;
      },
    },
    overlay: {
      toggle: async () => {},
      setClickThrough: async () => {},
      onSegments: (cb: (segs: SubtitleSegment[]) => void) => on('overlay:segments-stream', cb),
    },
    _emit: emit,
  };
}
