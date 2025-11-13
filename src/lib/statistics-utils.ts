/**
 * Statistics calculations for contours and structures
 */

import { Point2D } from './contour-utils';

export interface ContourStatistics {
  area: number; // in mm²
  perimeter: number; // in mm
  pointCount: number;
}

export interface StructureStatistics {
  structureId: string;
  structureName: string;
  totalVolume: number; // in mm³ or cm³
  sliceCount: number;
  minSlice: number;
  maxSlice: number;
  contourCount: number;
  averageArea: number; // in mm²
}

/**
 * Calculate the area of a polygon using the Shoelace formula
 * Points should be in world coordinates (mm)
 */
export function calculatePolygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area / 2);
}

/**
 * Calculate the perimeter of a polygon
 * Points should be in world coordinates (mm)
 */
export function calculatePolygonPerimeter(points: Point2D[]): number {
  if (points.length < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const dx = points[j].x - points[i].x;
    const dy = points[j].y - points[i].y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  return perimeter;
}

/**
 * Calculate statistics for a single contour
 */
export function calculateContourStatistics(points: Point2D[]): ContourStatistics {
  return {
    area: calculatePolygonArea(points),
    perimeter: calculatePolygonPerimeter(points),
    pointCount: points.length,
  };
}

/**
 * Calculate volume of a structure across multiple slices using trapezoidal rule
 */
export function calculateStructureVolume(
  contoursPerSlice: Map<number, Point2D[][]>,
  sliceSpacing: number
): number {
  const sliceIndices = Array.from(contoursPerSlice.keys()).sort((a, b) => a - b);

  if (sliceIndices.length === 0) return 0;
  if (sliceIndices.length === 1) {
    // Single slice - calculate area only
    const contours = contoursPerSlice.get(sliceIndices[0]) || [];
    const totalArea = contours.reduce((sum, points) => sum + calculatePolygonArea(points), 0);
    return totalArea * sliceSpacing;
  }

  let volume = 0;

  // Use trapezoidal rule for volume calculation
  for (let i = 0; i < sliceIndices.length - 1; i++) {
    const slice1 = sliceIndices[i];
    const slice2 = sliceIndices[i + 1];

    const contours1 = contoursPerSlice.get(slice1) || [];
    const contours2 = contoursPerSlice.get(slice2) || [];

    const area1 = contours1.reduce((sum, points) => sum + calculatePolygonArea(points), 0);
    const area2 = contours2.reduce((sum, points) => sum + calculatePolygonArea(points), 0);

    // Distance between slices (may not be uniform)
    const distance = (slice2 - slice1) * sliceSpacing;

    // Trapezoidal rule: V = (A1 + A2) / 2 * h
    volume += ((area1 + area2) / 2) * distance;
  }

  return volume;
}

/**
 * Calculate comprehensive statistics for a structure
 */
export function calculateStructureStatistics(
  structureId: string,
  structureName: string,
  contours: Array<{ sliceIndex: number; points: Point2D[] }>,
  sliceSpacing: number
): StructureStatistics {
  if (contours.length === 0) {
    return {
      structureId,
      structureName,
      totalVolume: 0,
      sliceCount: 0,
      minSlice: 0,
      maxSlice: 0,
      contourCount: 0,
      averageArea: 0,
    };
  }

  // Group contours by slice
  const contoursPerSlice = new Map<number, Point2D[][]>();
  contours.forEach(contour => {
    if (!contoursPerSlice.has(contour.sliceIndex)) {
      contoursPerSlice.set(contour.sliceIndex, []);
    }
    contoursPerSlice.get(contour.sliceIndex)!.push(contour.points);
  });

  const sliceIndices = Array.from(contoursPerSlice.keys());
  const totalVolume = calculateStructureVolume(contoursPerSlice, sliceSpacing);

  // Calculate average area
  let totalArea = 0;
  contours.forEach(contour => {
    totalArea += calculatePolygonArea(contour.points);
  });
  const averageArea = contours.length > 0 ? totalArea / contours.length : 0;

  return {
    structureId,
    structureName,
    totalVolume,
    sliceCount: sliceIndices.length,
    minSlice: Math.min(...sliceIndices),
    maxSlice: Math.max(...sliceIndices),
    contourCount: contours.length,
    averageArea,
  };
}

/**
 * Format volume for display (convert to appropriate unit)
 */
export function formatVolume(volumeMm3: number): string {
  if (volumeMm3 < 1000) {
    return `${volumeMm3.toFixed(2)} mm³`;
  } else {
    const volumeCm3 = volumeMm3 / 1000;
    return `${volumeCm3.toFixed(2)} cm³`;
  }
}

/**
 * Format area for display
 */
export function formatArea(areaMm2: number): string {
  if (areaMm2 < 100) {
    return `${areaMm2.toFixed(2)} mm²`;
  } else {
    const areaCm2 = areaMm2 / 100;
    return `${areaCm2.toFixed(2)} cm²`;
  }
}
