import { AppSettings, AppSettingsSchema, IPC_CHANNELS } from '@echo-lingo/contracts';
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
    return parsed.success ? parsed.data : DEFAULT_APP_SETTINGS;
  }

  public updateSettings(updates: unknown): AppSettings {
    const db = getDatabase();
    const current = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
    const merged = { ...DEFAULT_APP_SETTINGS, ...current, ...(updates as object) };
    const validated = AppSettingsSchema.parse(merged);
    db.setSetting('app_settings', validated);

    this.broadcastSettings(validated);
    return validated;
  }

  public resetSettings(): AppSettings {
    const db = getDatabase();
    db.setSetting('app_settings', DEFAULT_APP_SETTINGS);

    this.broadcastSettings(DEFAULT_APP_SETTINGS);
    return DEFAULT_APP_SETTINGS;
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

