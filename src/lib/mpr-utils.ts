import { DicomImage } from './dicom-utils';

export type ViewPlane = 'axial' | 'sagittal' | 'coronal';

export interface MPRVolume {
  // Original axial slices
  axialSlices: DicomImage[];

  // Volume dimensions
  width: number;  // X dimension (columns in axial)
  height: number; // Y dimension (rows in axial)
  depth: number;  // Z dimension (number of slices)

  // Spacing in mm
  pixelSpacing: [number, number]; // X, Y spacing
  sliceSpacing: number;           // Z spacing

  // 3D volume data (organized as axial slices)
  volumeData: Uint16Array | Uint8Array;

  // Window/Level settings
  windowCenter: number;
  windowWidth: number;
  rescaleIntercept: number;
  rescaleSlope: number;
}

export interface MPRSlice {
  plane: ViewPlane;
  index: number;
  data: Uint16Array | Uint8Array;
  width: number;
  height: number;
}

export interface MPRCrosshair {
  axialIndex: number;
  sagittalIndex: number;
  coronalIndex: number;
}

/**
 * Build a 3D volume from axial DICOM slices
 */
export function buildMPRVolume(axialSlices: DicomImage[]): MPRVolume | null {
  if (axialSlices.length === 0) {
    return null;
  }

  const firstSlice = axialSlices[0];
  const width = firstSlice.width;
  const height = firstSlice.height;
  const depth = axialSlices.length;

  // Get spacing information
  const pixelSpacing: [number, number] = firstSlice.pixelSpacing
    ? [firstSlice.pixelSpacing[0], firstSlice.pixelSpacing[1]]
    : [1, 1];

  // Calculate slice spacing from slice locations
  let sliceSpacing = 1;
  if (axialSlices.length > 1 && axialSlices[0].sliceLocation !== undefined && axialSlices[1].sliceLocation !== undefined) {
    sliceSpacing = Math.abs(axialSlices[1].sliceLocation - axialSlices[0].sliceLocation);
  } else if (firstSlice.sliceThickness !== undefined) {
    sliceSpacing = firstSlice.sliceThickness;
  }

  // Determine if we're working with 8-bit or 16-bit data
  const is16Bit = firstSlice.pixelData instanceof Uint16Array;

  // Allocate volume data
  const volumeSize = width * height * depth;
  const volumeData = is16Bit
    ? new Uint16Array(volumeSize)
    : new Uint8Array(volumeSize);

  // Copy axial slices into volume
  axialSlices.forEach((slice, z) => {
    const offset = z * width * height;
    volumeData.set(slice.pixelData, offset);
  });

  return {
    axialSlices,
    width,
    height,
    depth,
    pixelSpacing,
    sliceSpacing,
    volumeData,
    windowCenter: firstSlice.windowCenter,
    windowWidth: firstSlice.windowWidth,
    rescaleIntercept: firstSlice.rescaleIntercept,
    rescaleSlope: firstSlice.rescaleSlope,
  };
}

/**
 * Extract an axial slice (XY plane) at given Z index
 */
export function getAxialSlice(volume: MPRVolume, zIndex: number): MPRSlice {
  const { width, height, volumeData } = volume;
  const clampedZ = Math.max(0, Math.min(volume.depth - 1, Math.floor(zIndex)));

  const offset = clampedZ * width * height;
  const sliceSize = width * height;

  const data = volumeData.slice(offset, offset + sliceSize) as Uint16Array | Uint8Array;

  return {
    plane: 'axial',
    index: clampedZ,
    data,
    width,
    height,
  };
}

/**
 * Extract a sagittal slice (YZ plane) at given X index
 */
export function getSagittalSlice(volume: MPRVolume, xIndex: number): MPRSlice {
  const { width, height, depth, volumeData } = volume;
  const clampedX = Math.max(0, Math.min(width - 1, Math.floor(xIndex)));

  const sliceSize = height * depth;
  const data = volume.volumeData instanceof Uint16Array
    ? new Uint16Array(sliceSize)
    : new Uint8Array(sliceSize);

  // Extract pixels along X at clampedX
  // Flip Z direction so head is at top (Z increases from feet to head)
  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      const volumeIndex = z * (width * height) + y * width + clampedX;
      // Flip the Z coordinate so the image is right-side up
      const flippedZ = depth - 1 - z;
      const sliceIndex = flippedZ * height + y;
      data[sliceIndex] = volumeData[volumeIndex];
    }
  }

  return {
    plane: 'sagittal',
    index: clampedX,
    data,
    width: depth,  // Z becomes width
    height,        // Y stays height
  };
}

/**
 * Extract a coronal slice (XZ plane) at given Y index
 */
export function getCoronalSlice(volume: MPRVolume, yIndex: number): MPRSlice {
  const { width, height, depth, volumeData } = volume;
  const clampedY = Math.max(0, Math.min(height - 1, Math.floor(yIndex)));

  const sliceSize = width * depth;
  const data = volume.volumeData instanceof Uint16Array
    ? new Uint16Array(sliceSize)
    : new Uint8Array(sliceSize);

  // Extract pixels along Y at clampedY
  // Flip Z direction so head is at top (Z increases from feet to head)
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const volumeIndex = z * (width * height) + clampedY * width + x;
      // Flip the Z coordinate so the image is right-side up
      const flippedZ = depth - 1 - z;
      const sliceIndex = flippedZ * width + x;
      data[sliceIndex] = volumeData[volumeIndex];
    }
  }

  return {
    plane: 'coronal',
    index: clampedY,
    data,
    width,         // X stays width
    height: depth, // Z becomes height
  };
}

