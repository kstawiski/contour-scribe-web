/* eslint-disable @typescript-eslint/no-explicit-any */
import * as dicomParser from 'dicom-parser';

export interface DicomImage {
  arrayBuffer: ArrayBuffer;
  dataSet: any;
  pixelData: Uint16Array | Uint8Array;
  width: number;
  height: number;
  windowCenter: number;
  windowWidth: number;
  rescaleIntercept: number;
  rescaleSlope: number;
  seriesInstanceUID: string;
  sopInstanceUID: string;
  sopClassUID?: string;
  imagePosition?: number[];
  imageOrientation?: number[];
  sliceLocation?: number;
  sliceThickness?: number;
  pixelSpacing?: number[];
  frameOfReferenceUID?: string;
  studyInstanceUID?: string;
}

export interface DicomStructure {
  name: string;
  color: [number, number, number];
  contours: Array<{
    points: number[][];
    sliceIndex: number;
  }>;
}

export interface DicomRTStruct {
  structures: DicomStructure[];
  frameOfReference: string;
}

export class DicomProcessor {
  static parseDicomFile(arrayBuffer: ArrayBuffer): DicomImage | null {
    try {
      const byteArray = new Uint8Array(arrayBuffer);
      const dataSet = dicomParser.parseDicom(byteArray);

      // Extract basic image information
      const width = dataSet.uint16('x00280011'); // Columns
      const height = dataSet.uint16('x00280010'); // Rows
      const bitsAllocated = dataSet.uint16('x00280100') || 16;
      const bitsStored = dataSet.uint16('x00280101') || 16;
      const highBit = dataSet.uint16('x00280102') || 15;
      const pixelRepresentation = dataSet.uint16('x00280103') || 0;

      // Window/Level settings
      const windowCenter = dataSet.floatString('x00281050') || 0;
      const windowWidth = dataSet.floatString('x00281051') || 1;

      // Rescale parameters
      const rescaleIntercept = dataSet.floatString('x00281052') || 0;
      const rescaleSlope = dataSet.floatString('x00281053') || 1;

      // Series and instance information
      const seriesInstanceUID = dataSet.string('x0020000e') || '';
      const sopInstanceUID = dataSet.string('x00080018') || '';
      const sopClassUID = dataSet.string('x00080016') || undefined;
      const frameOfReferenceUID = dataSet.string('x00200052') || undefined;
      const studyInstanceUID = dataSet.string('x0020000d') || undefined;

      // Image position, slice location, and spacing information
      const imagePosition = dataSet.string('x00200032')?.split('\\').map(Number);
      const imageOrientation = dataSet
        .string('x00200037')
        ?.split('\\')
        .map(Number);
      const sliceLocation = dataSet.floatString('x00201041');
      const sliceThickness = dataSet.floatString('x00180050');
      const pixelSpacing = dataSet.string('x00280030')?.split('\\').map(Number);

      // Extract pixel data
      const pixelDataElement = dataSet.elements.x7fe00010;
      if (!pixelDataElement) {
        throw new Error('No pixel data found');
      }

      let pixelData: Uint16Array | Uint8Array;
      const pixelDataOffset = pixelDataElement.dataOffset;
      const pixelDataLength = pixelDataElement.length;

      if (bitsAllocated === 16) {
        pixelData = new Uint16Array(
          arrayBuffer.slice(pixelDataOffset, pixelDataOffset + pixelDataLength)
        );
      } else {
        pixelData = new Uint8Array(
          arrayBuffer.slice(pixelDataOffset, pixelDataOffset + pixelDataLength)
        );
      }

      return {
        arrayBuffer,
        dataSet,
        pixelData,
        width,
        height,
        windowCenter,
        windowWidth,
        rescaleIntercept,
        rescaleSlope,
        seriesInstanceUID,
        sopInstanceUID,
        sopClassUID,
        imagePosition,
        imageOrientation,
        sliceLocation,
        sliceThickness,
        pixelSpacing,
        frameOfReferenceUID,
        studyInstanceUID,
      };
    } catch (error) {
      console.error('Error parsing DICOM file:', error);
      return null;
    }
  }

