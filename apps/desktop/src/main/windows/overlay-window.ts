import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import { setupSecurityPolicies } from '../security/security.js';
import { getMainWindow } from './main-window.js';
import { IPC_CHANNELS } from '@echo-lingo/contracts';

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
    console.error('[OverlayWindow] Error broadcasting visibility:', err);
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

  const defaultWidth = 840;
  const defaultHeight = 150;
  // Position by default at the bottom center of the screen within active work area
  const defaultX = Math.round(workArea.x + (workArea.width - defaultWidth) / 2);
  const defaultY = Math.round(workArea.y + workArea.height - defaultHeight - 50);

  overlayWindow = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    x: defaultX,
    y: defaultY,
    minWidth: 400,
    minHeight: 80,
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
    console.log(`[OverlayWindow] Loading dev URL: ${process.env['ELECTRON_RENDERER_URL']}/overlay.html`);
    overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay.html`);
  } else {
    console.log('[OverlayWindow] Loading production overlay.html');
    overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay.html'));
  }

  overlayWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    console.log(`[Overlay ${levels[level] || level}] ${message} (${sourceId}:${line})`);
  });

  overlayWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Overlay] Render process gone:', details);
  });

  overlayWindow.webContents.on('did-finish-load', () => {
    console.log('[OverlayWindow] Did finish load successfully.');
    if (onOverlayToggled && overlayWindow && !overlayWindow.isDestroyed()) {
      onOverlayToggled(overlayWindow);
    }
  });

  overlayWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[OverlayWindow] Failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`);
  });

  overlayWindow.on('closed', () => {
    console.log('[OverlayWindow] Overlay window closed.');
    broadcastOverlayVisibility(false);
    if (onOverlayClosed) onOverlayClosed();
    overlayWindow = null;
  });

  if (onOverlayCreated) onOverlayCreated(overlayWindow);

  return overlayWindow;
}

export function toggleOverlay(): boolean {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    console.log('[OverlayWindow] Creating and displaying overlay window...');
    createOverlayWindow();
    overlayWindow?.show();
    overlayWindow?.focus();
    broadcastOverlayVisibility(true);
    if (onOverlayToggled && overlayWindow) onOverlayToggled(overlayWindow);
    return true;
  }

  if (overlayWindow.isVisible()) {
    console.log('[OverlayWindow] Hiding overlay window...');
    overlayWindow.hide();
    broadcastOverlayVisibility(false);
    return false;
  } else {
    console.log('[OverlayWindow] Restoring and displaying existing overlay window...');
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

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}
