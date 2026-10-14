import { app, BrowserWindow } from 'electron';

process.on('uncaughtException', (err) => {
  console.error('[Main CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

import { createMainWindow, getMainWindow, setIsQuitting } from '@/windows/main-window.js';
import { getOverlayWindow, setOverlayCallbacks } from '@/windows/overlay-window.js';
import { registerIpcHandlers } from '@/ipc/ipc-router.js';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from '@/services/shortcuts-service.js';
import { getDatabase, initDatabase, closeDatabase } from '@/database/db-instance.js';
import { getSessionService } from '@/services/session-service.js';
import { initTray, destroyTray, updateTrayMenu } from '@/services/tray-service.js';

import { setupMediaPermissions } from '@/security/security.js';

// Enable Chromium remote debugging in development for VS Code renderer breakpoint attachment
if (!app.isPackaged) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.warn('[EchoLingo] Another instance is already running. Quitting duplicate process.');
  app.quit();
} else {
  app.on('second-instance', () => {
    const mainWin = getMainWindow();
    if (mainWin) {
      if (!mainWin.isVisible()) mainWin.show();
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    }
  });

  app.whenReady().then(async () => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.echolingo.desktop');
    }

    // 0. Setup Media Permissions (Microphone & Loopback Display Capture)
    setupMediaPermissions();

    // 1. Initialize SQLite database
    await initDatabase();

    // 2. Register IPC message channels
    registerIpcHandlers();

    // 3. Create Main Window
    const mainWin = createMainWindow();

    // 4. Connect windows to SessionService
    getSessionService().setWindows(mainWin, getOverlayWindow());
    setOverlayCallbacks({
      onCreated: (win) => {
        getSessionService().setOverlayWindow(win);
        updateTrayMenu();
      },
      onToggled: (win) => {
        getSessionService().setOverlayWindow(win);
        getSessionService().broadcastToOverlay();
        updateTrayMenu();
      },
      onClosed: () => {
        getSessionService().setOverlayWindow(null);
        updateTrayMenu();
      },
    });

    // 5. Register global keyboard shortcuts
    registerGlobalShortcuts();

    // 6. Initialize System Tray
    initTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else {
        const win = getMainWindow();
        if (win) {
          if (!win.isVisible()) win.show();
          if (win.isMinimized()) win.restore();
          win.focus();
        }
      }
    });
  });

  app.on('before-quit', () => {
    console.log('[App Lifecycle] before-quit event fired');
    setIsQuitting(true);
  });

  app.on('window-all-closed', () => {
    console.log('[App Lifecycle] window-all-closed event fired');
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    console.log('[App Lifecycle] will-quit event fired');
    unregisterGlobalShortcuts();
    destroyTray();
    closeDatabase();
  });

  app.on('quit', (_event, exitCode) => {
    console.log(`[App Lifecycle] quit event fired with exitCode: ${exitCode}`);
  });

  process.on('exit', (code) => {
    console.log(`[Process Lifecycle] process.exit event with code: ${code}`);
  });
}