  static parseRTStruct(arrayBuffer: ArrayBuffer): DicomRTStruct | null {
    try {
      const byteArray = new Uint8Array(arrayBuffer);
      const dataSet = dicomParser.parseDicom(byteArray);

      // Verify this is an RT Structure Set
      const sopClassUID = dataSet.string('x00080016');
      if (sopClassUID !== '1.2.840.10008.5.1.4.1.1.481.3') {
        throw new Error('Not a valid RT Structure Set');
      }

      const frameOfReference = dataSet.string('x00200052') || '';
      const structures: DicomStructure[] = [];

      // Parse Structure Set ROI Sequence
      const roiSequence = dataSet.elements.x30060020;
      const contourSequence = dataSet.elements.x30060039;

      if (roiSequence && contourSequence) {
        // This is a simplified parser - real implementation would be more complex
        const roiItems = this.parseSequence(dataSet, roiSequence);
        const contourItems = this.parseSequence(dataSet, contourSequence);

        roiItems.forEach((roiItem: any, index: number) => {
          const roiNumber = roiItem.uint16('x30060022');
          const roiName = roiItem.string('x30060026') || `Structure_${index + 1}`;

          // Find corresponding contour
          const contourItem = contourItems.find((item: any) => 
            item.uint16('x30060084') === roiNumber
          );

          if (contourItem) {
            const structure: DicomStructure = {
              name: roiName,
              color: [Math.random() * 255, Math.random() * 255, Math.random() * 255],
              contours: []
            };

            // Parse contours (simplified)
            const contourSeq = contourItem.elements?.x30060040;
            if (contourSeq) {
              const contours = this.parseSequence(contourItem, contourSeq);
              contours.forEach((contour: any, contourIndex: number) => {
                const contourData = contour.string('x30060050');
                if (contourData) {
                  const points = contourData.split('\\').map(Number);
                  const pointPairs = [];
                  for (let i = 0; i < points.length; i += 3) {
                    pointPairs.push([points[i], points[i + 1], points[i + 2]]);
                  }
                  
                  // Don't try to calculate slice index here - use actual Z coordinate
                  // The viewer will match contours to slices based on Z position
                  
                  structure.contours.push({
                    points: pointPairs,
                    sliceIndex: 0 // Will be matched by Z coordinate in viewer
                  });
                }
              });
            }

            structures.push(structure);
          }
        });
      }

      return {
        structures,
        frameOfReference
      };
    } catch (error) {
      console.error('Error parsing RT Structure:', error);
      return null;
    }
  }

  private static parseSequence(dataSet: any, element: any): any[] {
    const items = [];
    if (element && element.items) {
      for (const item of element.items) {
        items.push(item.dataSet);
      }
    }
    return items;
  }

  static applyWindowLevel(
    pixelData: Uint16Array | Uint8Array,
    windowCenter: number,
    windowWidth: number,
    rescaleSlope: number = 1,
    rescaleIntercept: number = 0
  ): Uint8Array {
    const output = new Uint8Array(pixelData.length);
    const windowMin = windowCenter - windowWidth / 2;
    const windowMax = windowCenter + windowWidth / 2;

    for (let i = 0; i < pixelData.length; i++) {
      // Apply rescaling
      const rescaled = pixelData[i] * rescaleSlope + rescaleIntercept;

      // Apply windowing
      if (rescaled <= windowMin) {
        output[i] = 0;
      } else if (rescaled >= windowMax) {
        output[i] = 255;
      } else {
        output[i] = Math.round(((rescaled - windowMin) / windowWidth) * 255);
      }
    }

    return output;
  }

