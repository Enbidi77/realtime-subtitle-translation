import { BrowserWindow, app } from 'electron';
import path from 'path';
import { setupSecurityPolicies } from '@/security/security.js';
import { IPC_CHANNELS, AppSettingsSchema } from '@echo-lingo/contracts';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';
import { getDatabase } from '@/database/db-instance.js';
import { notifyMinimizedToTray } from '@/services/tray-service.js';

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
    console.log('[MainWindow] Window ready to show, displaying...');
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[MainWindow] Did finish load successfully.');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[MainWindow] Failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    console.log(`[Renderer ${levels[level] || level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[MainWindow] Render process gone:', details);
  });

  setupSecurityPolicies(mainWindow.webContents);

  const isDev = !app.isPackaged;
  // In development, load from Vite HMR dev server
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    console.log(`[MainWindow] Loading dev URL: ${process.env['ELECTRON_RENDERER_URL']}`);
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    console.log('[MainWindow] Loading production index.html');
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Intercept window close to implement closeBehavior
  mainWindow.on('close', (event) => {
    if (isQuitting) {
      console.log('[MainWindow Lifecycle] Application quitting, closing window cleanly.');
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
        console.log('[MainWindow Lifecycle] Window hidden to system tray.');
      } else if (behavior === 'quit') {
        console.log('[MainWindow Lifecycle] Quitting application as configured.');
        isQuitting = true;
        app.quit();
      } else {
        // behavior === 'ask' (or anything unset)
        event.preventDefault();
        if (mainWindow?.isMinimized()) mainWindow.restore();
        mainWindow?.show();
        mainWindow?.focus();
        mainWindow?.webContents.send(IPC_CHANNELS.APP_REQUEST_CLOSE_CONFIRM);
        console.log('[MainWindow Lifecycle] Close confirmation prompted to user.');
      }
    } catch (err) {
      console.error('[MainWindow Lifecycle] Error evaluating closeBehavior:', err);
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
