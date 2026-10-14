import { BrowserWindow, screen, app, ipcMain } from 'electron';
import path from 'path';
import { ScreenCaptureRegion } from '@echo-lingo/contracts';
import { createLogger } from '@echo-lingo/logger';
import { setupSecurityPolicies } from '@/security/security.js';

const log = createLogger('SelectionWindow');

let selectionWindow: BrowserWindow | null = null;
let currentResolve: ((region: ScreenCaptureRegion | null) => void) | null = null;

export async function openSelectionOverlay(
  targetDisplayId?: number
): Promise<ScreenCaptureRegion | null> {
  // If an overlay is already active, close it
  if (selectionWindow && !selectionWindow.isDestroyed()) {
    selectionWindow.destroy();
    selectionWindow = null;
  }

  const allDisplays = screen.getAllDisplays();
  const display =
    (targetDisplayId !== undefined
      ? allDisplays.find((d) => d.id === targetDisplayId)
      : null) || screen.getPrimaryDisplay();

  return new Promise<ScreenCaptureRegion | null>((resolve) => {
    currentResolve = resolve;

    selectionWindow = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      hasShadow: false,
      enableLargerThanScreen: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (process.platform === 'darwin') {
      selectionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      selectionWindow.setAlwaysOnTop(true, 'screen-saver');
    } else {
      selectionWindow.setAlwaysOnTop(true);
    }

    setupSecurityPolicies(selectionWindow.webContents);

    selectionWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
      const tag = `[Selection ${levels[level] || level}] (${sourceId}:${line})`;
      if (level === 3) log.error(`${tag} ${message}`);
      else if (level === 2) log.warn(`${tag} ${message}`);
      else if (level === 0) log.debug(`${tag} ${message}`);
      else log.info(`${tag} ${message}`);
    });

    const isDev = !app.isPackaged;
    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
      selectionWindow.loadURL(
        `${process.env['ELECTRON_RENDERER_URL']}/selection.html?displayId=${display.id}`
      );
    } else {
      selectionWindow.loadFile(path.join(__dirname, '../renderer/selection.html'), {
        query: { displayId: display.id.toString() },
      });
    }

    selectionWindow.on('closed', () => {
      selectionWindow = null;
      if (currentResolve) {
        currentResolve(null);
        currentResolve = null;
      }
    });
  });
}

export function closeSelectionOverlay(region: ScreenCaptureRegion | null): void {
  if (currentResolve) {
    currentResolve(region);
    currentResolve = null;
  }

  if (selectionWindow && !selectionWindow.isDestroyed()) {
    selectionWindow.destroy();
    selectionWindow = null;
  }
}
