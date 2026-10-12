import { globalShortcut } from "electron";
import { toggleOverlay } from "@/windows/overlay-window.js";
import { getSessionService } from "@/services/session-service.js";

export function registerGlobalShortcuts(): void {
  try {
    // Toggle overlay window
    globalShortcut.register("CommandOrControl+Shift+O", () => {
      toggleOverlay();
    });

    // Pause/Resume active session
    globalShortcut.register("CommandOrControl+Shift+P", () => {
      const sessionService = getSessionService();
      const active = sessionService.getActiveSession();
      if (active) {
        if (active.status === "active") {
          sessionService.pauseSession();
        } else if (active.status === "paused") {
          sessionService.resumeSession();
        }
      }
    });
  } catch (err) {
    console.warn("[Shortcuts] Could not register some global shortcuts:", err);
  }
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}
