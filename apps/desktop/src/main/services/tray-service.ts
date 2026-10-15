import { Tray, Menu, MenuItemConstructorOptions, NativeImage, nativeImage, app, BrowserWindow } from 'electron';
import zlib from 'zlib';
import { IPC_CHANNELS } from '@echo-lingo/contracts';
import { DEFAULT_APP_SETTINGS } from '@echo-lingo/config';
import { getDatabase } from '@/database/db-instance.js';
import { getSessionService } from '@/services/session-service.js';
import { getScreenTranslationService } from '@/services/screen-translation-service.js';
import { toggleOverlay, getOverlayWindow } from '@/windows/overlay-window.js';
import { createMainWindow, getMainWindow, setIsQuitting } from '@/windows/main-window.js';
import { getAppIconService } from '@/services/app-icon.js';
import { createLogger, ILogger } from '@echo-lingo/logger';

export class TrayService {
  private static instance: TrayService | null = null;
  private tray: Tray | null = null;
  private hasShownTrayBalloon: boolean = false;
  private readonly log: ILogger = createLogger('TrayService');

  public static getInstance(): TrayService {
    if (!TrayService.instance) {
      TrayService.instance = new TrayService();
    }
    return TrayService.instance;
  }

  /**
   * Computes standard CRC-32 for raw PNG chunk payload.
   */
  private crc32(buf: Buffer): number {
    let table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * Creates a valid PNG chunk (Length + Type + Data + CRC32).
   */
  private makePngChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crc = this.crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  /**
   * Generates an in-memory 32x32 RGBA PNG icon of EchoLingo with transparent background.
   * The icon represents a glowing prism badge with a crisp white sparkle in the center.
   */
  public generateTrayIconPng(size = 32): Buffer {
    const width = size;
    const height = size;
    const rawData: number[] = [];

    for (let y = 0; y < height; y++) {
      rawData.push(0); // PNG Filter 0 (None)
      for (let x = 0; x < width; x++) {
        const cx = (width - 1) / 2;
        const cy = (height - 1) / 2;
        const dx = Math.abs(x - cx);
        const dy = Math.abs(y - cy);

        const roundR = size * 0.44;
        const cornerR = size * 0.22;
        const qx = Math.max(dx - (roundR - cornerR), 0);
        const qy = Math.max(dy - (roundR - cornerR), 0);
        const distCorner = Math.sqrt(qx * qx + qy * qy);
        const inBox = distCorner <= cornerR;

        if (!inBox) {
          rawData.push(0, 0, 0, 0); // Transparent
          continue;
        }

        // 4-pointed sparkle emblem in center: |x-cx|^0.65 + |y-cy|^0.65 <= radius
        const sx = Math.abs(x - cx) / (size * 0.35);
        const sy = Math.abs(y - cy) / (size * 0.35);
        const isSparkle = Math.pow(sx, 0.65) + Math.pow(sy, 0.65) <= 1.0;

        if (isSparkle) {
          rawData.push(255, 255, 255, 255); // White sparkle
        } else {
          // Gradient from Blue-600 (#2563EB) to Cyan-400 (#22D3EE)
          const t = (x + y) / ((width + height) * 0.9);
          const r = Math.round(37 * (1 - t) + 6 * t);
          const g = Math.round(99 * (1 - t) + 182 * t);
          const b = Math.round(235 * (1 - t) + 212 * t);
          rawData.push(r, g, b, 255);
        }
      }
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // Bit depth: 8
    ihdr[9] = 6; // Color type: RGBA
    ihdr[10] = 0; // Compression
    ihdr[11] = 0; // Filter
    ihdr[12] = 0; // Interlace

    const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdrChunk = this.makePngChunk('IHDR', ihdr);
    const idatChunk = this.makePngChunk('IDAT', zlib.deflateSync(Buffer.from(rawData)));
    const iendChunk = this.makePngChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([pngSig, ihdrChunk, idatChunk, iendChunk]);
  }

  /**
   * Creates the Tray NativeImage
   */
  public getTrayNativeImage(): NativeImage {
    const customIcon = getAppIconService().getTrayIcon();
    if (customIcon && !customIcon.isEmpty()) {
      return customIcon;
    }
    const pngBuffer = this.generateTrayIconPng(32);
    return nativeImage.createFromBuffer(pngBuffer);
  }

  /**
   * Restores and focuses the main application window
   */
  public showMainWindow(): BrowserWindow {
    let win = getMainWindow();
    if (!win || win.isDestroyed()) {
      win = createMainWindow();
    }
    if (!win.isVisible()) {
      win.show();
    }
    if (win.isMinimized()) {
      win.restore();
    }
    win.focus();
    return win;
  }

  /**
   * Toggles main window visibility between shown/focused and hidden
   */
  public toggleMainWindowVisibility(): void {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) {
      this.showMainWindow();
      return;
    }
    if (win.isVisible() && !win.isMinimized() && win.isFocused()) {
      win.hide();
    } else {
      this.showMainWindow();
    }
  }

  /**
   * Builds the contextual menu for the System Tray icon
   */
  public buildTrayContextMenu(): Menu {
    const sessionService = getSessionService();
    const isListening = sessionService.getActiveSession()?.status === 'active';

    const overlayWin = getOverlayWindow();
    const isOverlayVisible = Boolean(overlayWin && !overlayWin.isDestroyed() && overlayWin.isVisible());

    const screenTranslationService = getScreenTranslationService();
    const isContinuous = screenTranslationService.isContinuousActive();

    const template: MenuItemConstructorOptions[] = [
      {
        label: 'EchoLingo v1.0',
        enabled: false,
        icon: this.getTrayNativeImage().resize({ width: 16, height: 16 }),
      },
      {
        label: 'Open EchoLingo',
        click: () => {
          this.showMainWindow();
        },
      },
      { type: 'separator' },
      {
        label: isListening ? '⏹️ Stop Live Subtitles' : '▶️ Start Live Subtitles',
        click: async () => {
          if (isListening) {
            sessionService.stopSession();
          } else {
            try {
              const db = getDatabase();
              const settings = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
              await sessionService.createSession({
                sourceLanguage: settings.sourceLanguage,
                targetLanguages: settings.targetLanguages,
                speechProvider: settings.speechEngine,
                translationProvider: settings.translationProvider,
                audioSourceType: settings.audioSourceType,
                audioDeviceId: settings.audioDeviceId,
              });
            } catch (err) {
              this.log.error('Error starting live session from tray:', err);
            }
          }
          this.updateTrayMenu();
        },
      },
      {
        label: 'Floating Subtitle Overlay',
        type: 'checkbox',
        checked: isOverlayVisible,
        click: () => {
          toggleOverlay();
          this.updateTrayMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Capture Screen & Translate (Ctrl+Shift+T)',
        click: async () => {
          try {
            await screenTranslationService.selectRegion();
          } catch (err) {
            this.log.error('Error triggering screen capture from tray:', err);
          }
        },
      },
      {
        label: 'Continuous Screen OCR',
        type: 'checkbox',
        checked: isContinuous,
        click: async () => {
          if (isContinuous) {
            screenTranslationService.stopContinuous();
          } else {
            try {
              const region = await screenTranslationService.selectRegion();
              if (region) {
                const db = getDatabase();
                const settings = db.getSetting('app_settings', DEFAULT_APP_SETTINGS);
                screenTranslationService.startContinuous({
                  region,
                  ocrProviderId: settings.screenTranslation.ocrProvider,
                  ocrLanguage: settings.screenTranslation.ocrLanguage,
                  sourceLanguage: settings.sourceLanguage,
                  targetLanguages: settings.targetLanguages,
                  translationProviderId: settings.translationProvider,
                  profile: settings.screenTranslation.profile,
                  ignoreUnchanged: settings.screenTranslation.ignoreUnchanged,
                  translateOnlyDiff: settings.screenTranslation.translateOnlyDiff,
                  intervalMs: settings.screenTranslation.continuousIntervalMs,
                  changeThreshold: settings.screenTranslation.changeThreshold,
                });
              }
            } catch (err) {
              this.log.error('Error toggling continuous OCR from tray:', err);
            }
          }
          this.updateTrayMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Preferences / Settings...',
        click: () => {
          const win = this.showMainWindow();
          if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
            win.webContents.send(IPC_CHANNELS.APP_NAVIGATE_TO, 'settings');
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit EchoLingo',
        click: () => {
          setIsQuitting(true);
          app.quit();
        },
      },
    ];

    return Menu.buildFromTemplate(template);
  }

  /**
   * Initializes the System Tray icon and handlers.
   */
  public initTray(): Tray {
    if (this.tray) {
      return this.tray;
    }

    const icon = this.getTrayNativeImage();
    this.tray = new Tray(icon);
    this.tray.setToolTip('EchoLingo - Real-Time Subtitles & Translation');

    const contextMenu = this.buildTrayContextMenu();
    this.tray.setContextMenu(contextMenu);

    // Left click toggles window
    this.tray.on('click', () => {
      this.toggleMainWindowVisibility();
    });

    // Double click guarantees window shown & focused
    this.tray.on('double-click', () => {
      this.showMainWindow();
    });

    // Right click refreshes menu states and pops up
    this.tray.on('right-click', () => {
      this.updateTrayMenu();
      this.tray?.popUpContextMenu();
    });

    // Listen to session state changes to keep tray menu in sync
    getSessionService().onSessionStateChange(() => {
      this.updateTrayMenu();
    });

    return this.tray;
  }

  /**
   * Updates the context menu with current application runtime state.
   */
  public updateTrayMenu(): void {
    if (!this.tray) return;
    const menu = this.buildTrayContextMenu();
    this.tray.setContextMenu(menu);
  }

  /**
   * Displays a one-time balloon / toast notification when minimized to tray on Windows.
   */
  public notifyMinimizedToTray(): void {
    if (this.hasShownTrayBalloon || !this.tray) return;
    this.hasShownTrayBalloon = true;

    if (process.platform === 'win32') {
      try {
        this.tray.displayBalloon({
          iconType: 'info',
          title: 'EchoLingo',
          content: 'EchoLingo is running in the system tray. Click the icon or use shortcuts anytime.',
        });
      } catch (err) {
        this.log.warn('Could not display tray balloon:', err);
      }
    }
  }

  /**
   * Returns current Tray instance or null
   */
  public getTray(): Tray | null {
    return this.tray;
  }

  /**
   * Destroys the Tray icon on application quit.
   */
  public destroyTray(): void {
    if (this.tray) {
      try {
        this.tray.destroy();
      } catch {
        // Ignore if already destroyed
      }
      this.tray = null;
    }
  }
}

export function getTrayService(): TrayService {
  return TrayService.getInstance();
}