/**
 * Get crosshair position for a given plane and index
 */
export function updateCrosshair(
  volume: MPRVolume,
  plane: ViewPlane,
  index: number,
  currentCrosshair: MPRCrosshair
): MPRCrosshair {
  const newCrosshair = { ...currentCrosshair };

  switch (plane) {
    case 'axial':
      newCrosshair.axialIndex = Math.max(0, Math.min(volume.depth - 1, index));
      break;
    case 'sagittal':
      newCrosshair.sagittalIndex = Math.max(0, Math.min(volume.width - 1, index));
      break;
    case 'coronal':
      newCrosshair.coronalIndex = Math.max(0, Math.min(volume.height - 1, index));
      break;
  }

  return newCrosshair;
}

/**
 * Render MPR slice to canvas with window/level and correct aspect ratio
 */
export function renderMPRSliceToCanvas(
  canvas: HTMLCanvasElement,
  slice: MPRSlice,
  volume: MPRVolume,
  windowLevel: number,
  windowWidth: number
): void {
  // Calculate physical dimensions for proper aspect ratio
  const physicalDims = getPhysicalDimensions(volume, slice.plane);
  const aspectRatio = physicalDims.width / physicalDims.height;

  // Set canvas size to maintain aspect ratio
  // Use a maximum dimension of 512 pixels for the larger dimension
  const maxDim = 512;
  let canvasWidth, canvasHeight;

  if (aspectRatio > 1) {
    canvasWidth = maxDim;
    canvasHeight = Math.round(maxDim / aspectRatio);
  } else {
    canvasHeight = maxDim;
    canvasWidth = Math.round(maxDim * aspectRatio);
  }

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Create temporary canvas at original slice dimensions
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = slice.width;
  tempCanvas.height = slice.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;

  const imageData = tempCtx.createImageData(slice.width, slice.height);
  const pixels = imageData.data;

  const { rescaleIntercept, rescaleSlope } = volume;

  const windowMin = windowLevel - windowWidth / 2;
  const windowMax = windowLevel + windowWidth / 2;

  for (let i = 0; i < slice.data.length; i++) {
    // Apply rescale slope and intercept to get HU values
    const huValue = slice.data[i] * rescaleSlope + rescaleIntercept;

    // Apply window/level
    let displayValue: number;
    if (huValue <= windowMin) {
      displayValue = 0;
    } else if (huValue >= windowMax) {
      displayValue = 255;
    } else {
      displayValue = ((huValue - windowMin) / windowWidth) * 255;
    }

    const pixelIndex = i * 4;
    pixels[pixelIndex] = displayValue;     // R
    pixels[pixelIndex + 1] = displayValue; // G
    pixels[pixelIndex + 2] = displayValue; // B
    pixels[pixelIndex + 3] = 255;          // A
  }

  tempCtx.putImageData(imageData, 0, 0);

  // Draw the temporary canvas to the main canvas with correct aspect ratio
  ctx.imageSmoothingEnabled = false; // Keep pixelated look
  ctx.drawImage(tempCanvas, 0, 0, canvasWidth, canvasHeight);
}

/**
 * Convert canvas coordinates to volume coordinates
 * Accounts for flipped Z direction in sagittal and coronal views
 */
export function canvasToVolumeCoords(
  canvasX: number,
  canvasY: number,
  plane: ViewPlane,
  crosshair: MPRCrosshair,
  volume: MPRVolume
): { x: number; y: number; z: number } {
  let x: number, y: number, z: number;

  switch (plane) {
    case 'axial':
      x = Math.floor(canvasX);
      y = Math.floor(canvasY);
      z = crosshair.axialIndex;
      break;
    case 'sagittal':
      x = crosshair.sagittalIndex;
      y = Math.floor(canvasY);
      // Z is flipped in sagittal view (head at right/high X values)
      z = volume.depth - 1 - Math.floor(canvasX);
      break;
    case 'coronal':
      x = Math.floor(canvasX);
      y = crosshair.coronalIndex;
      // Z is flipped in coronal view (head at top/high Y values)
      z = volume.depth - 1 - Math.floor(canvasY);
      break;
    default:
      // Should never happen with proper ViewPlane type, but handle defensively
      x = 0;
      y = 0;
      z = 0;
      break;
  }

  return {
    x: Math.max(0, Math.min(volume.width - 1, x)),
    y: Math.max(0, Math.min(volume.height - 1, y)),
    z: Math.max(0, Math.min(volume.depth - 1, z)),
  };
}

/**
 * Get physical dimensions of a plane (in mm)
 */
export function getPhysicalDimensions(volume: MPRVolume, plane: ViewPlane): { width: number; height: number } {
  const { pixelSpacing, sliceSpacing, width, height, depth } = volume;

  switch (plane) {
    case 'axial':
      return {
        width: width * pixelSpacing[0],
        height: height * pixelSpacing[1],
      };
    case 'sagittal':
      return {
        width: depth * sliceSpacing,
        height: height * pixelSpacing[1],
      };
    case 'coronal':
      return {
        width: width * pixelSpacing[0],
        height: depth * sliceSpacing,
      };
    default:
      // Should never happen with proper ViewPlane type, but handle defensively
      throw new Error(`Unknown plane: ${plane}`);
  }
}
