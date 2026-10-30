import { describe, it, expect, vi } from 'vitest';
import {
  toPhysicalCropRect,
  virtualToDisplayLocal,
  displayLocalToVirtual,
  cropPhysicalToDisplayLocal,
  calculateFloatingPanelPosition,
} from '@echo-lingo/ocr-core/coordinate-converter.js';
import {
  grayscale,
  contrastStretch,
  binarize,
  invert,
  scaleImage,
  preprocessImage,
  denoise,
  adaptiveThreshold,
  morphologyClose,
} from '@echo-lingo/ocr-core/image-processor.js';
import {
  normalizeOcrText,
  normalizeOcrResponse,
} from '@echo-lingo/ocr-core/ocr-normalizer.js';
import {
  calculateSimilarity,
  isMeaningfulChange,
  extractAddedLines,
} from '@echo-lingo/ocr-core/text-deduplicator.js';
import { ContinuousOcrScheduler } from '@echo-lingo/ocr-core/continuous-scheduler.js';

describe('OCR Core: Coordinate Converter', () => {
  it('converts display-local selection to physical crop coordinates with scaleFactor 1.5', () => {
    const displayBounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const selection = { x: 100, y: 200, width: 300, height: 150 };
    const scaleFactor = 1.5;

    const crop = toPhysicalCropRect(selection, displayBounds, scaleFactor);
    expect(crop.x).toBe(150);
    expect(crop.y).toBe(300);
    expect(crop.width).toBe(450);
    expect(crop.height).toBe(225);
  });

  it('handles reverse drag selections (negative width and height)', () => {
    const displayBounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const selection = { x: 400, y: 350, width: -300, height: -150 };
    const scaleFactor = 1.0;

    const crop = toPhysicalCropRect(selection, displayBounds, scaleFactor);
    expect(crop.x).toBe(100);
    expect(crop.y).toBe(200);
    expect(crop.width).toBe(300);
    expect(crop.height).toBe(150);
  });

  it('clamps selection coordinates extending beyond physical image bounds', () => {
    const displayBounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const selection = { x: 1800, y: 1000, width: 300, height: 200 };
    const scaleFactor = 1.0;
    const screenshotW = 1920;
    const screenshotH = 1080;

    const crop = toPhysicalCropRect(selection, displayBounds, scaleFactor, screenshotW, screenshotH);
    expect(crop.x).toBe(1800);
    expect(crop.y).toBe(1000);
    expect(crop.x + crop.width).toBeLessThanOrEqual(screenshotW);
    expect(crop.y + crop.height).toBeLessThanOrEqual(screenshotH);
  });

  it('handles negative virtual desktop coordinates on secondary monitor', () => {
    const secondaryDisplay = { x: -1920, y: 0, width: 1920, height: 1080 };
    const mouseGlobal = { x: -1500, y: 300 };

    const local = virtualToDisplayLocal(mouseGlobal, secondaryDisplay);
    expect(local.x).toBe(420);
    expect(local.y).toBe(300);

    const backToGlobal = displayLocalToVirtual(local, secondaryDisplay);
    expect(backToGlobal).toEqual(mouseGlobal);
  });

  it('converts crop physical bounding box back to display-local coordinates', () => {
    const cropOrigin = { x: 100, y: 200 };
    const scaleFactor = 2.0;
    const cropPhysicalBox = { x: 50, y: 60, width: 100, height: 40 };

    const localBox = cropPhysicalToDisplayLocal(cropPhysicalBox, cropOrigin, scaleFactor);
    expect(localBox.x).toBe(125);
    expect(localBox.y).toBe(230);
    expect(localBox.width).toBe(50);
    expect(localBox.height).toBe(20);
  });

  it('calculates floating panel position and avoids overflowing work area', () => {
    const displayBounds = { x: 0, y: 0, width: 1920, height: 1080 };
    const workArea = { x: 0, y: 0, width: 1920, height: 1040 };
    const panelSize = { width: 400, height: 200 };

    // Case 1: Selection in middle -> panel placed below
    const midSelection = { x: 500, y: 300, width: 200, height: 100 };
    const pos1 = calculateFloatingPanelPosition(midSelection, displayBounds, workArea, panelSize);
    expect(pos1.y).toBe(410); // 300 + 100 + 10

    // Case 2: Selection at very bottom -> panel placed above to prevent overflow
    const bottomSelection = { x: 500, y: 950, width: 200, height: 50 };
    const pos2 = calculateFloatingPanelPosition(bottomSelection, displayBounds, workArea, panelSize);
    expect(pos2.y).toBe(950 - 200 - 10);
    expect(pos2.y).toBeLessThan(950);
  });
});

