import path from "path";
import { app, BrowserWindow } from "electron";
import { initLogger, createLogger } from "@echo-lingo/logger";

// Initialize persistent file logging in userData/logs
try {
  const logDir = path.join(app.getPath("userData"), "logs");
  initLogger({ logDir });
} catch {
  // Fallback to default directory if app.getPath is not yet ready
}

const log = createLogger("Main");

process.on("uncaughtException", (err) => {
  log.error("[CRITICAL] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  log.error("[CRITICAL] Unhandled Rejection at:", promise, "reason:", reason);
});

import {
  createMainWindow,
  getMainWindow,
  setIsQuitting,
} from "@/windows/main-window.js";
import {
  getOverlayWindow,
  setOverlayCallbacks,
} from "@/windows/overlay-window.js";
import {
  createSplashWindow,
  updateSplashStatus,
  transitionSplashToMainWindow,
  closeSplashWindow,
} from "@/windows/splash-window.js";
import { registerIpcHandlers } from "@/ipc/ipc-router.js";
import { getShortcutsService } from "@/services/shortcuts-service.js";
import {
  getDatabase,
  initDatabase,
  closeDatabase,
} from "@/database/db-instance.js";
import { getSessionService } from "@/services/session-service.js";
import { getTrayService } from "@/services/tray-service.js";
import { AppSettingsSchema } from "@echo-lingo/contracts";
import { DEFAULT_APP_SETTINGS } from "@echo-lingo/config";
import { dotnetBridge } from "@echo-lingo/dotnet-bridge";

import { setupMediaPermissions } from "@/security/security.js";
import {
  registerMediaSchemeAsPrivileged,
  registerMediaProtocolHandler,
} from "@/media/media-protocol.js";

// Register custom media streaming protocol scheme before app is ready
registerMediaSchemeAsPrivileged();

// Enable Chromium remote debugging in development for VS Code renderer breakpoint attachment
if (!app.isPackaged) {
  app.commandLine.appendSwitch("remote-debugging-port", "9222");
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log.warn("Another instance is already running. Quitting duplicate process.");
  app.quit();
} else {
  app.on("second-instance", () => {
    const mainWin = getMainWindow();
    if (mainWin) {
      if (!mainWin.isVisible()) mainWin.show();
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    }
  });

  app.whenReady().then(async () => {
    if (process.platform === "win32") {
      app.setAppUserModelId("com.echolingo.desktop");
    }

    // 0. Launch splash screen immediately
    createSplashWindow();
    updateSplashStatus({
      message: "Initializing core services...",
      step: 1,
      totalSteps: 4,
      progress: 20,
    });

    // Setup Media Permissions (Microphone & Loopback Display Capture)
    setupMediaPermissions();

    // Register custom media streaming protocol handler for range requests
    registerMediaProtocolHandler();

    // 1. Initialize SQLite database
    updateSplashStatus({
      message: "Connecting local database...",
      step: 2,
      totalSteps: 4,
      progress: 45,
    });
    await initDatabase();

    // 2. Register IPC message channels
    registerIpcHandlers();

    // Evaluate user preference for splash screen
    let enableSplash = true;
    try {
      const db = getDatabase();
      const rawSettings = db.getSetting("app_settings", DEFAULT_APP_SETTINGS);
      const parsed = AppSettingsSchema.safeParse(rawSettings);
      if (parsed.success && parsed.data.enableSplashScreen === false) {
        enableSplash = false;
      }
    } catch {
      // Keep default true
    }

    // 3. Create Main Window (hidden initially if splash is active)
    updateSplashStatus({
      message: "Preparing user interface...",
      step: 3,
      totalSteps: 4,
      progress: 75,
    });
    const mainWin = createMainWindow({ showImmediately: !enableSplash });

    // 4. Connect windows to SessionService
    getSessionService().setWindows(mainWin, getOverlayWindow());
    setOverlayCallbacks({
      onCreated: (win) => {
        getSessionService().setOverlayWindow(win);
        getTrayService().updateTrayMenu();
      },
      onToggled: (win) => {
        getSessionService().setOverlayWindow(win);
        getSessionService().broadcastToOverlay();
        getTrayService().updateTrayMenu();
      },
      onClosed: () => {
        getSessionService().setOverlayWindow(null);
        getTrayService().updateTrayMenu();
      },
    });

    // 5. Register global keyboard shortcuts
    getShortcutsService().register();

    // 6. Initialize System Tray
    getTrayService().initTray();

    // 7. Transition from Splash to Main Window
    if (enableSplash) {
      updateSplashStatus({
        message: "Starting EchoLingo...",
        step: 4,
        totalSteps: 4,
        progress: 95,
      });
      await transitionSplashToMainWindow(mainWin);
    } else {
      await closeSplashWindow();
      if (!mainWin.isVisible()) {
        mainWin.show();
      }
      mainWin.focus();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow({ showImmediately: true });
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

  app.on("before-quit", () => {
    log.info("[App Lifecycle] before-quit event fired");
    setIsQuitting(true);
  });

  app.on("window-all-closed", () => {
    log.info("[App Lifecycle] window-all-closed event fired");
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("will-quit", () => {
    log.info("[App Lifecycle] will-quit event fired");
    getShortcutsService().unregister();
    getTrayService().destroyTray();
    closeDatabase();
    dotnetBridge.dispose().catch((err) => {
      log.warn("Error disposing dotnetBridge:", err);
    });
  });

  app.on("quit", (_event, exitCode) => {
    log.info(`[App Lifecycle] quit event fired with exitCode: ${exitCode}`);
  });

  process.on("exit", (code) => {
    log.info(`[Process Lifecycle] process.exit event with code: ${code}`);
  });
}
