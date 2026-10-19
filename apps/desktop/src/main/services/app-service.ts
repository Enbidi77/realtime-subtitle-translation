import { app, BrowserWindow, shell, WebContents } from 'electron';
import { SystemInfo, LogMessageRequestSchema } from '@echo-lingo/contracts';
import { createLogger, getLogDirectory, ILogger } from '@echo-lingo/logger';
import { setIsQuitting } from '@/windows/main-window.js';
import { toggleOverlay, setOverlayClickThrough } from '@/windows/overlay-window.js';
import { getTrayService } from '@/services/tray-service.js';

export class AppService {
  private static instance: AppService | null = null;
  private readonly log: ILogger = createLogger('AppService');

  public static getInstance(): AppService {
    if (!AppService.instance) {
      AppService.instance = new AppService();
    }
    return AppService.instance;
  }

  public getSystemInfo(): SystemInfo {
    return {
      platform: process.platform as 'win32' | 'darwin' | 'linux',
      arch: process.arch,
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron || '',
      nodeVersion: process.versions.node,
      userDataPath: app.getPath('userData'),
    };
  }

  public minimizeWindow(sender: WebContents): void {
    const win = BrowserWindow.fromWebContents(sender);
    win?.minimize();
  }

  public maximizeWindow(sender: WebContents): void {
    const win = BrowserWindow.fromWebContents(sender);
    if (win) {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
  }

  public closeWindow(sender: WebContents): void {
    const win = BrowserWindow.fromWebContents(sender);
    win?.close();
  }

  public quit(): void {
    setIsQuitting(true);
    app.quit();
  }

  public minimizeToTray(sender: WebContents): void {
    const win = BrowserWindow.fromWebContents(sender);
    win?.hide();
    getTrayService().notifyMinimizedToTray();
  }

  public moveWindow(sender: WebContents, deltaX: number, deltaY: number): void {
    const win = BrowserWindow.fromWebContents(sender);
    if (win && !win.isMaximized()) {
      const [x, y] = win.getPosition();
      win.setPosition(Math.round(x + deltaX), Math.round(y + deltaY));
    }
  }

  public async openLogs(): Promise<{ ok: boolean; path: string }> {
    const logDir = getLogDirectory();
    await shell.openPath(logDir);
    return { ok: true, path: logDir };
  }

  public logMessage(payload: unknown): void {
    const parsed = LogMessageRequestSchema.safeParse(payload);
    if (!parsed.success) return;
    const { level, scope, message, args } = parsed.data;
    const rendererLogger = createLogger(scope || 'Renderer');
    const logArgs = args && args.length > 0 ? [message, ...args] : [message];
    if (level === 'error') rendererLogger.error(...logArgs);
    else if (level === 'warn') rendererLogger.warn(...logArgs);
    else if (level === 'debug') rendererLogger.debug(...logArgs);
    else rendererLogger.info(...logArgs);
  }

  public toggleOverlay(): boolean {
    return toggleOverlay();
  }

  public setOverlayClickThrough(clickThrough: boolean): void {
    setOverlayClickThrough(clickThrough);
  }
}

export function getAppService(): AppService {
  return AppService.getInstance();
}