describe('OCR Core: Image Processor', () => {
  it('converts RGBA pixels to grayscale accurately', () => {
    // Single red pixel: RGBA = (255, 0, 0, 255)
    // Lum = round(0.299 * 255) = 76
    const src = new Uint8Array([255, 0, 0, 255]);
    const gray = grayscale(src);
    expect(gray[0]).toBe(76);
    expect(gray[1]).toBe(76);
    expect(gray[2]).toBe(76);
    expect(gray[3]).toBe(255);
  });

  it('stretches contrast across low-contrast pixels', () => {
    // 2 pixels with low contrast: 100 and 150
    const src = new Uint8Array([100, 100, 100, 255, 150, 150, 150, 255]);
    const stretched = contrastStretch(src);
    expect(stretched[0]).toBe(0);
    expect(stretched[4]).toBe(255);
  });

  it('binarizes pixels using thresholding', () => {
    const src = new Uint8Array([50, 50, 50, 255, 200, 200, 200, 255]);
    const binary = binarize(src, 128);
    expect(binary[0]).toBe(0);
    expect(binary[4]).toBe(255);
  });

  it('inverts pixel values correctly', () => {
    const src = new Uint8Array([0, 50, 255, 255]);
    const inv = invert(src);
    expect(inv[0]).toBe(255);
    expect(inv[1]).toBe(205);
    expect(inv[2]).toBe(0);
    expect(inv[3]).toBe(255);
  });

  it('scales 2x2 image to 4x4 using bilinear scaling', () => {
    const src = new Uint8Array(2 * 2 * 4).fill(100);
    const scaled = scaleImage(src, 2, 2, 2);
    expect(scaled.width).toBe(4);
    expect(scaled.height).toBe(4);
    expect(scaled.data.length).toBe(4 * 4 * 4);
  });

  it('applies game-subtitles preset with binarization', () => {
    const src = new Uint8Array([30, 30, 30, 255, 240, 240, 240, 255]);
    const res = preprocessImage(
      { data: src, width: 2, height: 1 },
      {
        profile: 'game-subtitles',
        grayscale: true,
        contrastStretch: true,
        binarize: true,
        invert: false,
        scale: 1,
        adaptiveThreshold: false,
        morphologyClose: false,
        denoise: false,
      }
    );
    expect(res.data[0]).toBe(0);
    expect(res.data[4]).toBe(255);
  });

  it('denoises image removing isolated salt-and-pepper noise', () => {
    // 3x3 image with background 200 and a noisy center spike 20
    const w = 3;
    const h = 3;
    const src = new Uint8Array(w * h * 4).fill(200);
    // Center pixel (1, 1) is corrupted with noise (0)
    const centerIdx = (1 * w + 1) * 4;
    src[centerIdx] = 0;
    src[centerIdx + 1] = 0;
    src[centerIdx + 2] = 0;

    const filtered = denoise(src, w, h);
    // Median filter should replace the noisy center pixel with 200
    expect(filtered[centerIdx]).toBe(200);
  });

  it('performs adaptive thresholding for uneven lighting and shadows', () => {
    const w = 16;
    const h = 16;
    const src = new Uint8Array(w * h * 4).fill(200); // Light paper background

    // Draw a dark ink stroke at row 8, columns 4..12 (lum = 30)
    for (let x = 4; x <= 12; x++) {
      const idx = (8 * w + x) * 4;
      src[idx] = 30;
      src[idx + 1] = 30;
      src[idx + 2] = 30;
    }

    const binarized = adaptiveThreshold(src, w, h);
    // The ink stroke pixels should be classified as ink (0)
    expect(binarized[(8 * w + 8) * 4]).toBe(0);
    // Background pixels should be classified as paper (255)
    expect(binarized[(2 * w + 2) * 4]).toBe(255);
  });

  it('performs morphological closing to connect broken ink strokes', () => {
    // 5x5 image with dark ink line having a 1-pixel gap at (2, 2)
    const w = 5;
    const h = 5;
    const src = new Uint8Array(w * h * 4).fill(255); // White background

    // Horizontal line on row 2, except pixel (2, 2)
    for (let x = 0; x < 5; x++) {
      if (x !== 2) {
        const idx = (2 * w + x) * 4;
        src[idx] = 0;
        src[idx + 1] = 0;
        src[idx + 2] = 0;
      }
    }

    const closed = morphologyClose(src, w, h);
    // The broken gap at (2, 2) should now be closed (ink = 0)
    expect(closed[(2 * w + 2) * 4]).toBe(0);
  });

  it('applies handwritten preset with adaptive threshold and morphological closure', () => {
    const w = 16;
    const h = 16;
    const src = new Uint8Array(w * h * 4).fill(180);

    // Draw ink mark
    for (let x = 6; x <= 10; x++) {
      const idx = (8 * w + x) * 4;
      src[idx] = 40;
      src[idx + 1] = 40;
      src[idx + 2] = 40;
    }

    const res = preprocessImage(
      { data: src, width: w, height: h },
      {
        profile: 'handwritten',
        grayscale: true,
        contrastStretch: true,
        binarize: true,
        invert: false,
        scale: 2,
        adaptiveThreshold: true,
        morphologyClose: true,
        denoise: true,
      }
    );

    // Upscaled from 16x16 to 32x32
    expect(res.width).toBe(32);
    expect(res.height).toBe(32);
    expect(res.data.length).toBe(32 * 32 * 4);
  });
});

