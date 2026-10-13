import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import { FloatingPanelPayload, IPC_CHANNELS } from '@echo-lingo/contracts';
import { calculateFloatingPanelPosition } from '@echo-lingo/ocr-core';
import { setupSecurityPolicies } from '@/security/security.js';

let panelWindow: BrowserWindow | null = null;
let currentPayload: FloatingPanelPayload | null = null;

export function createOcrPanelWindow(): BrowserWindow {
  if (panelWindow && !panelWindow.isDestroyed()) {
    return panelWindow;
  }

  const primary = screen.getPrimaryDisplay();
  const defaultW = 440;
  const defaultH = 260;

  panelWindow = new BrowserWindow({
    width: defaultW,
    height: defaultH,
    minWidth: 320,
    minHeight: 180,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform === 'darwin') {
    panelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    panelWindow.setAlwaysOnTop(true, 'floating');
  } else {
    panelWindow.setAlwaysOnTop(true);
  }

  setupSecurityPolicies(panelWindow.webContents);

  const isDev = !app.isPackaged;
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    panelWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/ocr-panel.html`);
  } else {
    panelWindow.loadFile(path.join(__dirname, '../renderer/ocr-panel.html'));
  }

  panelWindow.webContents.on('did-finish-load', () => {
    if (currentPayload && panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send(IPC_CHANNELS.SCREEN_FLOATING_PANEL_STREAM, currentPayload);
    }
  });

  panelWindow.on('closed', () => {
    panelWindow = null;
  });

  return panelWindow;
}

export function showOcrFloatingPanel(payload: FloatingPanelPayload): void {
  currentPayload = payload;
  const win = panelWindow && !panelWindow.isDestroyed() ? panelWindow : createOcrPanelWindow();

  // If a region was provided, calculate optimal placement near region
  if (payload.region) {
    const allDisplays = screen.getAllDisplays();
    const display =
      allDisplays.find((d) => d.id === payload.region!.displayId) || screen.getPrimaryDisplay();

    const [curW, curH] = win.getSize();
    const pos = calculateFloatingPanelPosition(
      {
        x: payload.region.x,
        y: payload.region.y,
        width: payload.region.width,
        height: payload.region.height,
      },
      display.bounds,
      display.workArea,
      { width: curW, height: curH }
    );

    win.setPosition(pos.x, pos.y);
  }

  win.show();
  win.focus();

  if (!win.webContents.isLoading()) {
    win.webContents.send(IPC_CHANNELS.SCREEN_FLOATING_PANEL_STREAM, payload);
  }
}

export function hideOcrFloatingPanel(): void {
  if (panelWindow && !panelWindow.isDestroyed() && panelWindow.isVisible()) {
    panelWindow.hide();
  }
}

export function isOcrFloatingPanelVisible(): boolean {
  return Boolean(panelWindow && !panelWindow.isDestroyed() && panelWindow.isVisible());
}
