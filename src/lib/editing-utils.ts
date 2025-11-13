import polygonClipping from 'polygon-clipping';
import { Point2D, Contour, Structure3D } from './contour-utils';

/**
 * Selection and Hit Testing
 */

export interface SelectionInfo {
  contour: Contour;
  pointIndex?: number;
  distance: number;
}

/**
 * Find the closest point on any contour to the given position
 */
export function findClosestPoint(
  position: Point2D,
  contours: Contour[],
  maxDistance: number = 20
): SelectionInfo | null {
  let closest: SelectionInfo | null = null;
  let minDist = maxDistance;

  for (const contour of contours) {
    for (let i = 0; i < contour.points.length; i++) {
      const point = contour.points[i];
      const dist = distance(position, point);

      if (dist < minDist) {
        minDist = dist;
        closest = {
          contour,
          pointIndex: i,
          distance: dist
        };
      }
    }
  }

  return closest;
}

/**
 * Find the closest contour to the given position
 */
export function findClosestContour(
  position: Point2D,
  contours: Contour[],
  maxDistance: number = 20
): SelectionInfo | null {
  let closest: SelectionInfo | null = null;
  let minDist = maxDistance;

  for (const contour of contours) {
    const dist = distanceToContour(position, contour);

    if (dist < minDist) {
      minDist = dist;
      closest = {
        contour,
        distance: dist
      };
    }
  }

  return closest;
}

/**
 * Calculate distance from a point to a contour (minimum distance to any segment)
 */
function distanceToContour(point: Point2D, contour: Contour): number {
  let minDist = Infinity;

  for (let i = 0; i < contour.points.length; i++) {
    const p1 = contour.points[i];
    const p2 = contour.points[(i + 1) % contour.points.length];
    const dist = distanceToSegment(point, p1, p2);
    minDist = Math.min(minDist, dist);
  }

  return minDist;
}

/**
 * Calculate distance from a point to a line segment
 */
function distanceToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const len2 = distance2(a, b);
  if (len2 === 0) return distance(p, a);

  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2;
  t = Math.max(0, Math.min(1, t));

  const projection = {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y)
  };

  return distance(p, projection);
}

/**
 * Find the best position to insert a new point on a contour
 */
export function findInsertPosition(
  position: Point2D,
  contour: Contour
): number {
  let minDist = Infinity;
  let insertIndex = 0;

  for (let i = 0; i < contour.points.length; i++) {
    const p1 = contour.points[i];
    const p2 = contour.points[(i + 1) % contour.points.length];
    const dist = distanceToSegment(position, p1, p2);

    if (dist < minDist) {
      minDist = dist;
      insertIndex = i + 1;
    }
  }

  return insertIndex;
}

/**
 * Point Manipulation
 */

/**
 * Move a specific point in a contour
 */
export function movePoint(
  contour: Contour,
  pointIndex: number,
  newPosition: Point2D
): Contour {
  const newPoints = [...contour.points];
  newPoints[pointIndex] = newPosition;

  return {
    ...contour,
    points: newPoints
  };
}

/**
 * Elastic drag - move a point and affect nearby points with falloff
 */
export function elasticDrag(
  contour: Contour,
  dragIndex: number,
  delta: Point2D,
  radius: number = 50
): Contour {
  const newPoints = contour.points.map((point, i) => {
    if (i === dragIndex) {
      return {
        x: point.x + delta.x,
        y: point.y + delta.y
      };
    }

    // Calculate distance along contour (circular)
    const dist = Math.min(
      Math.abs(i - dragIndex),
      contour.points.length - Math.abs(i - dragIndex)
    );

    if (dist > radius / 10) return point; // Outside influence radius

    // Gaussian falloff
    const influence = Math.exp(-(dist * dist) / (2 * (radius / 30) * (radius / 30)));

    return {
      x: point.x + delta.x * influence,
      y: point.y + delta.y * influence
    };
  });

  return {
    ...contour,
    points: newPoints
  };
}

/**
 * Insert a point into a contour
 */
export function insertPoint(
  contour: Contour,
  position: Point2D,
  insertIndex?: number
): Contour {
  const index = insertIndex ?? findInsertPosition(position, contour);
  const newPoints = [
    ...contour.points.slice(0, index),
    position,
    ...contour.points.slice(index)
  ];

  return {
    ...contour,
    points: newPoints
  };
}

/**
 * Delete a point from a contour (with minimum point check)
 */
