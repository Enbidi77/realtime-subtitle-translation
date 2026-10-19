import {
  AudioDeviceInfo,
  CreateSessionRequest,
  SessionMetadata,
  SubtitleExportOptions,
  SubtitleSegment,
  TranscriptionEvent,
  TranscriptionSegment,
} from '@echo-lingo/contracts';
import { SpeechPipeline } from '@echo-lingo/speech-core';
import {
  SubtitleTimeline,
  exportToSrt,
  exportToVtt,
  exportToTxt,
  exportToJson,
  parseSubtitles,
} from '@echo-lingo/subtitle-core';
import { getDatabase } from '@/database/db-instance.js';
import { getSpeechService } from '@/services/speech-service.js';
import { getTranslationService } from '@/services/translation-service.js';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@echo-lingo/contracts';
import { createLogger, ILogger } from '@echo-lingo/logger';

export class SessionService {
  private static instance: SessionService | null = null;
  private readonly log: ILogger = createLogger('SessionService');

  private activeSession: SessionMetadata | null = null;
  private timeline: SubtitleTimeline = new SubtitleTimeline();
  private pipeline: SpeechPipeline | null = null;
  private mainWindow: BrowserWindow | null = null;
  private overlayWindow: BrowserWindow | null = null;
  private sessionTimer: NodeJS.Timeout | null = null;
  private sessionStateCallbacks: Array<(active: boolean) => void> = [];

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  public onSessionStateChange(cb: (active: boolean) => void): () => void {
    this.sessionStateCallbacks.push(cb);
    return () => {
      this.sessionStateCallbacks = this.sessionStateCallbacks.filter((c) => c !== cb);
    };
  }

  private notifySessionStateChange(): void {
    const isActive = this.activeSession?.status === 'active';
    for (const cb of this.sessionStateCallbacks) {
      try {
        cb(isActive);
      } catch (err) {
        this.log.error('Error in session state callback:', err);
      }
    }
  }

  public setWindows(mainWin: BrowserWindow | null, overlayWin: BrowserWindow | null): void {
    this.mainWindow = mainWin;
    this.overlayWindow = overlayWin;
  }

  public setOverlayWindow(overlayWin: BrowserWindow | null): void {
    this.overlayWindow = overlayWin;
    if (overlayWin && !overlayWin.isDestroyed()) {
      this.broadcastToOverlay();
    }
  }

  public getActiveSession(): SessionMetadata | null {
    return this.activeSession;
  }

  public getTimeline(): SubtitleTimeline {
    return this.timeline;
  }

