import { OcrProfile, OcrPreprocessOptions } from '@echo-lingo/contracts';

export interface ImageDataBuffer {
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * Converts an RGBA buffer to grayscale using standard luminance coefficients:
 * Y = 0.299*R + 0.587*G + 0.114*B
 */
export function grayscale(rgba: Uint8Array): Uint8Array {
  const output = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const lum = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
    output[i] = lum;
    output[i + 1] = lum;
    output[i + 2] = lum;
    output[i + 3] = rgba[i + 3]; // preserve alpha
  }
  return output;
}

/**
 * Enhances contrast by stretching pixel intensities to span the full [0, 255] range.
 */
export function contrastStretch(rgba: Uint8Array): Uint8Array {
  let min = 255;
  let max = 0;

  for (let i = 0; i < rgba.length; i += 4) {
    const val = rgba[i]; // assumes already grayscaled or luminance
    if (val < min) min = val;
    if (val > max) max = val;
  }

  // If contrast is already maximum or image is monochromatic, return clone
  if (max <= min || (min === 0 && max === 255)) {
    return new Uint8Array(rgba);
  }

  const range = max - min;
  const output = new Uint8Array(rgba.length);

  for (let i = 0; i < rgba.length; i += 4) {
    const val = Math.round(((rgba[i] - min) / range) * 255);
    output[i] = val;
    output[i + 1] = val;
    output[i + 2] = val;
    output[i + 3] = rgba[i + 3];
  }

  return output;
}

/**
 * Computes Otsu's optimal threshold for global binarization.
 */
export function computeOtsuThreshold(rgba: Uint8Array): number {
  const histogram = new Array(256).fill(0);
  let totalPixels = 0;

  for (let i = 0; i < rgba.length; i += 4) {
    histogram[rgba[i]]++;
    totalPixels++;
  }

  if (totalPixels === 0) return 128;

  let sum = 0;
  for (let t = 0; t < 256; t++) {
    sum += t * histogram[t];
  }

  let sumB = 0;
  let weightB = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    weightB += histogram[t];
    if (weightB === 0) continue;

    const weightF = totalPixels - weightB;
    if (weightF === 0) break;

    sumB += t * histogram[t];

    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;

    const varianceBetween = weightB * weightF * Math.pow(meanB - meanF, 2);

    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Binarizes image using Otsu's method or fixed threshold.
 */
export function binarize(rgba: Uint8Array, fixedThreshold?: number): Uint8Array {
  const isOtsu = fixedThreshold === undefined;
  const threshold = fixedThreshold ?? computeOtsuThreshold(rgba);
  const output = new Uint8Array(rgba.length);

  for (let i = 0; i < rgba.length; i += 4) {
    const isForeground = isOtsu ? rgba[i] > threshold : rgba[i] >= threshold;
    const binaryVal = isForeground ? 255 : 0;
    output[i] = binaryVal;
    output[i + 1] = binaryVal;
    output[i + 2] = binaryVal;
    output[i + 3] = 255;
  }

  return output;
}

/**
 * Inverts the color channels of the image (useful for white text on dark backgrounds).
 */
export function invert(rgba: Uint8Array): Uint8Array {
  const output = new Uint8Array(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    output[i] = 255 - rgba[i];
    output[i + 1] = 255 - rgba[i + 1];
    output[i + 2] = 255 - rgba[i + 2];
    output[i + 3] = rgba[i + 3];
  }
  return output;
}

/**
 * Upscales the image by an integer scale factor using bilinear interpolation.
 */
export function scaleImage(
  rgba: Uint8Array,
  width: number,
  height: number,
  scale: number
): ImageDataBuffer {
  if (scale <= 1) {
    return { data: new Uint8Array(rgba), width, height };
  }

  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);
  const output = new Uint8Array(targetWidth * targetHeight * 4);

  const xRatio = (width - 1) / targetWidth;
  const yRatio = (height - 1) / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    const yL = Math.floor(y * yRatio);
    const yH = Math.ceil(y * yRatio);
    const yWeight = y * yRatio - yL;

    for (let x = 0; x < targetWidth; x++) {
      const xL = Math.floor(x * xRatio);
      const xH = Math.ceil(x * xRatio);
      const xWeight = x * xRatio - xL;

      const idxA = (yL * width + xL) * 4;
      const idxB = (yL * width + xH) * 4;
      const idxC = (yH * width + xL) * 4;
      const idxD = (yH * width + xH) * 4;

      const outIdx = (y * targetWidth + x) * 4;

      for (let c = 0; c < 4; c++) {
        const top = rgba[idxA + c] * (1 - xWeight) + rgba[idxB + c] * xWeight;
        const bottom = rgba[idxC + c] * (1 - xWeight) + rgba[idxD + c] * xWeight;
        output[outIdx + c] = Math.round(top * (1 - yWeight) + bottom * yWeight);
      }
    }
  }

  return { data: output, width: targetWidth, height: targetHeight };
}

/**
 * Applies a 3x3 median filter to eliminate salt-and-pepper noise and scanner grain.
 */