export function deletePoint(
  contour: Contour,
  pointIndex: number,
  minPoints: number = 3
): Contour | null {
  if (contour.points.length <= minPoints) {
    return null; // Can't delete, too few points
  }

  const newPoints = contour.points.filter((_, i) => i !== pointIndex);

  return {
    ...contour,
    points: newPoints
  };
}

/**
 * Smooth a section of a contour
 */
export function smoothSection(
  contour: Contour,
  startIndex: number,
  endIndex: number,
  iterations: number = 2
): Contour {
  const newPoints = [...contour.points];

  for (let iter = 0; iter < iterations; iter++) {
    const smoothed = [...newPoints];

    for (let i = startIndex; i <= endIndex; i++) {
      const idx = i % contour.points.length;
      const prev = newPoints[(idx - 1 + newPoints.length) % newPoints.length];
      const curr = newPoints[idx];
      const next = newPoints[(idx + 1) % newPoints.length];

      smoothed[idx] = {
        x: (prev.x + curr.x + next.x) / 3,
        y: (prev.y + curr.y + next.y) / 3
      };
    }

    for (let i = startIndex; i <= endIndex; i++) {
      const idx = i % contour.points.length;
      newPoints[idx] = smoothed[idx];
    }
  }

  return {
    ...contour,
    points: newPoints
  };
}

/**
 * 3D Smoothing Operations
 */

/**
 * Smooth contours in-plane (2D smoothing per slice)
 */
export function smooth2D(
  contour: Contour,
  iterations: number = 3,
  strength: number = 0.5
): Contour {
  let points = [...contour.points];

  for (let iter = 0; iter < iterations; iter++) {
    const newPoints: Point2D[] = [];

    for (let i = 0; i < points.length; i++) {
      const prev = points[(i - 1 + points.length) % points.length];
      const curr = points[i];
      const next = points[(i + 1) % points.length];

      const avgX = (prev.x + curr.x + next.x) / 3;
      const avgY = (prev.y + curr.y + next.y) / 3;

      newPoints.push({
        x: curr.x + (avgX - curr.x) * strength,
        y: curr.y + (avgY - curr.y) * strength
      });
    }

    points = newPoints;
  }

  return {
    ...contour,
    points
  };
}

/**
 * Smooth contours across slices (3D temporal smoothing)
 */
export function smooth3D(
  structure: Structure3D,
  iterations: number = 2,
  strength: number = 0.5
): Structure3D {
  // Group contours by slice
  let sliceMap = new Map<number, Contour[]>();
  for (const contour of structure.contours) {
    const sliceContours = sliceMap.get(contour.sliceIndex) || [];
    sliceContours.push(contour);
    sliceMap.set(contour.sliceIndex, sliceContours);
  }

  const sortedSlices = Array.from(sliceMap.keys()).sort((a, b) => a - b);

  // Apply smoothing iteratively, using results from previous iteration
  for (let iter = 0; iter < iterations; iter++) {
    const smoothedContours: Contour[] = [];
    
    for (let i = 0; i < sortedSlices.length; i++) {
      const sliceIndex = sortedSlices[i];
      const contours = sliceMap.get(sliceIndex)!;

      // Get adjacent slices
      const prevSlice = i > 0 ? sliceMap.get(sortedSlices[i - 1]) : null;
      const nextSlice = i < sortedSlices.length - 1 ? sliceMap.get(sortedSlices[i + 1]) : null;

      for (const contour of contours) {
        // For simplicity, match first contour of adjacent slices
        // In production, would use contour matching based on proximity/overlap
        const prevContour = prevSlice?.[0];
        const nextContour = nextSlice?.[0];

        if (prevContour && nextContour) {
          // Resample to same point count
          const maxPoints = Math.max(contour.points.length, prevContour.points.length, nextContour.points.length);
          const resampled = resampleContourPoints(contour.points, maxPoints);
          const resampledPrev = resampleContourPoints(prevContour.points, maxPoints);
          const resampledNext = resampleContourPoints(nextContour.points, maxPoints);

          // Average with neighbors
          const smoothedPoints = resampled.map((p, idx) => ({
            x: p.x + (resampledPrev[idx].x + resampledNext[idx].x - 2 * p.x) * strength / 4,
            y: p.y + (resampledPrev[idx].y + resampledNext[idx].y - 2 * p.y) * strength / 4
          }));

          smoothedContours.push({
            ...contour,
            points: smoothedPoints
          });
        } else {
          smoothedContours.push(contour);
        }
      }
    }
    
    // Update sliceMap with smoothed results for next iteration
    sliceMap = new Map<number, Contour[]>();
    for (const contour of smoothedContours) {
      const sliceContours = sliceMap.get(contour.sliceIndex) || [];
      sliceContours.push(contour);
      sliceMap.set(contour.sliceIndex, sliceContours);
    }
  }

  // Collect final results
  const finalContours: Contour[] = [];
  for (const contours of sliceMap.values()) {
    finalContours.push(...contours);
  }

  return {
    ...structure,
    contours: finalContours.length > 0 ? finalContours : structure.contours
  };
}

