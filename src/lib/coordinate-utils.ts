import { DicomImage } from './dicom-utils';
import { Point2D } from './contour-utils';

export interface CanvasConfig {
  canvasSize: number;
  zoom: number;
  pan: { x: number; y: number };
}

/**
 * Convert world coordinates (patient/DICOM coordinates) to canvas pixel coordinates
 */
export function worldToCanvas(
  worldX: number,
  worldY: number,
  image: DicomImage,
  config: CanvasConfig
): Point2D {
  const { canvasSize, zoom, pan } = config;
  const imagePosition = image.imagePosition || [0, 0, 0];
  const pixelSpacing = image.pixelSpacing || [1, 1];

  // Convert world coordinates to pixel coordinates
  const pixelX = (worldX - imagePosition[0]) / pixelSpacing[0];
  const pixelY = (worldY - imagePosition[1]) / pixelSpacing[1];

  // Calculate image size on canvas
  const imageAspect = image.width / image.height;
  let drawWidth = image.width;
  let drawHeight = image.height;

  const maxSize = canvasSize * 0.95;
  if (drawWidth > maxSize || drawHeight > maxSize) {
    if (imageAspect > 1) {
      drawWidth = maxSize;
      drawHeight = maxSize / imageAspect;
    } else {
      drawHeight = maxSize;
      drawWidth = maxSize * imageAspect;
    }
  }

  // Apply zoom
  drawWidth *= zoom;
  drawHeight *= zoom;

  // Calculate image position on canvas (centered with pan offset)
  const imageX = (canvasSize - drawWidth) / 2 + pan.x;
  const imageY = (canvasSize - drawHeight) / 2 + pan.y;

  // Calculate scale factors
  const scaleX = drawWidth / image.width;
  const scaleY = drawHeight / image.height;

  return {
    x: imageX + pixelX * scaleX,
    y: imageY + pixelY * scaleY,
  };
}

/**
 * Convert canvas pixel coordinates to world coordinates (patient/DICOM coordinates)
 */
export function canvasToWorld(
  canvasX: number,
  canvasY: number,
  image: DicomImage,
  config: CanvasConfig
): Point2D {
  const { canvasSize, zoom, pan } = config;
  const imagePosition = image.imagePosition || [0, 0, 0];
  const pixelSpacing = image.pixelSpacing || [1, 1];

  // Calculate image size on canvas
  const imageAspect = image.width / image.height;
  let drawWidth = image.width;
  let drawHeight = image.height;

  const maxSize = canvasSize * 0.95;
  if (drawWidth > maxSize || drawHeight > maxSize) {
    if (imageAspect > 1) {
      drawWidth = maxSize;
      drawHeight = maxSize / imageAspect;
    } else {
      drawHeight = maxSize;
      drawWidth = maxSize * imageAspect;
    }
  }

  // Apply zoom
  drawWidth *= zoom;
  drawHeight *= zoom;

  // Calculate image position on canvas (centered with pan offset)
  const imageX = (canvasSize - drawWidth) / 2 + pan.x;
  const imageY = (canvasSize - drawHeight) / 2 + pan.y;

  // Calculate scale factors
  const scaleX = drawWidth / image.width;
  const scaleY = drawHeight / image.height;

  // Convert canvas coordinates to pixel coordinates
  const pixelX = (canvasX - imageX) / scaleX;
  const pixelY = (canvasY - imageY) / scaleY;

  // Convert pixel coordinates to world coordinates
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
  const { canvasSize, zoom, pan } = config;
  const imageAspect = image.width / image.height;
  let drawWidth = image.width;
  let drawHeight = image.height;

  const maxSize = canvasSize * 0.95;
  if (drawWidth > maxSize || drawHeight > maxSize) {
    if (imageAspect > 1) {
      drawWidth = maxSize;
      drawHeight = maxSize / imageAspect;
    } else {
      drawHeight = maxSize;
      drawWidth = maxSize * imageAspect;
    }
  }

  // Apply zoom
  drawWidth *= zoom;
  drawHeight *= zoom;

  // Calculate image position on canvas (centered with pan offset)
  const imageX = (canvasSize - drawWidth) / 2 + pan.x;
  const imageY = (canvasSize - drawHeight) / 2 + pan.y;

  return {
    x: imageX,
    y: imageY,
    width: drawWidth,
    height: drawHeight,
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
