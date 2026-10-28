import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import { setupSecurityPolicies } from '@/security/security.js';
import { getMainWindow } from '@/windows/main-window.js';
import { getAppIconService } from '@/services/app-icon.js';
import { IPC_CHANNELS } from '@echo-lingo/contracts';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('OverlayWindow');

let overlayWindow: BrowserWindow | null = null;
let isClickThrough = false;

type OverlayCallback = (win: BrowserWindow | null) => void;
let onOverlayCreated: OverlayCallback | null = null;
let onOverlayToggled: OverlayCallback | null = null;
let onOverlayClosed: (() => void) | null = null;

export function setOverlayCallbacks(callbacks: {
  onCreated?: OverlayCallback;
  onToggled?: OverlayCallback;
  onClosed?: () => void;
}): void {
  if (callbacks.onCreated) onOverlayCreated = callbacks.onCreated;
  if (callbacks.onToggled) onOverlayToggled = callbacks.onToggled;
  if (callbacks.onClosed) onOverlayClosed = callbacks.onClosed;
}

export function broadcastOverlayVisibility(visible: boolean): void {
  try {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed() && !mainWin.webContents.isDestroyed()) {
      mainWin.webContents.send(IPC_CHANNELS.OVERLAY_VISIBILITY_STREAM, visible);
    }
    if (overlayWindow && !overlayWindow.isDestroyed() && !overlayWindow.webContents.isDestroyed()) {
      overlayWindow.webContents.send(IPC_CHANNELS.OVERLAY_VISIBILITY_STREAM, visible);
    }
  } catch (err) {
    log.error('Error broadcasting visibility:', err);
  }
}

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    overlayWindow.focus();
    broadcastOverlayVisibility(true);
    return overlayWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  const defaultWidth = 860;
  const defaultHeight = 180;
  // Position by default at the bottom center of the screen within active work area
  const defaultX = Math.round(workArea.x + (workArea.width - defaultWidth) / 2);
  const defaultY = Math.round(workArea.y + workArea.height - defaultHeight - 40);

  overlayWindow = new BrowserWindow({
    title: 'EchoLingo Overlay',
    width: defaultWidth,
    height: defaultHeight,
    x: defaultX,
    y: defaultY,
    minWidth: 400,
    minHeight: 110,
    icon: getAppIconService().getAppIcon(),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === 'darwin') {
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    overlayWindow.setAlwaysOnTop(true);
  }

  setupSecurityPolicies(overlayWindow.webContents);

  const isDev = !app.isPackaged;
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    log.info(`Loading dev URL: ${process.env['ELECTRON_RENDERER_URL']}/overlay.html`);
    overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`);
  } else {
    log.info('Loading production overlay.html');
    overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay.html'));
  }

  overlayWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
    const tag = `[Overlay ${levels[level] || level}] (${sourceId}:${line})`;
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

  overlayWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('Render process gone:', details);
  });

  overlayWindow.webContents.on('did-finish-load', () => {
    log.info('Did finish load successfully.');
    if (onOverlayToggled && overlayWindow && !overlayWindow.isDestroyed()) {
      onOverlayToggled(overlayWindow);
    }
  });

  overlayWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log.error(`Failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`);
  });

  overlayWindow.on('closed', () => {
    log.info('Overlay window closed.');
    broadcastOverlayVisibility(false);
    if (onOverlayClosed) onOverlayClosed();
    overlayWindow = null;
  });

  if (onOverlayCreated) onOverlayCreated(overlayWindow);

  return overlayWindow;
}

export function toggleOverlay(): boolean {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    log.info('Creating and displaying overlay window...');
    createOverlayWindow();
    overlayWindow?.show();
    overlayWindow?.focus();
    broadcastOverlayVisibility(true);
    if (onOverlayToggled && overlayWindow) onOverlayToggled(overlayWindow);
    return true;
  }

  if (overlayWindow.isVisible()) {
    log.info('Hiding overlay window...');
    overlayWindow.hide();
    broadcastOverlayVisibility(false);
    return false;
  } else {
    log.info('Restoring and displaying existing overlay window...');
    if (overlayWindow.isMinimized()) overlayWindow.restore();
    overlayWindow.show();
    overlayWindow.focus();
    broadcastOverlayVisibility(true);
    if (onOverlayToggled) onOverlayToggled(overlayWindow);
    return true;
  }
}

export function setOverlayClickThrough(enable: boolean): void {
  isClickThrough = enable;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setIgnoreMouseEvents(enable, { forward: true });
  }
}

export function getOverlayClickThrough(): boolean {
  return isClickThrough;
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}

export function isOverlayVisible(): boolean {
  return Boolean(overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible());
}

export function showOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (overlayWindow.isMinimized()) overlayWindow.restore();
    overlayWindow.show();
    broadcastOverlayVisibility(true);
  } else {
    createOverlayWindow();
  }
}

export function hideOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
    overlayWindow.hide();
    broadcastOverlayVisibility(false);
  }
}