/**
 * Margin Operations (Polygon Offsetting)
 */

/**
 * Expand or contract a contour by a given margin
 */
export function applyMargin(
  contour: Contour,
  margin: number,
  pixelSpacing: number = 1.0
): Contour | null {
  // Convert margin from mm to pixels
  const pixelMargin = margin / pixelSpacing;

  try {
    // Convert contour to polygon-clipping format
    const polygon: polygonClipping.Polygon = [[
      contour.points.map(p => [p.x, p.y] as polygonClipping.Pair)
    ]];

    // Use buffer operation to expand/contract
    // For expansion, we offset outward; for contraction, inward
    const offsetPolygon = offsetPolygon2D(polygon, pixelMargin);

    if (!offsetPolygon || offsetPolygon.length === 0) {
      return null; // Margin too large, contour disappeared
    }

    // Convert back to contour format
    const newPoints: Point2D[] = offsetPolygon[0][0].map(([x, y]) => ({ x, y }));

    return {
      ...contour,
      points: newPoints,
      id: `${contour.id}_margin_${margin}`
    };
  } catch (error) {
    console.error('Error applying margin:', error);
    return null; // Return null on error
  }
}

/**
 * Simple polygon offsetting (expansion/contraction)
 */
function offsetPolygon2D(
  polygon: polygonClipping.Polygon,
  distance: number
): polygonClipping.Polygon | null {
  const points = polygon[0][0];
  const n = points.length;
  const offsetPoints: polygonClipping.Pair[] = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    // Calculate normals of adjacent edges
    const v1 = { x: curr[0] - prev[0], y: curr[1] - prev[1] };
    const v2 = { x: next[0] - curr[0], y: next[1] - curr[1] };

    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (len1 === 0 || len2 === 0) continue;

    // Normalize
    v1.x /= len1; v1.y /= len1;
    v2.x /= len2; v2.y /= len2;

    // Perpendiculars (normals)
    const n1 = { x: -v1.y, y: v1.x };
    const n2 = { x: -v2.y, y: v2.x };

    // Average normal
    const nx = (n1.x + n2.x) / 2;
    const ny = (n1.y + n2.y) / 2;
    const nlen = Math.sqrt(nx * nx + ny * ny);

    if (nlen === 0) continue;

    // Offset point
    const scale = distance / nlen;
    offsetPoints.push([
      curr[0] + nx * scale,
      curr[1] + ny * scale
    ]);
  }

  if (offsetPoints.length < 3) return null;

  return [[offsetPoints]];
}

/**
 * Boolean Operations
 */

export enum BooleanOp {
  UNION = 'union',
  INTERSECTION = 'intersection',
  DIFFERENCE = 'difference',
  XOR = 'xor'
}

/**
 * Perform boolean operation on two contours
 */
export function booleanOperation(
  contour1: Contour,
  contour2: Contour,
  operation: BooleanOp
): Contour[] {
  try {
    // Convert to polygon-clipping format
    const poly1: polygonClipping.Polygon = [[
      contour1.points.map(p => [p.x, p.y] as polygonClipping.Pair)
    ]];
    const poly2: polygonClipping.Polygon = [[
      contour2.points.map(p => [p.x, p.y] as polygonClipping.Pair)
    ]];

    let result: polygonClipping.MultiPolygon;

    switch (operation) {
      case BooleanOp.UNION:
        result = polygonClipping.union(poly1, poly2);
        break;
      case BooleanOp.INTERSECTION:
        result = polygonClipping.intersection(poly1, poly2);
        break;
      case BooleanOp.DIFFERENCE:
        result = polygonClipping.difference(poly1, poly2);
        break;
      case BooleanOp.XOR:
        result = polygonClipping.xor(poly1, poly2);
        break;
      default:
        return [contour1];
    }

    // Convert result back to contours
    const resultContours: Contour[] = [];
    for (let i = 0; i < result.length; i++) {
      for (let j = 0; j < result[i].length; j++) {
        const ring = result[i][j];
        const points: Point2D[] = ring.map(([x, y]) => ({ x, y }));

        if (points.length >= 3) {
          resultContours.push({
            id: `${operation}_${contour1.id}_${contour2.id}_${i}_${j}`,
            points,
            sliceIndex: contour1.sliceIndex,
            structureId: contour1.structureId,
            isClosed: true,
            color: contour1.color
          });
        }
      }
    }

    return resultContours;
  } catch (error) {
    console.error('Boolean operation error:', error);
    return [contour1];
  }
}

