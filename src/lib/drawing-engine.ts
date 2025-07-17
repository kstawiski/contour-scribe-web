import { Point2D, Contour, Structure3D, interpolateContours, BooleanOperation, performBooleanOperation } from './contour-utils';

export class DrawingEngine {
  private structures: Map<string, Structure3D> = new Map();
  private activeStructureId: string | null = null;

  constructor() {}

  // Structure management
  addStructure(structure: Structure3D): void {
    this.structures.set(structure.id, structure);
  }

  removeStructure(structureId: string): void {
    this.structures.delete(structureId);
    if (this.activeStructureId === structureId) {
      this.activeStructureId = null;
    }
  }

  getStructure(structureId: string): Structure3D | undefined {
    return this.structures.get(structureId);
  }

  getAllStructures(): Structure3D[] {
    return Array.from(this.structures.values());
  }

  setActiveStructure(structureId: string | null): void {
    this.activeStructureId = structureId;
  }

  getActiveStructure(): Structure3D | null {
    return this.activeStructureId ? this.structures.get(this.activeStructureId) || null : null;
  }

  // Contour management
  addContour(structureId: string, contour: Contour): void {
    const structure = this.structures.get(structureId);
    if (!structure) return;

    const updatedStructure = {
      ...structure,
      contours: [...structure.contours, contour]
    };
    
    this.structures.set(structureId, updatedStructure);
  }

  removeContour(structureId: string, contourId: string): void {
    const structure = this.structures.get(structureId);
    if (!structure) return;

    const updatedStructure = {
      ...structure,
      contours: structure.contours.filter(c => c.id !== contourId)
    };
    
    this.structures.set(structureId, updatedStructure);
  }

  getContoursForSlice(sliceIndex: number): Contour[] {
    const allContours: Contour[] = [];
    
    for (const structure of this.structures.values()) {
      if (!structure.visible) continue;
      
      const sliceContours = structure.contours.filter(c => c.sliceIndex === sliceIndex);
      allContours.push(...sliceContours);
    }
    
    return allContours;
  }

  // Interpolation
  interpolateStructureBetweenSlices(
    structureId: string,
    slice1: number,
    slice2: number,
    targetSlices: number[]
  ): Contour[] {
    const structure = this.structures.get(structureId);
    if (!structure) return [];

    const contours1 = structure.contours.filter(c => c.sliceIndex === slice1);
    const contours2 = structure.contours.filter(c => c.sliceIndex === slice2);

    if (contours1.length === 0 || contours2.length === 0) return [];

    const interpolatedContours: Contour[] = [];

    // For simplicity, interpolate the first contour from each slice
    const contour1 = contours1[0];
    const contour2 = contours2[0];

    for (const targetSlice of targetSlices) {
      if (targetSlice <= slice1 || targetSlice >= slice2) continue;

      const interpolated = interpolateContours(contour1, contour2, targetSlice);
      if (interpolated) {
        interpolatedContours.push(interpolated);
        this.addContour(structureId, interpolated);
      }
    }

    return interpolatedContours;
  }

  // Boolean operations
  performBooleanOnStructures(
    structureId1: string,
    structureId2: string,
    operation: BooleanOperation,
    sliceIndex: number,
    resultStructureId: string
  ): void {
    const structure1 = this.structures.get(structureId1);
    const structure2 = this.structures.get(structureId2);

    if (!structure1 || !structure2) return;

    const contours1 = structure1.contours.filter(c => c.sliceIndex === sliceIndex);
    const contours2 = structure2.contours.filter(c => c.sliceIndex === sliceIndex);

    if (contours1.length === 0 || contours2.length === 0) return;

    // Perform boolean operation on first contour of each structure
    const result = performBooleanOperation(contours1[0], contours2[0], operation);
    
    // Update result structure ID
    result.structureId = resultStructureId;
    result.id = `${operation}_${structureId1}_${structureId2}_${sliceIndex}`;

    this.addContour(resultStructureId, result);
  }

  // Utility methods
  clearSlice(sliceIndex: number): void {
    for (const [structureId, structure] of this.structures) {
      const updatedStructure = {
        ...structure,
        contours: structure.contours.filter(c => c.sliceIndex !== sliceIndex)
      };
      this.structures.set(structureId, updatedStructure);
    }
  }

  exportToJSON(): string {
    const data = {
      structures: Array.from(this.structures.values()),
      activeStructureId: this.activeStructureId
    };
    return JSON.stringify(data, null, 2);
  }

  importFromJSON(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      this.structures.clear();
      
      if (data.structures) {
        data.structures.forEach((structure: Structure3D) => {
          this.structures.set(structure.id, structure);
        });
      }
      
      this.activeStructureId = data.activeStructureId || null;
    } catch (error) {
      console.error('Failed to import drawing data:', error);
    }
  }

  // Statistics
  getStatistics(): {
    totalStructures: number;
    totalContours: number;
    contoursPerSlice: Map<number, number>;
    structureStats: Array<{
      id: string;
      name: string;
      contourCount: number;
      sliceRange: [number, number] | null;
    }>;
  } {
    const contoursPerSlice = new Map<number, number>();
    const structureStats: Array<{
      id: string;
      name: string;
      contourCount: number;
      sliceRange: [number, number] | null;
    }> = [];

    let totalContours = 0;

    for (const structure of this.structures.values()) {
      const contourCount = structure.contours.length;
      totalContours += contourCount;

      // Calculate slice range
      let sliceRange: [number, number] | null = null;
      if (contourCount > 0) {
        const slices = structure.contours.map(c => c.sliceIndex);
        sliceRange = [Math.min(...slices), Math.max(...slices)];
      }

      structureStats.push({
        id: structure.id,
        name: structure.name,
        contourCount,
        sliceRange
      });

      // Count contours per slice
      structure.contours.forEach(contour => {
        const currentCount = contoursPerSlice.get(contour.sliceIndex) || 0;
        contoursPerSlice.set(contour.sliceIndex, currentCount + 1);
      });
    }

    return {
      totalStructures: this.structures.size,
      totalContours,
      contoursPerSlice,
      structureStats
    };
  }
}

// Global instance
export const drawingEngine = new DrawingEngine();