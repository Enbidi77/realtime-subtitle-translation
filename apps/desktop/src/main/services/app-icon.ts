import { app, nativeImage, NativeImage } from 'electron';
import path from 'path';
import fs from 'fs';

let cachedIcon: NativeImage | null = null;
let cachedTrayIcon: NativeImage | null = null;

/**
 * Returns the path to the main application icon file
 */
export function getAppIconPath(): string {
  const candidates = [
    path.join(app.getAppPath(), 'resources/icon.png'),
    path.join(app.getAppPath(), 'resources/icon.ico'),
    path.join(__dirname, '../../resources/icon.png'),
    path.join(__dirname, '../../build/icon.ico'),
    path.join(process.resourcesPath, 'resources/icon.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return '';
}

/**
 * Returns the Electron NativeImage for the main application icon
 */
export function getAppIcon(): NativeImage | undefined {
  if (cachedIcon) {
    return cachedIcon;
  }
  const iconPath = getAppIconPath();
  if (iconPath) {
    cachedIcon = nativeImage.createFromPath(iconPath);
    if (!cachedIcon.isEmpty()) {
      return cachedIcon;
    }
  }
  return undefined;
}

/**
 * Returns the path to the system tray icon file
 */
export function getTrayIconPath(): string {
  const candidates = [
    path.join(app.getAppPath(), 'resources/icon-32.png'),
    path.join(__dirname, '../../resources/icon-32.png'),
    path.join(process.resourcesPath, 'resources/icon-32.png'),
    path.join(app.getAppPath(), 'resources/icon.png'),
    path.join(__dirname, '../../resources/icon.png'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return '';
}

/**
 * Returns the Electron NativeImage for the system tray icon
 */
export function getTrayIcon(): NativeImage | undefined {
  if (cachedTrayIcon) {
    return cachedTrayIcon;
  }
  const trayPath = getTrayIconPath();
  if (trayPath) {
    cachedTrayIcon = nativeImage.createFromPath(trayPath);
    if (!cachedTrayIcon.isEmpty()) {
      return cachedTrayIcon;
    }
  }
  return undefined;
}

