import { AppSettings, AppSettingsSchema, IPC_CHANNELS, FeatureFlags } from '@echo-lingo/contracts';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';
import { getDatabase } from '@/database/db-instance.js';
import { getMainWindow } from '@/windows/main-window.js';
import { getOverlayWindow } from '@/windows/overlay-window.js';
import { createLogger, ILogger } from '@echo-lingo/logger';

export class SettingsService {
  private static instance: SettingsService | null = null;
  private readonly log: ILogger = createLogger('SettingsService');

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  public getSettings(): AppSettings {
    const db = getDatabase();
    const raw = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
    const parsed = AppSettingsSchema.safeParse({ ...DEFAULT_APP_SETTINGS, ...raw });
    const settings = parsed.success ? parsed.data : DEFAULT_APP_SETTINGS;
    return this.applyEnvOverrides(settings);
  }

  public updateSettings(updates: unknown): AppSettings {
    const db = getDatabase();
    const current = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
    const merged = { ...DEFAULT_APP_SETTINGS, ...current, ...(updates as object) };
    const validated = AppSettingsSchema.parse(merged);
    db.setSetting('app_settings', validated);

    const withEnv = this.applyEnvOverrides(validated);
    this.broadcastSettings(withEnv);
    return withEnv;
  }

  public resetSettings(): AppSettings {
    const db = getDatabase();
    db.setSetting('app_settings', DEFAULT_APP_SETTINGS);

    const withEnv = this.applyEnvOverrides(DEFAULT_APP_SETTINGS);
    this.broadcastSettings(withEnv);
    return withEnv;
  }

  private applyEnvOverrides(settings: AppSettings): AppSettings {
    const flags: FeatureFlags = { ...settings.featureFlags };

    // Check comma-separated disabled features: ECHOLINGO_DISABLE_FEATURES="video-subtitles,history"
    const disabledList = process.env.ECHOLINGO_DISABLE_FEATURES || process.env.DISABLE_FEATURES;
    if (disabledList) {
      const items = disabledList.split(',').map((s) => s.trim().toLowerCase());
      for (const item of items) {
        if (item === 'video-subtitles' || item === 'videosubtitles') flags.videoSubtitles = false;
        if (item === 'ocr-translate' || item === 'screenocr' || item === 'screen-ocr') flags.screenOcr = false;
        if (item === 'sessions') flags.sessions = false;
        if (item === 'history') flags.history = false;
        if (item === 'providers') flags.providers = false;
        if (item === 'live-subtitles' || item === 'livesubtitles') flags.liveSubtitles = false;
      }
    }

    const checkEnvBool = (keyNames: string[]): boolean | undefined => {
      for (const key of keyNames) {
        const val = process.env[key];
        if (val !== undefined) {
          return val === '1' || val.toLowerCase() === 'true';
        }
      }
      return undefined;
    };

    const videoSubtitles = checkEnvBool(['ECHOLINGO_FEATURE_VIDEO_SUBTITLES', 'FEATURE_VIDEO_SUBTITLES']);
    if (videoSubtitles !== undefined) flags.videoSubtitles = videoSubtitles;

    const screenOcr = checkEnvBool(['ECHOLINGO_FEATURE_SCREEN_OCR', 'FEATURE_SCREEN_OCR', 'FEATURE_OCR_TRANSLATE']);
    if (screenOcr !== undefined) flags.screenOcr = screenOcr;

    const sessions = checkEnvBool(['ECHOLINGO_FEATURE_SESSIONS', 'FEATURE_SESSIONS']);
    if (sessions !== undefined) flags.sessions = sessions;

    const history = checkEnvBool(['ECHOLINGO_FEATURE_HISTORY', 'FEATURE_HISTORY']);
    if (history !== undefined) flags.history = history;

    const providers = checkEnvBool(['ECHOLINGO_FEATURE_PROVIDERS', 'FEATURE_PROVIDERS']);
    if (providers !== undefined) flags.providers = providers;

    const liveSubtitles = checkEnvBool(['ECHOLINGO_FEATURE_LIVE_SUBTITLES', 'FEATURE_LIVE_SUBTITLES']);
    if (liveSubtitles !== undefined) flags.liveSubtitles = liveSubtitles;

    return {
      ...settings,
      featureFlags: flags,
    };
  }

  private broadcastSettings(settings: AppSettings): void {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed() && !mainWin.webContents.isDestroyed()) {
      mainWin.webContents.send(IPC_CHANNELS.SETTINGS_UPDATE_STREAM, settings);
    }
    const overlayWin = getOverlayWindow();
    if (overlayWin && !overlayWin.isDestroyed() && !overlayWin.webContents.isDestroyed()) {
      overlayWin.webContents.send(IPC_CHANNELS.SETTINGS_UPDATE_STREAM, settings);
    }
  }
}

export function getSettingsService(): SettingsService {
  return SettingsService.getInstance();
}