/**
 * Crop one contour with another (with margin)
 */
export function cropWithMargin(
  targetContour: Contour,
  cropContour: Contour,
  margin: number = 0,
  pixelSpacing: number = 1.0
): Contour | null {
  // First apply margin to crop contour if specified
  let cropWithMargin = cropContour;
  if (margin !== 0) {
    const margined = applyMargin(cropContour, margin, pixelSpacing);
    if (!margined) return targetContour;
    cropWithMargin = margined;
  }

  // Perform intersection
  const result = booleanOperation(targetContour, cropWithMargin, BooleanOp.INTERSECTION);

  return result.length > 0 ? result[0] : null;
}

/**
 * Semi-Automatic Segmentation
 */

export interface ImageData2D {
  width: number;
  height: number;
  data: Uint8Array | Uint16Array;
  windowWidth: number;
  windowCenter: number;
}

/**
 * Threshold-based segmentation
 */
export function thresholdSegmentation(
  imageData: ImageData2D,
  minHU: number,
  maxHU: number,
  rescaleSlope: number = 1,
  rescaleIntercept: number = 0
): Point2D[][] {
  const { width, height, data } = imageData;
  const mask: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));

  // Create binary mask based on threshold
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const pixelValue = data[index];
      const hu = pixelValue * rescaleSlope + rescaleIntercept;

      if (hu >= minHU && hu <= maxHU) {
        mask[y][x] = true;
      }
    }
  }

  // Find contours using marching squares
  return findContoursFromMask(mask);
}

/**
 * Region growing segmentation
 */
export function regionGrowing(
  imageData: ImageData2D,
  seedPoint: Point2D,
  tolerance: number = 50,
  rescaleSlope: number = 1,
  rescaleIntercept: number = 0
): Point2D[] {
  const { width, height, data } = imageData;
  const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
  const region: Point2D[] = [];

  const x = Math.floor(seedPoint.x);
  const y = Math.floor(seedPoint.y);

  if (x < 0 || x >= width || y < 0 || y >= height) return [];

  const seedValue = data[y * width + x] * rescaleSlope + rescaleIntercept;
  const queue: Point2D[] = [{ x, y }];

  while (queue.length > 0) {
    const point = queue.shift()!;
    const px = Math.floor(point.x);
    const py = Math.floor(point.y);

    if (px < 0 || px >= width || py < 0 || py >= height) continue;
    if (visited[py][px]) continue;

    const value = data[py * width + px] * rescaleSlope + rescaleIntercept;
    if (Math.abs(value - seedValue) > tolerance) continue;

    visited[py][px] = true;
    region.push({ x: px, y: py });

    // Add neighbors
    queue.push({ x: px + 1, y: py });
    queue.push({ x: px - 1, y: py });
    queue.push({ x: px, y: py + 1 });
    queue.push({ x: px, y: py - 1 });
  }

  // Convert region to contour (find boundary)
  return findBoundary(region, width, height);
}

/**
 * Magic wand / flood fill tool
 */
export function magicWand(
  imageData: ImageData2D,
  seedPoint: Point2D,
  tolerance: number = 30,
  rescaleSlope: number = 1,
  rescaleIntercept: number = 0
): Point2D[] {
  // Magic wand is essentially region growing with a different name
  return regionGrowing(imageData, seedPoint, tolerance, rescaleSlope, rescaleIntercept);
}

/**
 * Helper: Find contours from binary mask using marching squares
 */