describe('OCR Core: Text Normalizer', () => {
  it('cleans non-printable control chars and collapses whitespace', () => {
    const input = 'Hello \x07world!   This   is   a    test.\r\nNext   line.';
    const normalized = normalizeOcrText(input);
    expect(normalized).toBe('Hello world! This is a test.\nNext line.');
  });

  it('collapses spaces between CJK characters and punctuation while keeping Latin spacing', () => {
    const chineseSpaced = '星 期 二 下 午 , 在 学 校 里 薛 年 丰 非 常 高 兴 。';
    const normalized = normalizeOcrText(chineseSpaced);
    expect(normalized).toBe('星期二下午, 在学校里薛年丰非常高兴。');

    const mixed = 'iPhone 16 是 一 款 新 手 机';
    const normalizedMixed = normalizeOcrText(mixed);
    expect(normalizedMixed).toBe('iPhone 16 是一款新手机');
  });

  it('removes adjacent duplicate lines from rolling screen text', () => {
    const input = 'Subtitles Line 1\nSubtitles Line 1\nSubtitles Line 2\nSubtitles Line 2\nSubtitles Line 3';
    const normalized = normalizeOcrText(input, { removeAdjacentDuplicates: true });
    expect(normalized).toBe('Subtitles Line 1\nSubtitles Line 2\nSubtitles Line 3');
  });

  it('normalizes full OcrResponse and calculates average confidence', () => {
    const raw = {
      text: 'Sample recognized text',
      lines: [
        { text: 'Sample', confidence: 0.9 },
        { text: 'recognized text', confidence: 0.8 },
      ],
      providerId: 'mock',
    };
    const res = normalizeOcrResponse(raw);
    expect(res.text).toBe('Sample recognized text');
    expect(res.confidence).toBe(0.85);
  });
});