  /**
   * Start a new live transcription session
   */
  public async createSession(req: CreateSessionRequest): Promise<SessionMetadata> {
    const db = getDatabase();
    const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = Date.now();

    const title = req.title || `Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const session: SessionMetadata = {
      id,
      title,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      durationSeconds: 0,
      sourceLanguage: req.sourceLanguage,
      targetLanguages: req.targetLanguages,
      segmentCount: 0,
      speechProvider: req.speechProvider,
      translationProvider: req.translationProvider,
      audioSourceType: req.audioSourceType,
      audioDeviceId: req.audioDeviceId,
    };

    db.createSession(session);
    this.activeSession = session;
    this.timeline.clear();

    const speechProvider = getSpeechService().getProvider(req.speechProvider as any);

    const settings = db.getSetting<any>('app_settings', null);
    const vadThreshold = settings?.vadSensitivity ?? 0.008;

    // Initialize speech pipeline
    this.pipeline = new SpeechPipeline({
      sessionId: id,
      sourceLanguage: req.sourceLanguage,
      provider: speechProvider,
      vadThreshold,
      onTranscription: (segment, latencyMs) => {
        this.handleTranscriptionSegment(segment, latencyMs).catch((err) => {
          this.log.error('Uncaught error in handleTranscriptionSegment:', err);
        });
      },
      onError: (err) => {
        this.log.error('Error during speech recognition:', err.message);
        if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.webContents.isDestroyed()) {
          this.mainWindow.webContents.send(IPC_CHANNELS.AUDIO_STATUS, {
            sourceType: req.audioSourceType,
            state: 'error',
            sampleRate: 16000,
            channelCount: 1,
            isSpeechActive: false,
            rms: 0,
            bufferFillRatio: 0,
            errorMessage: `Speech Engine Notice: ${err.message}`,
          });
        }
      },
    });

    this.pipeline.start();
    this.notifySessionStateChange();

    // Start duration ticker
    if (this.sessionTimer) clearInterval(this.sessionTimer);
    this.sessionTimer = setInterval(() => {
      if (this.activeSession && this.activeSession.status === 'active') {
        this.activeSession.durationSeconds++;
        db.updateSession(this.activeSession.id, {
          durationSeconds: this.activeSession.durationSeconds,
        });
      }
    }, 1000);

    return session;
  }

  /**
   * Feed raw 16kHz mono audio samples into the active pipeline
   */
  public feedAudioSamples(samples: Float32Array): void {
    if (this.pipeline && this.activeSession?.status === 'active') {
      this.pipeline.feedAudio(samples);
    }
  }

  /**
   * Handle incoming speech segment from pipeline
   */
  private async handleTranscriptionSegment(
    segment: TranscriptionSegment,
    latencyMs: number
  ): Promise<void> {
    try {
      if (!this.activeSession) return;
      this.log.info(`Speech segment recognized: "${segment.text}" (final: ${segment.isFinal})`);

      const translationService = getTranslationService();
      const targetLangs = Array.isArray(this.activeSession.targetLanguages)
        ? this.activeSession.targetLanguages
        : [];

      // Translate segment into target languages
      let translations: Record<string, string> = {};
      if (targetLangs.length > 0) {
        try {
          translations = await translationService.translateMultiple(
            segment.text,
            segment.language || this.activeSession.sourceLanguage,
            targetLangs,
            this.activeSession.translationProvider as any
          );
          this.log.info('Translations generated:', translations);
        } catch (transErr) {
          this.log.error('Translation failed for segment:', transErr);
          translations = {};
          for (const lang of targetLangs) {
            translations[lang] = segment.text;
          }
        }
      }

      const subtitleSegment: SubtitleSegment = {
        id: segment.id,
        sessionId: segment.sessionId,
        startTime: segment.startMs,
        endTime: segment.endMs,
        originalText: segment.text,
        translations,
        sourceLanguage: segment.language || this.activeSession.sourceLanguage,
        targetLanguages: targetLangs,
        status: segment.isFinal ? 'final' : 'partial',
        confidence: segment.confidence,
        speechProvider: segment.provider,
        translationProvider: this.activeSession.translationProvider,
        createdAt: segment.createdAt,
        updatedAt: Date.now(),
      };

      if (segment.isFinal) {
        this.timeline.addFinal(subtitleSegment);
        // Persist final segment to SQLite immediately
        try {
          getDatabase().insertSegment(subtitleSegment);
          this.log.info(`Persisted segment ${segment.id} to SQLite`);
        } catch (dbErr) {
          this.log.error(`SQLite insertSegment error for ${segment.id}:`, dbErr);
        }
      } else {
        this.timeline.updatePartial(subtitleSegment);
      }

      // Broadcast transcription event to Main Window
      if (this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.webContents.isDestroyed()) {
        try {
          const evt: TranscriptionEvent = {
            sessionId: this.activeSession.id,
            segment,
            translations,
            pipelineLatencyMs: latencyMs,
          };
          this.mainWindow.webContents.send(IPC_CHANNELS.TRANSCRIPTION_EVENT, evt);
        } catch (ipcErr) {
          this.log.error('Error sending transcription event to main window:', ipcErr);
        }
      }

      // Broadcast latest segments to Floating Overlay Window
      this.broadcastToOverlay();
    } catch (unhandledErr) {
      this.log.error('Unexpected error in handleTranscriptionSegment:', unhandledErr);
    }
  }

  public broadcastToOverlay(): void {
    try {
      if (
        this.overlayWindow &&
        !this.overlayWindow.isDestroyed() &&
        !this.overlayWindow.webContents.isDestroyed()
      ) {
        // Send last 5 segments for low-latency overlay rendering
        const all = this.timeline.getSegments(true);
        const recent = all.slice(-5);
        this.overlayWindow.webContents.send(IPC_CHANNELS.OVERLAY_SEGMENTS_STREAM, recent);
      }
    } catch (err) {
      this.log.error('Error broadcasting to overlay window:', err);
    }
  }

  public pauseSession(): void {
    if (this.activeSession) {
      this.activeSession.status = 'paused';
      getDatabase().updateSession(this.activeSession.id, { status: 'paused' });
      this.notifySessionStateChange();
    }
  }

  public resumeSession(): void {
    if (this.activeSession) {
      this.activeSession.status = 'active';
      getDatabase().updateSession(this.activeSession.id, { status: 'active' });
      this.notifySessionStateChange();
    }
  }

  public stopSession(): void {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
    if (this.pipeline) {
      this.pipeline.stop();
      this.pipeline = null;
    }
    if (this.activeSession) {
      this.activeSession.status = 'ended';
      getDatabase().updateSession(this.activeSession.id, {
        status: 'ended',
        durationSeconds: this.activeSession.durationSeconds,
      });
    }
    this.broadcastToOverlay();
    this.notifySessionStateChange();
  }

  // ================= Session Queries & Management =================
  public getSession(id: string): SessionMetadata | null {
    return getDatabase().getSession(id);
  }

  public listSessions(limit: number = 100): SessionMetadata[] {
    return getDatabase().getAllSessions(limit);
  }

  public updateSession(id: string, updates: Partial<SessionMetadata>): void {
    getDatabase().updateSession(id, updates);
  }

  public deleteSession(id: string): void {
    getDatabase().deleteSession(id);
  }

  // ================= Segments Queries & Management =================
  public getSegments(sessionId: string): SubtitleSegment[] {
    return getDatabase().getSegmentsBySessionId(sessionId);
  }

  public updateSegment(id: string, updates: Partial<SubtitleSegment>): void {
    getDatabase().updateSegment(id, updates);
  }

  public deleteSegment(id: string): void {
    getDatabase().deleteSegment(id);
  }

  public getOverlaySegments(count: number = 5): SubtitleSegment[] {
    return this.timeline.getSegments(true).slice(-count);
  }

  // ================= Audio Devices & Chunks =================
  public feedAudioChunk(samples?: number[]): void {
    if (samples && samples.length > 0) {
      const float32 = new Float32Array(samples);
      this.feedAudioSamples(float32);
    }
  }

  public getAudioDevices(): AudioDeviceInfo[] {
    return [
      { id: 'default', label: 'Default System Microphone', kind: 'audioinput', isDefault: true },
      { id: 'communications', label: 'Default Communications Device', kind: 'audioinput' },
    ];
  }

  // ================= Subtitle Export & Import =================
  public exportSession(sessionId: string, options: SubtitleExportOptions): string {
    const segments = getDatabase().getSegmentsBySessionId(sessionId);
    switch (options.format) {
      case 'srt':
        return exportToSrt(segments, options);
      case 'vtt':
        return exportToVtt(segments, options);
      case 'txt':
        return exportToTxt(segments, options);
      case 'json':
        return exportToJson(segments);
      default:
        return exportToSrt(segments, options);
    }
  }

  public importSession(
    content: string,
    fileName?: string,
    sourceLanguage?: string,
    targetLanguage?: string
  ): { count: number; sessionId: string } {
    const segments = parseSubtitles(content, fileName, { sourceLanguage, targetLanguage });
    if (segments.length === 0) {
      throw new Error('No valid subtitle segments found in file');
    }

    const sessionId = 'imported_' + Date.now();
    const session: SessionMetadata = {
      id: sessionId,
      title: fileName || 'Imported Subtitles',
      status: 'ended',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      durationSeconds: Math.round(segments[segments.length - 1].endTime / 1000),
      sourceLanguage: sourceLanguage || 'en',
      targetLanguages: targetLanguage ? [targetLanguage] : ['vi'],
      segmentCount: segments.length,
      speechProvider: 'imported',
      translationProvider: 'imported',
      audioSourceType: 'file',
    };

    const db = getDatabase();
    db.createSession(session);
    for (const seg of segments) {
      seg.sessionId = sessionId;
      db.insertSegment(seg);
    }

    return { count: segments.length, sessionId };
  }
}

export function getSessionService(): SessionService {
  return SessionService.getInstance();
}
