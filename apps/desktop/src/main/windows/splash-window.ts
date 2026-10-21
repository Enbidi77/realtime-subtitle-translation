import { BrowserWindow, app } from "electron";
import path from "path";
import { setupSecurityPolicies } from "@/security/security.js";
import { getAppIconService } from "@/services/app-icon.js";
import { IPC_CHANNELS, SplashStatusEvent } from "@echo-lingo/contracts";
import { createLogger } from "@echo-lingo/logger";

const log = createLogger("SplashWindow");

let splashWindow: BrowserWindow | null = null;
let splashStartTime = 0;

/**
 * Creates and displays the frameless glassmorphic splash screen window.
 */
export function createSplashWindow(): BrowserWindow {
  if (splashWindow && !splashWindow.isDestroyed()) {
    return splashWindow;
  }

  splashStartTime = Date.now();

  splashWindow = new BrowserWindow({
    title: "EchoLingo",
    width: 480,
    height: 300,
    minWidth: 480,
    minHeight: 300,
    maxWidth: 480,
    maxHeight: 300,
    center: true,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    icon: getAppIconService().getAppIcon(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  setupSecurityPolicies(splashWindow.webContents);

  splashWindow.on("ready-to-show", () => {
    log.info("Splash window ready to show, displaying...");
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show();
    }
  });

  const isDev = !app.isPackaged;
  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    log.info(
      `Loading dev URL: ${process.env["ELECTRON_RENDERER_URL"]}/splash.html`,
    );
    splashWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/splash.html`);
  } else {
    log.info("Loading production splash.html");
    splashWindow.loadFile(path.join(__dirname, "../renderer/splash.html"));
  }

  splashWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      log.error(
        `Splash failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`,
      );
    },
  );

  splashWindow.on("closed", () => {
    splashWindow = null;
  });

  return splashWindow;
}

/**
 * Sends a status update event to the splash screen renderer.
 */
export function updateSplashStatus(status: SplashStatusEvent): void {
  try {
    if (
      splashWindow &&
      !splashWindow.isDestroyed() &&
      !splashWindow.webContents.isDestroyed()
    ) {
      splashWindow.webContents.send(IPC_CHANNELS.SPLASH_STATUS_STREAM, status);
    }
  } catch (err) {
    log.warn("Failed to send splash status:", err);
  }
}

/**
 * Closes the splash window with a graceful fade-out transition.
 */
export async function closeSplashWindow(): Promise<void> {
  if (!splashWindow || splashWindow.isDestroyed()) {
    splashWindow = null;
    return;
  }

  const win = splashWindow;
  splashWindow = null;

  try {
    for (let opacity = 1.0; opacity > 0; opacity -= 0.25) {
      if (!win.isDestroyed()) {
        win.setOpacity(opacity);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    if (!win.isDestroyed()) {
      win.close();
    }
  } catch {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
}

/**
 * Returns the active splash window instance, or null if not created/closed.
 */
export function getSplashWindow(): BrowserWindow | null {
  return splashWindow;
}

/**
 * Smoothly transitions from the splash screen to the main window.
 * Ensures the splash screen was visible for at least minDurationMs,
 * waits for the main window to be ready-to-show, reveals and focuses the main window,
 * and fades out the splash window.
 */
export async function transitionSplashToMainWindow(
  mainWin: BrowserWindow,
  minDurationMs = 2400,
): Promise<void> {
  // 1. Wait for MainWindow to reach ready-to-show or timeout
  if (mainWin && !mainWin.isDestroyed()) {
    await new Promise<void>((resolve) => {
      let resolved = false;

      const onReadyToShow = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      if (!mainWin.webContents.isLoading()) {
        // If already loaded
        resolved = true;
        resolve();
        return;
      }

      mainWin.once("ready-to-show", onReadyToShow);

      // Failsafe timeout after 8 seconds
      setTimeout(() => {
        if (!resolved) {
          log.warn(
            "Timeout waiting for MainWindow ready-to-show; proceeding with transition.",
          );
          resolved = true;
          mainWin.removeListener("ready-to-show", onReadyToShow);
          resolve();
        }
      }, 8000);
    });
  }

  // 2. Ensure minimum splash screen display time for consistent polish
  const elapsed = Date.now() - splashStartTime;
  const remaining = Math.max(0, minDurationMs - elapsed);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }

  // 3. Mark splash as complete
  updateSplashStatus({
    message: "Ready!",
    step: 4,
    totalSteps: 4,
    progress: 100,
  });
  await new Promise((resolve) => setTimeout(resolve, 150));

  // 4. Reveal and focus MainWindow
  if (mainWin && !mainWin.isDestroyed()) {
    if (!mainWin.isVisible()) {
      mainWin.show();
    }
    if (mainWin.isMinimized()) {
      mainWin.restore();
    }
    mainWin.focus();
  }

  // 5. Close Splash Window
  await closeSplashWindow();
}