  static renderImageToCanvas(
    canvas: HTMLCanvasElement,
    image: DicomImage,
    windowCenter?: number,
    windowWidth?: number
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = image.width;
    canvas.height = image.height;

    const wc = windowCenter ?? image.windowCenter;
    const ww = windowWidth ?? image.windowWidth;

    const displayData = this.applyWindowLevel(
      image.pixelData,
      wc,
      ww,
      image.rescaleSlope,
      image.rescaleIntercept
    );

    const imageData = ctx.createImageData(image.width, image.height);
    for (let i = 0; i < displayData.length; i++) {
      const pixelIndex = i * 4;
      const value = displayData[i];
      imageData.data[pixelIndex] = value;     // R
      imageData.data[pixelIndex + 1] = value; // G
      imageData.data[pixelIndex + 2] = value; // B
      imageData.data[pixelIndex + 3] = 255;   // A
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Match RT Structure contours to CT image slices based on Z-coordinates.
   * This improves upon the default sliceIndex: 0 by calculating proper indices.
   * 
   * Note: If no slice is found within tolerance (half slice thickness), the function
   * will still return the closest slice but log a warning. This behavior ensures
   * contours are always assigned to a slice for visualization, even if the match
   * is imperfect (e.g., due to slight misalignment in imaging data).
   */
  static matchContoursToSlices(
    rtStruct: DicomRTStruct,
    ctImages: DicomImage[]
  ): DicomRTStruct {
    if (!rtStruct || !ctImages || ctImages.length === 0) {
      return rtStruct;
    }

    // Create a copy of the RT structure to avoid mutation
    const matched: DicomRTStruct = {
      structures: rtStruct.structures.map(structure => ({
        ...structure,
        contours: structure.contours.map(contour => {
          if (contour.points.length === 0) {
            return { ...contour, sliceIndex: 0 };
          }

          // Get the Z coordinate from the first point of the contour
          const contourZ = contour.points[0][2];

          // Find the closest CT slice by Z coordinate
          let closestSliceIndex = 0;
          let minDistance = Infinity;

          ctImages.forEach((image, index) => {
            const sliceZ = image.sliceLocation ?? image.imagePosition?.[2] ?? 0;
            const distance = Math.abs(contourZ - sliceZ);

            if (distance < minDistance) {
              minDistance = distance;
              closestSliceIndex = index;
            }
          });

          // Check if the match is within a reasonable tolerance (half slice thickness)
          const matchedImage = ctImages[closestSliceIndex];
          const tolerance = (matchedImage.sliceThickness || 1.0) / 2;

          if (minDistance <= tolerance) {
            return { ...contour, sliceIndex: closestSliceIndex };
          } else {
            // If no good match, keep original index but log warning
            console.warn(
              `Contour Z=${contourZ} is not within tolerance of any CT slice (min distance: ${minDistance})`
            );
            return { ...contour, sliceIndex: closestSliceIndex };
          }
        }),
      })),
      frameOfReference: rtStruct.frameOfReference,
    };

    return matched;
  }

  /**
   * Get Hounsfield Unit value at a specific pixel coordinate
   * @param image - DICOM image
   * @param x - Pixel X coordinate (0-based)
   * @param y - Pixel Y coordinate (0-based)
   * @returns HU value or null if out of bounds
   */
  static getHUValueAtPixel(
    image: DicomImage,
    x: number,
    y: number
  ): number | null {
    // Check bounds
    if (x < 0 || x >= image.width || y < 0 || y >= image.height) {
      return null;
    }

    // Calculate pixel index
    const pixelIndex = Math.floor(y) * image.width + Math.floor(x);

    // Check if index is valid
    if (pixelIndex < 0 || pixelIndex >= image.pixelData.length) {
      return null;
    }

    // Get raw pixel value
    const rawValue = image.pixelData[pixelIndex];

    // Apply rescale slope and intercept to get HU value
    const huValue = rawValue * image.rescaleSlope + image.rescaleIntercept;

    return huValue;
  }

  /**
   * Get detailed pixel information at coordinates
   * @param image - DICOM image
   * @param x - Pixel X coordinate
   * @param y - Pixel Y coordinate
   * @returns Pixel info object or null if out of bounds
   */
  static getPixelInfo(
    image: DicomImage,
    x: number,
    y: number
  ): {
    x: number;
    y: number;
    hu: number;
    raw: number;
    worldX?: number;
    worldY?: number;
    worldZ?: number;
  } | null {
    const hu = this.getHUValueAtPixel(image, x, y);
    if (hu === null) return null;

    const pixelIndex = Math.floor(y) * image.width + Math.floor(x);
    const raw = image.pixelData[pixelIndex];

    // Calculate world coordinates if available
    let worldX, worldY, worldZ;
    if (image.imagePosition && image.pixelSpacing) {
      const position = image.imagePosition;
      const spacing = image.pixelSpacing;
      const orientation = image.imageOrientation || [1, 0, 0, 0, 1, 0];

      // Row and column direction cosines
      const rowCosines = [orientation[0], orientation[1], orientation[2]];
      const colCosines = [orientation[3], orientation[4], orientation[5]];

      worldX =
        position[0] +
        x * spacing[0] * rowCosines[0] +
        y * spacing[1] * colCosines[0];
      worldY =
        position[1] +
        x * spacing[0] * rowCosines[1] +
        y * spacing[1] * colCosines[1];
      worldZ =
        position[2] +
        x * spacing[0] * rowCosines[2] +
        y * spacing[1] * colCosines[2];
    }

    return {
      x: Math.floor(x),
      y: Math.floor(y),
      hu,
      raw,
      worldX,
      worldY,
      worldZ,
    };
  }
}