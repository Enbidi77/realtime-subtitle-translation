import { app, nativeImage, NativeImage } from 'electron';
import path from 'path';
import fs from 'fs';

export class AppIconService {
  private static instance: AppIconService | null = null;
  private cachedIcon: NativeImage | null = null;
  private cachedTrayIcon: NativeImage | null = null;

  public static getInstance(): AppIconService {
    if (!AppIconService.instance) {
      AppIconService.instance = new AppIconService();
    }
    return AppIconService.instance;
  }

  /**
   * Returns the path to the main application icon file
   */
  public getAppIconPath(): string {
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
  public getAppIcon(): NativeImage | undefined {
    if (this.cachedIcon) {
      return this.cachedIcon;
    }
    const iconPath = this.getAppIconPath();
    if (iconPath) {
      this.cachedIcon = nativeImage.createFromPath(iconPath);
      if (!this.cachedIcon.isEmpty()) {
        return this.cachedIcon;
      }
    }
    return undefined;
  }

  /**
   * Returns the path to the system tray icon file
   */
  public getTrayIconPath(): string {
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
  public getTrayIcon(): NativeImage | undefined {
    if (this.cachedTrayIcon) {
      return this.cachedTrayIcon;
    }
    const trayPath = this.getTrayIconPath();
    if (trayPath) {
      this.cachedTrayIcon = nativeImage.createFromPath(trayPath);
      if (!this.cachedTrayIcon.isEmpty()) {
        return this.cachedTrayIcon;
      }
    }
    return undefined;
  }

  /**
   * Clears any cached NativeImage icon instances
   */
  public clearCache(): void {
    this.cachedIcon = null;
    this.cachedTrayIcon = null;
  }
}

export function getAppIconService(): AppIconService {
  return AppIconService.getInstance();
}
