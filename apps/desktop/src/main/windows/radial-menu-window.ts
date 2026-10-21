import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import { setupSecurityPolicies } from '@/security/security.js';
import { getAppIconService } from '@/services/app-icon.js';
import { IPC_CHANNELS, RadialMenuState } from '@echo-lingo/contracts';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('RadialMenuWindow');

let radialWindow: BrowserWindow | null = null;

export function createRadialMenuWindow(): BrowserWindow {
  if (radialWindow && !radialWindow.isDestroyed()) {
    return radialWindow;
  }

  const defaultW = 560;
  const defaultH = 560;

  radialWindow = new BrowserWindow({
    title: 'EchoLingo Radial Menu',
    width: defaultW,
    height: defaultH,
    minWidth: 480,
    minHeight: 480,
    maxWidth: 720,
    maxHeight: 720,
    icon: getAppIconService().getAppIcon(),
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === 'darwin') {
    radialWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    radialWindow.setAlwaysOnTop(true, 'screen-saver');
  } else {
    radialWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  setupSecurityPolicies(radialWindow.webContents);

  radialWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
    const tag = `[RadialMenu ${levels[level] || level}] (${sourceId}:${line})`;
    if (level === 3) log.error(`${tag} ${message}`);
    else if (level === 2) log.warn(`${tag} ${message}`);
    else if (level === 0) log.debug(`${tag} ${message}`);
    else log.info(`${tag} ${message}`);
  });

  const isDev = !app.isPackaged;
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    radialWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/radial-menu.html`);
  } else {
    radialWindow.loadFile(path.join(__dirname, '../renderer/radial-menu.html'));
  }

  radialWindow.on('blur', () => {
    // Automatically hide radial menu when focus is lost
    hideRadialMenu();
  });

  radialWindow.on('closed', () => {
    radialWindow = null;
  });

  return radialWindow;
}

export function showRadialMenu(state?: RadialMenuState): void {
  const win = radialWindow && !radialWindow.isDestroyed() ? radialWindow : createRadialMenuWindow();

  // Position center at current mouse position
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const [w, h] = win.getSize();

  let x = Math.round(cursor.x - w / 2);
  let y = Math.round(cursor.y - h / 2);

  // Clamp within the nearest display's work area
  const margin = 8;
  const minX = display.workArea.x + margin;
  const maxX = display.workArea.x + display.workArea.width - w - margin;
  const minY = display.workArea.y + margin;
  const maxY = display.workArea.y + display.workArea.height - h - margin;

  x = Math.max(minX, Math.min(x, maxX));
  y = Math.max(minY, Math.min(y, maxY));

  win.setPosition(x, y);
  win.show();
  win.focus();

  try {
    win.webContents.send('radial-menu:opened');
  } catch {
    // webContents not ready yet
  }

  if (state) {
    sendRadialMenuState(state);
  }
}

export function hideRadialMenu(): void {
  if (radialWindow && !radialWindow.isDestroyed() && radialWindow.isVisible()) {
    radialWindow.hide();
  }
}

export function toggleRadialMenu(state?: RadialMenuState): boolean {
  if (radialWindow && !radialWindow.isDestroyed() && radialWindow.isVisible()) {
    hideRadialMenu();
    return false;
  } else {
    showRadialMenu(state);
    return true;
  }
}

export function isRadialMenuVisible(): boolean {
  return Boolean(radialWindow && !radialWindow.isDestroyed() && radialWindow.isVisible());
}

export function getRadialMenuWindow(): BrowserWindow | null {
  return radialWindow;
}

export function sendRadialMenuState(state: RadialMenuState): void {
  if (radialWindow && !radialWindow.isDestroyed() && !radialWindow.webContents.isDestroyed()) {
    try {
      radialWindow.webContents.send(IPC_CHANNELS.RADIAL_MENU_STATE_STREAM, state);
    } catch (err) {
      log.warn('Failed to send radial menu state:', err);
    }
  }
}