export function denoise(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const output = new Uint8Array(rgba.length);
  const window = new Uint8Array(9);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = Math.min(Math.max(y + dy, 0), height - 1);
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          window[count++] = rgba[(ny * width + nx) * 4];
        }
      }

      // Simple insertion sort on 9 elements
      for (let i = 1; i < 9; i++) {
        const key = window[i];
        let j = i - 1;
        while (j >= 0 && window[j] > key) {
          window[j + 1] = window[j];
          j--;
        }
        window[j + 1] = key;
      }
      const median = window[4];
      const idx = (y * width + x) * 4;
      output[idx] = median;
      output[idx + 1] = median;
      output[idx + 2] = median;
      output[idx + 3] = rgba[idx + 3];
    }
  }

  return output;
}

/**
 * Applies Bradley-Roth local adaptive thresholding using an integral image.
 * Excels at binarizing handwriting on uneven backgrounds, shadows, and lined paper.
 */
export function adaptiveThreshold(
  rgba: Uint8Array,
  width: number,
  height: number,
  windowRatio = 0.125,
  percentage = 0.15
): Uint8Array {
  const output = new Uint8Array(rgba.length);
  const integral = new Float64Array((width + 1) * (height + 1));

  // Compute integral image
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const lum = rgba[(y * width + x) * 4];
      rowSum += lum;
      integral[(y + 1) * (width + 1) + (x + 1)] =
        integral[y * (width + 1) + (x + 1)] + rowSum;
    }
  }

  const s = Math.max(8, Math.round(width * windowRatio));
  const s2 = Math.floor(s / 2);

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - s2);
    const y2 = Math.min(height - 1, y + s2);

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - s2);
      const x2 = Math.min(width - 1, x + s2);

      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      const sum =
        integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
        integral[y1 * (width + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (width + 1) + x1] +
        integral[y1 * (width + 1) + x1];

      const avg = sum / count;
      const lum = rgba[(y * width + x) * 4];

      const isInk = lum <= avg * (1 - percentage);
      const val = isInk ? 0 : 255;

      const idx = (y * width + x) * 4;
      output[idx] = val;
      output[idx + 1] = val;
      output[idx + 2] = val;
      output[idx + 3] = 255;
    }
  }

  return output;
}

/**
 * Performs morphological closing (dilation then erosion) to bridge micro-breaks in cursive/handwritten strokes.
 * Assumes dark ink (0) on white background (255).
 */
export function morphologyClose(rgba: Uint8Array, width: number, height: number): Uint8Array {
  // Step 1: Dilation on ink (min filter: if any neighbor is ink < 128, becomes ink 0)
  const dilated = new Uint8Array(rgba.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let isInk = false;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          if (rgba[(ny * width + nx) * 4] < 128) {
            isInk = true;
            break;
          }
        }
        if (isInk) break;
      }
      const val = isInk ? 0 : 255;
      const idx = (y * width + x) * 4;
      dilated[idx] = val;
      dilated[idx + 1] = val;
      dilated[idx + 2] = val;
      dilated[idx + 3] = 255;
    }
  }

  // Step 2: Erosion on ink (max filter: if any neighbor is background >= 128, becomes background 255)
  const output = new Uint8Array(rgba.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let isBackground = false;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          if (dilated[(ny * width + nx) * 4] >= 128) {
            isBackground = true;
            break;
          }
        }
        if (isBackground) break;
      }
      const val = isBackground ? 255 : 0;
      const idx = (y * width + x) * 4;
      output[idx] = val;
      output[idx + 1] = val;
      output[idx + 2] = val;
      output[idx + 3] = 255;
    }
  }

  return output;
}

/**
 * Applies a complete preprocessing profile or custom options to raw image data.
 */
export function preprocessImage(
  image: ImageDataBuffer,
  options: OcrPreprocessOptions
): ImageDataBuffer {
  if (options.profile === 'none') {
    return image;
  }

  let current = image.data;
  let w = image.width;
  let h = image.height;

  // 1. Grayscale
  if (options.grayscale) {
    current = grayscale(current);
  }

  // 2. Contrast Stretch
  if (options.contrastStretch) {
    current = contrastStretch(current);
  }

  // 3. Upscale small text if requested
  if (options.scale > 1) {
    const scaled = scaleImage(current, w, h, options.scale);
    current = scaled.data;
    w = scaled.width;
    h = scaled.height;
  }

  // 4. Denoise (median filter)
  if (options.denoise) {
    current = denoise(current, w, h);
  }

  // 5. Invert if requested
  if (options.invert) {
    current = invert(current);
  }

  // 6. Adaptive threshold or global binarization
  if (options.adaptiveThreshold) {
    current = adaptiveThreshold(current, w, h);
  } else if (options.binarize) {
    current = binarize(current);
  }

  // 7. Morphological closing for stroke continuity
  if (options.morphologyClose) {
    current = morphologyClose(current, w, h);
  }

  return { data: current, width: w, height: h };
}