function findContoursFromMask(mask: boolean[][]): Point2D[][] {
  const height = mask.length;
  const width = mask[0]?.length || 0;
  const contours: Point2D[][] = [];
  const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));

  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      if (mask[y][x] && !visited[y][x]) {
        const contour = traceContour(mask, visited, x, y);
        if (contour.length >= 3) {
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

/**
 * Helper: Trace a contour from a starting point
 */
function traceContour(
  mask: boolean[][],
  visited: boolean[][],
  startX: number,
  startY: number
): Point2D[] {
  const contour: Point2D[] = [];
  const height = mask.length;
  const width = mask[0].length;

  let x = startX;
  let y = startY;
  let dir = 0; // 0=right, 1=down, 2=left, 3=up
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const maxSteps = width * height;
  let steps = 0;

  do {
    visited[y][x] = true;
    contour.push({ x: x + 0.5, y: y + 0.5 }); // Center of pixel

    // Try to turn left first (wall following)
    let found = false;
    for (let i = 0; i < 4; i++) {
      const newDir = (dir + 3 + i) % 4; // Try left, straight, right, back
      const dx = dirs[newDir][0];
      const dy = dirs[newDir][1];
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny][nx]) {
        x = nx;
        y = ny;
        dir = newDir;
        found = true;
        break;
      }
    }

    if (!found) break;
    steps++;
  } while ((x !== startX || y !== startY) && steps < maxSteps);

  return contour;
}

/**
 * Helper: Find boundary points from a region
 */
function findBoundary(
  region: Point2D[],
  width: number,
  height: number
): Point2D[] {
  const regionSet = new Set(region.map(p => `${Math.floor(p.x)},${Math.floor(p.y)}`));
  const boundary: Point2D[] = [];

  for (const point of region) {
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);

    // Check if point is on boundary (has at least one non-region neighbor)
    const neighbors = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
      [x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (!regionSet.has(`${nx},${ny}`)) {
        boundary.push({ x, y });
        break;
      }
    }
  }

  // Order boundary points to form a contour
  return orderBoundaryPoints(boundary);
}

/**
 * Helper: Order boundary points to form a proper contour
 */
const MAX_BOUNDARY_GAP_DISTANCE = 5; // Maximum distance to consider points connected

function orderBoundaryPoints(points: Point2D[]): Point2D[] {
  if (points.length === 0) return [];

  const ordered: Point2D[] = [points[0]];
  const remaining = new Set(points.slice(1));

  while (remaining.size > 0) {
    const last = ordered[ordered.length - 1];
    let closest: Point2D | null = null;
    let minDist = Infinity;

    for (const point of remaining) {
      const d = distance(last, point);
      if (d < minDist) {
        minDist = d;
        closest = point;
      }
    }

    if (closest && minDist < MAX_BOUNDARY_GAP_DISTANCE) {
      ordered.push(closest);
      remaining.delete(closest);
    } else {
      break; // Gap too large, stop
    }
  }

  return ordered;
}

/**
 * Helper: Resample contour to target number of points
 */
function resampleContourPoints(points: Point2D[], targetCount: number): Point2D[] {
  if (points.length <= 1) return points;

  const totalLength = calculatePathLength(points);
  const segmentLength = totalLength / (targetCount - 1);

  const resampled: Point2D[] = [points[0]];
  let currentLength = 0;
  let targetLength = segmentLength;

  for (let i = 1; i < points.length; i++) {
    const segLen = distance(points[i - 1], points[i]);
    currentLength += segLen;

    while (currentLength >= targetLength && resampled.length < targetCount) {
      const t = (targetLength - (currentLength - segLen)) / segLen;
      const interpolated = {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t
      };

      resampled.push(interpolated);
      targetLength += segmentLength;
    }
  }

  if (resampled.length < targetCount) {
    resampled.push(points[points.length - 1]);
  }

  return resampled.slice(0, targetCount);
}

/**
 * Helper: Calculate total path length
 */
function calculatePathLength(points: Point2D[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1], points[i]);
  }
  return length;
}

/**
 * Helper: Calculate distance between two points
 */
function distance(p1: Point2D, p2: Point2D): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Helper: Calculate squared distance
 */
function distance2(p1: Point2D, p2: Point2D): number {
  return Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2);
}

/**
 * Copy/Paste Operations
 */

export interface ClipboardContour {
  contour: Contour;
  sourceSlice: number;
}

let clipboard: ClipboardContour | null = null;

export function copyContour(contour: Contour): void {
  clipboard = {
    contour: { ...contour },
    sourceSlice: contour.sliceIndex
  };
}

export function pasteContour(targetSlice: number, structureId?: string): Contour | null {
  if (!clipboard) return null;

  return {
    ...clipboard.contour,
    id: `paste_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    sliceIndex: targetSlice,
    structureId: structureId || clipboard.contour.structureId
  };
}

export function hasClipboard(): boolean {
  return clipboard !== null;
}

export function clearClipboard(): void {
  clipboard = null;
}
