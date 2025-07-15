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
  imagePosition?: number[];
  sliceLocation?: number;
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

      // Image position and slice location
      const imagePosition = dataSet.string('x00200032')?.split('\\').map(Number);
      const sliceLocation = dataSet.floatString('x00201041');

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
        imagePosition,
        sliceLocation,
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
                  
                  // Calculate which slice this contour belongs to based on Z coordinate
                  const zPosition = pointPairs.length > 0 ? pointPairs[0][2] : 0;
                  const sliceIndex = Math.round(zPosition / 5); // Rough slice calculation
                  
                  structure.contours.push({
                    points: pointPairs,
                    sliceIndex: Math.max(0, sliceIndex) // Ensure positive slice index
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
      let value = pixelData[i] * rescaleSlope + rescaleIntercept;
      
      // Apply windowing
      if (value <= windowMin) {
        output[i] = 0;
      } else if (value >= windowMax) {
        output[i] = 255;
      } else {
        output[i] = Math.round(((value - windowMin) / windowWidth) * 255);
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
}