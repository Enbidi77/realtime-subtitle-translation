import { OcrBoundingBox } from '@echo-lingo/contracts';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayGeometry {
  id: number;
  bounds: Rect; // Virtual desktop coordinates
  workArea: Rect; // Available work area
  scaleFactor: number;
}

/**
 * Converts a selection rect made in a selection window (display-local logical coordinates)
 * into physical screenshot pixel coordinates with boundary clamping.
 */
export function toPhysicalCropRect(
  selection: Rect,
  displayBounds: Rect,
  scaleFactor: number,
  screenshotWidth?: number,
  screenshotHeight?: number
): Rect {
  const sf = Math.max(0.1, scaleFactor);
  const maxW = screenshotWidth ?? Math.round(displayBounds.width * sf);
  const maxH = screenshotHeight ?? Math.round(displayBounds.height * sf);

  // Normalize negative width/height from dragging in reverse direction
  let x = selection.width < 0 ? selection.x + selection.width : selection.x;
  let y = selection.height < 0 ? selection.y + selection.height : selection.y;
  let width = Math.abs(selection.width);
  let height = Math.abs(selection.height);

  // Convert to physical screenshot coordinates
  let physX = Math.round(x * sf);
  let physY = Math.round(y * sf);
  let physW = Math.round(width * sf);
  let physH = Math.round(height * sf);

  // Clamp within image bounds
  physX = Math.max(0, Math.min(physX, maxW - 1));
  physY = Math.max(0, Math.min(physY, maxH - 1));

  if (physX + physW > maxW) {
    physW = maxW - physX;
  }
  if (physY + physH > maxH) {
    physH = maxH - physY;
  }

  // Ensure minimum dimensions of at least 1 pixel
  physW = Math.max(1, physW);
  physH = Math.max(1, physH);

  return {
    x: physX,
    y: physY,
    width: physW,
    height: physH,
  };
}

/**
 * Converts virtual desktop coordinates (e.g. mouse point) to display-local coordinates.
 */
export function virtualToDisplayLocal(point: { x: number; y: number }, displayBounds: Rect): { x: number; y: number } {
  return {
    x: point.x - displayBounds.x,
    y: point.y - displayBounds.y,
  };
}

/**
 * Converts display-local coordinates to virtual desktop coordinates.
 */
export function displayLocalToVirtual(point: { x: number; y: number }, displayBounds: Rect): { x: number; y: number } {
  return {
    x: point.x + displayBounds.x,
    y: point.y + displayBounds.y,
  };
}

/**
 * Maps an OCR bounding box (relative to the cropped image in physical pixels)
 * back to display-local logical coordinates.
 */
export function cropPhysicalToDisplayLocal(
  box: OcrBoundingBox,
  cropLogicalOrigin: { x: number; y: number },
  scaleFactor: number
): OcrBoundingBox {
  const sf = Math.max(0.1, scaleFactor);
  return {
    x: Math.round(cropLogicalOrigin.x + box.x / sf),
    y: Math.round(cropLogicalOrigin.y + box.y / sf),
    width: Math.round(box.width / sf),
    height: Math.round(box.height / sf),
  };
}

/**
 * Calculates optimal position for the floating translation panel
 * positioned adjacent to the captured region, clamped within display workArea.
 */
export function calculateFloatingPanelPosition(
  selectionLocalRect: Rect,
  displayBounds: Rect,
  workArea: Rect,
  panelSize: { width: number; height: number },
  spacing = 10
): { x: number; y: number } {
  // Global virtual coordinates of selection
  const selGlobalX = displayBounds.x + selectionLocalRect.x;
  const selGlobalY = displayBounds.y + selectionLocalRect.y;
  const selGlobalW = selectionLocalRect.width;
  const selGlobalH = selectionLocalRect.height;

  // Try placing directly below the selection
  let targetX = selGlobalX + Math.round((selGlobalW - panelSize.width) / 2);
  let targetY = selGlobalY + selGlobalH + spacing;

  // If bottom exceeds workArea, try placing above selection
  if (targetY + panelSize.height > workArea.y + workArea.height) {
    const candidateAboveY = selGlobalY - panelSize.height - spacing;
    if (candidateAboveY >= workArea.y) {
      targetY = candidateAboveY;
    } else {
      // If neither fits completely, clamp to bottom of workArea
      targetY = workArea.y + workArea.height - panelSize.height - 8;
    }
  }

  // Clamp horizontal position within workArea bounds
  const minX = workArea.x + 8;
  const maxX = workArea.x + workArea.width - panelSize.width - 8;
  targetX = Math.max(minX, Math.min(targetX, maxX));

  // Clamp vertical position within workArea bounds
  const minY = workArea.y + 8;
  const maxY = workArea.y + workArea.height - panelSize.height - 8;
  targetY = Math.max(minY, Math.min(targetY, maxY));

  return { x: targetX, y: targetY };
}
