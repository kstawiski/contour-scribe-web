import { saveAs } from 'file-saver';
import { DicomImage, DicomRTStruct, Point2D } from '@/types';

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
 * Convert world coordinates (patient space) to full 3D DICOM coordinates.
 *
 * The drawing system already stores points in patient X/Y millimetres, so we
 * simply add the slice's Z coordinate to obtain the full 3D position.
 */
function worldToDicomCoordinates(
  point: Point2D,
  image: DicomImage
): { x: number; y: number; z: number } {
  // World coordinates are already in patient space (mm). We only need to attach
  // the Z component from the slice metadata to form a full 3D coordinate.
  const z = image.sliceLocation ?? image.imagePosition?.[2] ?? 0;

  return { x: point.x, y: point.y, z };
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
    structures: (() => {
      let roiCounter = 1;
      return structures.map(structure => {
        const roiNumberFromId = parseInt(structure.id.replace(/\D/g, ''), 10);
        const roiNumber = roiNumberFromId || roiCounter++;
        const contourExportData = structure.contours.reduce<
          Array<{
            sliceIndex: number;
            sopInstanceUID: string;
            numberOfPoints: number;
            contourGeometricType: 'CLOSED_PLANAR' | 'OPEN_PLANAR';
            contourData: number[];
          }>
        >((acc, contour) => {
          const image = ctImages[contour.sliceIndex];
          if (!image) {
            console.warn(`Image not found for slice ${contour.sliceIndex}`);
            return acc;
          }

          const dicomPoints = contour.points.map(point =>
            worldToDicomCoordinates(point, image)
          );

          acc.push({
            sliceIndex: contour.sliceIndex,
            sopInstanceUID: image.sopInstanceUID,
            numberOfPoints: contour.points.length,
            contourGeometricType: contour.isClosed
              ? 'CLOSED_PLANAR'
              : 'OPEN_PLANAR',
            contourData: dicomPoints.flatMap(p => [p.x, p.y, p.z]),
          });

          return acc;
        }, []);

        return {
          id: structure.id,
          name: structure.name,
          color: structure.color,
          visible: structure.visible,
          roiNumber,
          contours: contourExportData,
        };
      });
    })(),
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
