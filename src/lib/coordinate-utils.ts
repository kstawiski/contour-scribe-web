import { DicomImage } from './dicom-utils';
import { Point2D } from './contour-utils';

export interface CanvasConfig {
  canvasSize: number;
  zoom: number;
  pan: { x: number; y: number };
}

/**
 * Internal interface for image transform parameters
 */
interface ImageTransform {
  imageX: number;
  imageY: number;
  drawWidth: number;
  drawHeight: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Calculate the image transform parameters (shared logic to avoid duplication).
 * This determines how the DICOM image is positioned and scaled on the canvas.
 */
function calculateImageTransform(
  image: DicomImage,
  config: CanvasConfig
): ImageTransform {
  const { canvasSize, zoom, pan } = config;
  const imageAspect = image.width / image.height;
  let drawWidth: number;
  let drawHeight: number;

  // Scale image to match viewer rendering (always fit within 95% of canvas)
  const maxSize = canvasSize * 0.95;
  if (imageAspect >= 1) {
    drawWidth = maxSize;
    drawHeight = maxSize / imageAspect;
  } else {
    drawHeight = maxSize;
    drawWidth = maxSize * imageAspect;
  }

  // Apply zoom
  drawWidth *= zoom;
  drawHeight *= zoom;

  // Calculate image position on canvas (centered with pan offset)
  const imageX = (canvasSize - drawWidth) / 2 + pan.x;
  const imageY = (canvasSize - drawHeight) / 2 + pan.y;

  // Calculate scale factors (canvas pixels per image pixel)
  const scaleX = drawWidth / image.width;
  const scaleY = drawHeight / image.height;

  return { imageX, imageY, drawWidth, drawHeight, scaleX, scaleY };
}

/**
 * Convert world coordinates (patient/DICOM coordinates in mm) to canvas pixel coordinates.
 * 
 * Note: This function assumes the world coordinates are already in the 2D plane of the image slice.
 * For full 3D DICOM coordinate transformation, you would need to apply the inverse of the
 * image orientation matrix. The current implementation handles the typical axial slice case
 * where the image plane is aligned with the patient coordinate system axes.
 */
export function worldToCanvas(
  worldX: number,
  worldY: number,
  image: DicomImage,
  config: CanvasConfig
): Point2D {
  const imagePosition = image.imagePosition || [0, 0, 0];
  const pixelSpacing = image.pixelSpacing || [1, 1];
  // For proper DICOM coordinate handling with arbitrary orientations we would need to apply
  // the orientation matrix. The viewer currently renders axis-aligned axial slices, so the
  // simplified spacing-based approach matches the renderer.
  const pixelX = (worldX - imagePosition[0]) / pixelSpacing[0];
  const pixelY = (worldY - imagePosition[1]) / pixelSpacing[1];

  // Get canvas transform and apply it
  const transform = calculateImageTransform(image, config);
  
  return {
    x: transform.imageX + pixelX * transform.scaleX,
    y: transform.imageY + pixelY * transform.scaleY,
  };
}

/**
 * Convert canvas pixel coordinates to world coordinates (patient/DICOM coordinates in mm).
 * 
 * Note: This function assumes the image is in a standard axial orientation. For arbitrary
 * image orientations, you would need to apply the image orientation matrix to properly
 * transform from pixel space to patient coordinate space.
 */
export function canvasToWorld(
  canvasX: number,
  canvasY: number,
  image: DicomImage,
  config: CanvasConfig
): Point2D {
  const imagePosition = image.imagePosition || [0, 0, 0];
  const pixelSpacing = image.pixelSpacing || [1, 1];

  // Get canvas transform
  const transform = calculateImageTransform(image, config);

  // Convert canvas coordinates to pixel coordinates
  const pixelX = (canvasX - transform.imageX) / transform.scaleX;
  const pixelY = (canvasY - transform.imageY) / transform.scaleY;

  // Convert pixel coordinates to world coordinates
  // For full DICOM orientation support, we would need to:
  // pixelToWorld = imagePosition + pixelX * spacing[0] * rowCosines + pixelY * spacing[1] * colCosines
  return {
    x: imagePosition[0] + pixelX * pixelSpacing[0],
    y: imagePosition[1] + pixelY * pixelSpacing[1],
  };
}

/**
 * Get the image dimensions and position on canvas
 */
export function getImageBounds(
  image: DicomImage,
  config: CanvasConfig
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const transform = calculateImageTransform(image, config);
  return {
    x: transform.imageX,
    y: transform.imageY,
    width: transform.drawWidth,
    height: transform.drawHeight,
  };
}

/**
 * Check if a canvas point is within the image bounds
 */
export function isPointInImage(
  canvasX: number,
  canvasY: number,
  image: DicomImage,
  config: CanvasConfig
): boolean {
  const bounds = getImageBounds(image, config);
  return (
    canvasX >= bounds.x &&
    canvasX <= bounds.x + bounds.width &&
    canvasY >= bounds.y &&
    canvasY <= bounds.y + bounds.height
  );
}
