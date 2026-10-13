import { desktopCapturer, screen, NativeImage, nativeImage } from 'electron';
import {
  DisplayInfo,
  ScreenCaptureRegion,
  OcrPreprocessOptions,
} from '@echo-lingo/contracts';
import {
  toPhysicalCropRect,
  preprocessImage,
  Rect,
} from '@echo-lingo/ocr-core';

export class ScreenCaptureManager {
  /**
   * Enumerates all connected displays with full boundary, work area, and DPI information.
   */
  public getDisplays(): DisplayInfo[] {
    const primary = screen.getPrimaryDisplay();
    const all = screen.getAllDisplays();

    return all.map((d) => ({
      id: d.id,
      name: `Display ${d.id}${d.id === primary.id ? ' (Primary)' : ''}`,
      bounds: {
        x: d.bounds.x,
        y: d.bounds.y,
        width: d.bounds.width,
        height: d.bounds.height,
      },
      workArea: {
        x: d.workArea.x,
        y: d.workArea.y,
        width: d.workArea.width,
        height: d.workArea.height,
      },
      scaleFactor: d.scaleFactor,
      isPrimary: d.id === primary.id,
      rotation: d.rotation,
    }));
  }

  /**
   * Finds a display by ID, or defaults to the primary display.
   */
  public getDisplayById(displayId?: number): Electron.Display {
    if (displayId !== undefined) {
      const found = screen.getAllDisplays().find((d) => d.id === displayId);
      if (found) return found;
    }
    return screen.getPrimaryDisplay();
  }

  /**
   * Captures the full snapshot of the target display at native physical resolution.
   */
  public async captureDisplay(display: Electron.Display): Promise<NativeImage> {
    const scaleFactor = display.scaleFactor || 1;
    const physWidth = Math.round(display.bounds.width * scaleFactor);
    const physHeight = Math.round(display.bounds.height * scaleFactor);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: physWidth,
        height: physHeight,
      },
    });

    if (sources.length === 0) {
      throw new Error('No desktop screen capture sources available.');
    }

    // Match source by display_id if available, otherwise match by name or fallback
    const targetDisplayIdStr = display.id.toString();
    let source = sources.find((s) => s.display_id === targetDisplayIdStr);

    if (!source) {
      // Fallback: match by index or take first source
      const allDisplays = screen.getAllDisplays();
      const displayIndex = allDisplays.findIndex((d) => d.id === display.id);
      if (displayIndex >= 0 && displayIndex < sources.length) {
        source = sources[displayIndex];
      } else {
        source = sources[0];
      }
    }

    return source.thumbnail;
  }

  /**
   * Captures and crops a specific region from a display, applying coordinate mapping
   * and optional image preprocessing.
   */
  public async captureRegion(
    region: ScreenCaptureRegion,
    preprocessOptions?: OcrPreprocessOptions
  ): Promise<{
    buffer: Buffer;
    dataUrl: string;
    physicalCrop: Rect;
    scaleFactor: number;
  }> {
    const display = this.getDisplayById(region.displayId);
    const scaleFactor = display.scaleFactor || 1;

    // 1. Capture full display screenshot
    const fullScreenshot = await this.captureDisplay(display);
    const fullSize = fullScreenshot.getSize();

    // 2. Map logical coordinates to physical crop rectangle with edge clamping
    const physicalCrop = toPhysicalCropRect(
      {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
      },
      display.bounds,
      scaleFactor,
      fullSize.width,
      fullSize.height
    );

    // 3. Crop NativeImage
    let cropped = fullScreenshot.crop(physicalCrop);

    // 4. Optional image preprocessing (e.g. binarize, upscale, contrast stretch)
    if (preprocessOptions && preprocessOptions.profile !== 'none') {
      try {
        const cropSize = cropped.getSize();
        const rawBitmap = cropped.toBitmap();
        const preprocessed = preprocessImage(
          {
            data: new Uint8Array(rawBitmap),
            width: cropSize.width,
            height: cropSize.height,
          },
          preprocessOptions
        );

        cropped = nativeImage.createFromBitmap(Buffer.from(preprocessed.data), {
          width: preprocessed.width,
          height: preprocessed.height,
        });
      } catch (err) {
        console.warn('[ScreenCaptureManager] Preprocessing failed, using original crop:', err);
      }
    }

    const pngBuffer = cropped.toPNG();
    const dataUrl = cropped.toDataURL();

    return {
      buffer: pngBuffer,
      dataUrl,
      physicalCrop,
      scaleFactor,
    };
  }
}

let captureManagerInstance: ScreenCaptureManager | null = null;
export function getScreenCaptureManager(): ScreenCaptureManager {
  if (!captureManagerInstance) {
    captureManagerInstance = new ScreenCaptureManager();
  }
  return captureManagerInstance;
}
