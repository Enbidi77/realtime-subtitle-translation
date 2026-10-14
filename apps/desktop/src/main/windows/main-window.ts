import { BrowserWindow, app } from 'electron';
import path from 'path';
import { setupSecurityPolicies } from '@/security/security.js';
import { IPC_CHANNELS, AppSettingsSchema } from '@echo-lingo/contracts';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';
import { createLogger } from '@echo-lingo/logger';
import { getDatabase } from '@/database/db-instance.js';
import { notifyMinimizedToTray } from '@/services/tray-service.js';
import { getAppIcon } from '@/services/app-icon.js';

const log = createLogger('MainWindow');

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

export function setIsQuitting(quitting: boolean): void {
  isQuitting = quitting;
}

export function getIsQuitting(): boolean {
  return isQuitting;
}

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false, // Custom frameless titlebar with glass styling
    acceptFirstMouse: true,
    icon: getAppIcon(),
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hidden' as const, vibrancy: 'under-window' as const } : {}),
    ...(process.platform === 'win32' ? { backgroundMaterial: 'mica' as const } : {}),
    backgroundColor: '#0a0d16',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    log.info('Window ready to show, displaying...');
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    log.info('Did finish load successfully.');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log.error(`Failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
    const tag = `[Renderer ${levels[level] || level}] (${sourceId}:${line})`;
    if (level === 3) {
      log.error(`${tag} ${message}`);
    } else if (level === 2) {
      log.warn(`${tag} ${message}`);
    } else if (level === 0) {
      log.debug(`${tag} ${message}`);
    } else {
      log.info(`${tag} ${message}`);
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('Render process gone:', details);
  });

  setupSecurityPolicies(mainWindow.webContents);

  const isDev = !app.isPackaged;
  // In development, load from Vite HMR dev server
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    log.info(`Loading dev URL: ${process.env['ELECTRON_RENDERER_URL']}`);
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    log.info('Loading production index.html');
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Intercept window close to implement closeBehavior
  mainWindow.on('close', (event) => {
    if (isQuitting) {
      log.info('[MainWindow Lifecycle] Application quitting, closing window cleanly.');
      return;
    }

    try {
      const db = getDatabase();
      const rawSettings = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
      const parsed = AppSettingsSchema.safeParse(rawSettings);
      const settings = parsed.success ? parsed.data : DEFAULT_APP_SETTINGS;
      const behavior = settings.closeBehavior || 'ask';

      if (behavior === 'minimize-to-tray') {
        event.preventDefault();
        mainWindow?.hide();
        notifyMinimizedToTray();
        log.info('[MainWindow Lifecycle] Window hidden to system tray.');
      } else if (behavior === 'quit') {
        log.info('[MainWindow Lifecycle] Quitting application as configured.');
        isQuitting = true;
        app.quit();
      } else {
        // behavior === 'ask' (or anything unset)
        event.preventDefault();
        if (mainWindow?.isMinimized()) mainWindow.restore();
        mainWindow?.show();
        mainWindow?.focus();
        mainWindow?.webContents.send(IPC_CHANNELS.APP_REQUEST_CLOSE_CONFIRM);
        log.info('[MainWindow Lifecycle] Close confirmation prompted to user.');
      }
    } catch (err) {
      log.error('[MainWindow Lifecycle] Error evaluating closeBehavior:', err);
      event.preventDefault();
      if (mainWindow?.isMinimized()) mainWindow.restore();
      mainWindow?.show();
      mainWindow?.focus();
      mainWindow?.webContents.send(IPC_CHANNELS.APP_REQUEST_CLOSE_CONFIRM);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
