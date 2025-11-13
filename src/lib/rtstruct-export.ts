import { saveAs } from 'file-saver';
import { DicomImage, DicomRTStruct } from './dicom-utils';
import { Point2D } from './contour-utils';

interface ExportStructure {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  contours: ExportContour[];
}

interface ExportContour {
  id: string;
  points: Point2D[];
  sliceIndex: number;
  structureId: string;
  isClosed: boolean;
  color: string;
}

/**
 * Convert canvas/world coordinates back to DICOM patient coordinates
 */
function worldToDicomCoordinates(
  point: Point2D,
  image: DicomImage
): { x: number; y: number; z: number } {
  // Get image position and orientation
  const position = image.imagePosition || [0, 0, 0];
  const orientation = image.imageOrientation || [1, 0, 0, 0, 1, 0];
  const spacing = image.pixelSpacing || [1, 1];

  // Image orientation defines the direction cosines of the first row and first column
  const rowCosines = [orientation[0], orientation[1], orientation[2]];
  const colCosines = [orientation[3], orientation[4], orientation[5]];

  // Convert from pixel coordinates to patient coordinates
  // Patient coordinates = Image Position + (column * spacing[0] * rowCosines) + (row * spacing[1] * colCosines)
  const x = position[0] + point.x * spacing[0] * rowCosines[0] + point.y * spacing[1] * colCosines[0];
  const y = position[1] + point.x * spacing[0] * rowCosines[1] + point.y * spacing[1] * colCosines[1];
  const z = position[2] + point.x * spacing[0] * rowCosines[2] + point.y * spacing[1] * colCosines[2];

  return { x, y, z };
}

/**
 * Export RT Structure Set as JSON (DICOM-RT representation)
 */
export function exportRTStructAsJSON(
  structures: ExportStructure[],
  ctImages: DicomImage[],
  originalRTStruct?: DicomRTStruct
): void {
  const exportData = {
    metadata: {
      version: '1.0',
      exportDate: new Date().toISOString(),
      modality: 'RTSTRUCT',
      description: 'DICOM RT Structure Set exported from DicomEdit',
    },
    seriesInfo: {
      seriesInstanceUID: ctImages[0]?.seriesInstanceUID || 'UNKNOWN',
      frameOfReferenceUID: ctImages[0]?.frameOfReferenceUID || 'UNKNOWN',
      studyInstanceUID: ctImages[0]?.studyInstanceUID || 'UNKNOWN',
    },
    referencedImages: ctImages.map(img => ({
      sopInstanceUID: img.sopInstanceUID,
      sopClassUID: img.sopClassUID,
      sliceLocation: img.sliceLocation,
      imagePosition: img.imagePosition,
    })),
    structures: structures.map(structure => ({
      id: structure.id,
      name: structure.name,
      color: structure.color,
      visible: structure.visible,
      roiNumber: parseInt(structure.id.replace(/\D/g, '')) || Math.floor(Math.random() * 1000),
      contours: structure.contours.map(contour => {
        const image = ctImages[contour.sliceIndex];
        if (!image) {
          console.warn(`Image not found for slice ${contour.sliceIndex}`);
          return null;
        }

        // Convert all points to DICOM patient coordinates
        const dicomPoints = contour.points.map(point =>
          worldToDicomCoordinates(point, image)
        );

        return {
          sliceIndex: contour.sliceIndex,
          sopInstanceUID: image.sopInstanceUID,
          numberOfPoints: contour.points.length,
          contourGeometricType: 'CLOSED_PLANAR',
          // Flatten to array: [x1, y1, z1, x2, y2, z2, ...]
          contourData: dicomPoints.flatMap(p => [p.x, p.y, p.z]),
        };
      }).filter(c => c !== null),
    })),
  };

  // Create a blob and download
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });

  const filename = `rtstruct_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  saveAs(blob, filename);
}

/**
 * Export RT Structure Set as a simple CSV format (for analysis/debugging)
 */
export function exportRTStructAsCSV(
  structures: ExportStructure[],
  ctImages: DicomImage[]
): void {
  const rows: string[] = [
    'Structure ID,Structure Name,Contour ID,Slice Index,Point Index,X,Y,Z,Slice Location'
  ];

  structures.forEach(structure => {
    structure.contours.forEach(contour => {
      const image = ctImages[contour.sliceIndex];
      if (!image) return;

      contour.points.forEach((point, pointIndex) => {
        const dicomPoint = worldToDicomCoordinates(point, image);
        rows.push(
          `${structure.id},${structure.name},${contour.id},${contour.sliceIndex},${pointIndex},${dicomPoint.x},${dicomPoint.y},${dicomPoint.z},${image.sliceLocation}`
        );
      });
    });
  });

  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const filename = `rtstruct_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
  saveAs(blob, filename);
}

/**
 * Export RT Structure Set in a format compatible with research tools
 */
export function exportRTStructForResearch(
  structures: ExportStructure[],
  ctImages: DicomImage[]
): void {
  const exportData = {
    version: '1.0',
    exportTimestamp: new Date().toISOString(),
    imageInfo: {
      numberOfSlices: ctImages.length,
      pixelSpacing: ctImages[0]?.pixelSpacing || [1, 1],
      sliceThickness: ctImages[0]?.sliceThickness || 1,
      imageOrientation: ctImages[0]?.imageOrientation,
    },
    structures: structures.map(structure => ({
      name: structure.name,
      color: structure.color,
      sliceData: structure.contours.map(contour => ({
        sliceIndex: contour.sliceIndex,
        sliceLocation: ctImages[contour.sliceIndex]?.sliceLocation,
        points: contour.points,
        pointCount: contour.points.length,
        isClosed: contour.isClosed,
      })),
      totalContours: structure.contours.length,
    })),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });

  const filename = `rtstruct_research_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  saveAs(blob, filename);
}

/**
 * Main export function that handles multiple formats
 */
export function exportRTStruct(
  structures: ExportStructure[],
  ctImages: DicomImage[],
  format: 'json' | 'csv' | 'research' = 'json',
  originalRTStruct?: DicomRTStruct
): void {
  if (structures.length === 0) {
    throw new Error('No structures to export');
  }

  if (ctImages.length === 0) {
    throw new Error('No CT images available');
  }

  switch (format) {
    case 'json':
      exportRTStructAsJSON(structures, ctImages, originalRTStruct);
      break;
    case 'csv':
      exportRTStructAsCSV(structures, ctImages);
      break;
    case 'research':
      exportRTStructForResearch(structures, ctImages);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
