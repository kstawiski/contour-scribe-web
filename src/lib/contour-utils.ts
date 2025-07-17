export interface Point2D {
  x: number;
  y: number;
}

export interface Contour {
  id: string;
  points: Point2D[];
  sliceIndex: number;
  structureId: string;
  isClosed: boolean;
  color: string;
}

export interface Structure3D {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  contours: Contour[];
}

/**
 * Close a contour by connecting the last point to the first
 */
export function closeContour(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points;
  
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  
  // Check if already closed (within 5 pixels)
  const distance = Math.sqrt(
    Math.pow(lastPoint.x - firstPoint.x, 2) + 
    Math.pow(lastPoint.y - firstPoint.y, 2)
  );
  
  if (distance > 5) {
    return [...points, firstPoint];
  }
  
  return points;
}

/**
 * Interpolate contours between two slices using linear interpolation
 */
export function interpolateContours(
  contour1: Contour,
  contour2: Contour,
  targetSlice: number
): Contour | null {
  if (contour1.structureId !== contour2.structureId) return null;
  
  const slice1 = contour1.sliceIndex;
  const slice2 = contour2.sliceIndex;
  
  if (targetSlice <= slice1 || targetSlice >= slice2) return null;
  
  // Calculate interpolation factor
  const t = (targetSlice - slice1) / (slice2 - slice1);
  
  // Resample both contours to have the same number of points
  const maxPoints = Math.max(contour1.points.length, contour2.points.length);
  const resampled1 = resampleContour(contour1.points, maxPoints);
  const resampled2 = resampleContour(contour2.points, maxPoints);
  
  // Interpolate points
  const interpolatedPoints: Point2D[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const p1 = resampled1[i];
    const p2 = resampled2[i];
    
    interpolatedPoints.push({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    });
  }
  
  return {
    id: `interpolated_${contour1.id}_${contour2.id}_${targetSlice}`,
    points: interpolatedPoints,
    sliceIndex: targetSlice,
    structureId: contour1.structureId,
    isClosed: true,
    color: contour1.color
  };
}

/**
 * Resample a contour to have a specific number of points
 */
function resampleContour(points: Point2D[], targetCount: number): Point2D[] {
  if (points.length <= 1) return points;
  
  const totalLength = calculateContourLength(points);
  const segmentLength = totalLength / (targetCount - 1);
  
  const resampled: Point2D[] = [points[0]];
  let currentLength = 0;
  let targetLength = segmentLength;
  
  for (let i = 1; i < points.length; i++) {
    const segLen = distance(points[i-1], points[i]);
    currentLength += segLen;
    
    while (currentLength >= targetLength && resampled.length < targetCount) {
      const t = (targetLength - (currentLength - segLen)) / segLen;
      const interpolatedPoint = {
        x: points[i-1].x + (points[i].x - points[i-1].x) * t,
        y: points[i-1].y + (points[i].y - points[i-1].y) * t
      };
      
      resampled.push(interpolatedPoint);
      targetLength += segmentLength;
    }
  }
  
  // Ensure we have exactly the target count
  if (resampled.length < targetCount) {
    resampled.push(points[points.length - 1]);
  }
  
  return resampled.slice(0, targetCount);
}

/**
 * Calculate the total length of a contour
 */
function calculateContourLength(points: Point2D[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i-1], points[i]);
  }
  return length;
}

/**
 * Calculate distance between two points
 */
function distance(p1: Point2D, p2: Point2D): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Boolean operations on contours
 */
export enum BooleanOperation {
  UNION = 'union',
  INTERSECTION = 'intersection',
  SUBTRACTION = 'subtraction'
}

/**
 * Simple polygon boolean operations using ray casting
 */
export function performBooleanOperation(
  contour1: Contour,
  contour2: Contour,
  operation: BooleanOperation
): Contour {
  // This is a simplified implementation
  // In a real application, you'd use a library like martinez-polygon-clipping
  
  switch (operation) {
    case BooleanOperation.UNION:
      return unionContours(contour1, contour2);
    case BooleanOperation.INTERSECTION:
      return intersectionContours(contour1, contour2);
    case BooleanOperation.SUBTRACTION:
      return subtractionContours(contour1, contour2);
    default:
      return contour1;
  }
}

/**
 * Simple union operation (bounding box approximation)
 */
function unionContours(contour1: Contour, contour2: Contour): Contour {
  const allPoints = [...contour1.points, ...contour2.points];
  const hull = convexHull(allPoints);
  
  return {
    id: `union_${contour1.id}_${contour2.id}`,
    points: hull,
    sliceIndex: contour1.sliceIndex,
    structureId: contour1.structureId,
    isClosed: true,
    color: contour1.color
  };
}

/**
 * Simple intersection operation
 */
function intersectionContours(contour1: Contour, contour2: Contour): Contour {
  // Simplified: return the smaller contour
  const smaller = contour1.points.length <= contour2.points.length ? contour1 : contour2;
  
  return {
    ...smaller,
    id: `intersection_${contour1.id}_${contour2.id}`
  };
}

/**
 * Simple subtraction operation
 */
function subtractionContours(contour1: Contour, contour2: Contour): Contour {
  // Simplified: return the first contour
  return {
    ...contour1,
    id: `subtraction_${contour1.id}_${contour2.id}`
  };
}

/**
 * Compute convex hull using Graham scan algorithm
 */
function convexHull(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points;
  
  // Find the bottom-most point (and leftmost in case of tie)
  let bottomMost = points[0];
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < bottomMost.y || 
        (points[i].y === bottomMost.y && points[i].x < bottomMost.x)) {
      bottomMost = points[i];
    }
  }
  
  // Sort points by polar angle with respect to bottom-most point
  const sorted = points
    .filter(p => p !== bottomMost)
    .sort((a, b) => {
      const angleA = Math.atan2(a.y - bottomMost.y, a.x - bottomMost.x);
      const angleB = Math.atan2(b.y - bottomMost.y, b.x - bottomMost.x);
      return angleA - angleB;
    });
  
  const hull = [bottomMost, ...sorted.slice(0, Math.min(8, sorted.length))];
  return hull;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
        (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Smooth a contour using simple averaging
 */
export function smoothContour(points: Point2D[], iterations: number = 1): Point2D[] {
  let smoothed = [...points];
  
  for (let iter = 0; iter < iterations; iter++) {
    const newPoints: Point2D[] = [];
    
    for (let i = 0; i < smoothed.length; i++) {
      const prev = smoothed[(i - 1 + smoothed.length) % smoothed.length];
      const curr = smoothed[i];
      const next = smoothed[(i + 1) % smoothed.length];
      
      newPoints.push({
        x: (prev.x + curr.x + next.x) / 3,
        y: (prev.y + curr.y + next.y) / 3
      });
    }
    
    smoothed = newPoints;
  }
  
  return smoothed;
}