describe('OCR Core: Text Deduplicator', () => {
  it('calculates similarity accurately', () => {
    expect(calculateSimilarity('hello world', 'hello world')).toBe(1.0);
    expect(calculateSimilarity('hello', 'hallo')).toBe(0.8);
    expect(calculateSimilarity('', '')).toBe(1.0);
  });

  it('detects meaningful changes vs minor noise', () => {
    // Unchanged identical text -> false
    expect(isMeaningfulChange('Save Game', 'Save Game')).toBe(false);

    // Minor case / whitespace change -> false
    expect(isMeaningfulChange('Save Game', '  save game  ')).toBe(false);

    // Completely new sentence -> true
    expect(isMeaningfulChange('Level 1 completed', 'Boss fight starts now!')).toBe(true);

    // Empty to text -> true
    expect(isMeaningfulChange('', 'New Dialogue')).toBe(true);
  });

  it('extracts newly added lines for diff translation', () => {
    const prev = 'Chapter 1\nThe Journey Begins';
    const curr = 'Chapter 1\nThe Journey Begins\nIn a dark cave';
    const added = extractAddedLines(prev, curr);
    expect(added).toEqual(['In a dark cave']);
  });
});

describe('OCR Core: Continuous Scheduler', () => {
  it('schedules ticks, skips duplicates, and transitions states cleanly', async () => {
    let tickCount = 0;
    const mockOnCapture = vi.fn().mockImplementation(async () => 'mock-base64-image');
    const mockOnOcr = vi.fn().mockImplementation(async () => {
      tickCount++;
      // Return same text for first 3 ticks, then new text
      return {
        text: tickCount <= 3 ? 'Static text' : 'New text on screen',
        blocks: [],
        lines: [],
        confidence: 0.95,
        durationMs: 10,
        providerId: 'mock',
      };
    });
    const mockOnTranslate = vi.fn().mockImplementation(async (text: string) => ({
      originalText: text,
      translatedText: `Dịch: ${text}`,
      sourceLanguage: 'en',
      targetLanguage: 'vi',
      provider: 'mock',
      durationMs: 5,
      fromCache: false,
    }));
    const mockOnResult = vi.fn();
    const mockOnStateChange = vi.fn();

    const scheduler = new ContinuousOcrScheduler(
      {
        region: { displayId: 0, x: 0, y: 0, width: 100, height: 50 },
        intervalMs: 40,
        changeThreshold: 0.15,
        ignoreUnchanged: true,
        translateOnlyDiff: false,
        ocrProviderId: 'mock',
        ocrLanguage: 'en',
        translationProviderId: 'mock',
        sourceLanguage: 'en',
        targetLanguages: ['vi'],
        profile: 'general',
      },
      {
        onCaptureRegion: mockOnCapture,
        onOcr: mockOnOcr,
        onTranslate: mockOnTranslate,
        onResult: mockOnResult,
        onStateChange: mockOnStateChange,
      }
    );

    scheduler.start();
    expect(scheduler.getState()).toBe('capturing');

    // Wait for first 2 ticks (first is translated, subsequent are ignored duplicates)
    await new Promise((resolve) => setTimeout(resolve, 90));

    expect(mockOnCapture).toHaveBeenCalled();
    expect(mockOnOcr).toHaveBeenCalled();
    expect(mockOnResult).toHaveBeenCalledTimes(1);
    expect(mockOnResult).toHaveBeenCalledWith(
      expect.objectContaining({
        recognizedText: 'Static text',
        translatedText: 'Dịch: Static text',
      })
    );

    // Wait for tick 4 where text changes to 'New text on screen'
    await new Promise((resolve) => setTimeout(resolve, 110));
    expect(mockOnResult).toHaveBeenCalledTimes(2);

    scheduler.stop();
    expect(scheduler.getState()).toBe('idle');
  });
});
