import * as nifti from 'nifti-reader-js';
import { DicomImage } from '@/types';

export interface NiftiVolume {
  data: Float32Array;
  width: number;
  height: number;
  depth: number;
  pixDims: number[];
}

export class NiftiProcessor {
  static parseVolume(arrayBuffer: ArrayBuffer): NiftiVolume | null {
    if (!nifti.isNIFTI(arrayBuffer)) {
      return null;
    }
    const header = nifti.readHeader(arrayBuffer);
    const image = nifti.readImage(header, arrayBuffer);
    // nifti-reader-js types might be incomplete or different
    // @ts-ignore - nifti.Utils.convertToTypedArray exists in the library but might be missing in types
    const data = nifti.Utils.convertToTypedArray(header, image) as Float32Array;
    const width = header.dims[1];
    const height = header.dims[2];
    const depth = header.dims[3];
    const pixDims = [header.pixDims[1], header.pixDims[2], header.pixDims[3]];
    return { data, width, height, depth, pixDims };
  }

  static volumeToDicomImages(volume: NiftiVolume): DicomImage[] {
    const images: DicomImage[] = [];
    const { data, width, height, depth, pixDims } = volume;
    const sliceSize = width * height;

    // NIfTI pixDims: [dim, x, y, z, t, ...]
    // pixDims[1] is x spacing, pixDims[2] is y spacing, pixDims[3] is z spacing (slice thickness)
    const pixelSpacing: [number, number] = [pixDims[0], pixDims[1]]; // x, y
    const sliceThickness = pixDims[2];

    for (let z = 0; z < depth; z++) {
      const slice = new Uint16Array(sliceSize);

      // NIfTI data is often Float32, need to convert to Uint16 for display if needed, 
      // but DicomImage pixelData is usually expected to be raw pixel data.
      // The existing code clamps to 0 and rounds, which is okay for basic visualization 
      // but might lose negative values (CT often has negative HU).
      // However, DicomImage interface usually implies unsigned for display or raw for processing.
      // Let's stick to the existing conversion logic for now but ensure metadata is correct.

      for (let i = 0; i < sliceSize; i++) {
        slice[i] = Math.max(0, Math.round(data[z * sliceSize + i]));
      }

      images.push({
        arrayBuffer: slice.buffer,
        dataSet: null,
        pixelData: slice,
        width,
        height,
        windowCenter: 40,
        windowWidth: 400,
        rescaleIntercept: 0,
        rescaleSlope: 1,
        seriesInstanceUID: `nifti.${Date.now()}`,
        sopInstanceUID: `nifti.${Date.now()}.${z}`,
        sliceLocation: z * sliceThickness, // Approximate slice location based on thickness
        imagePosition: [0, 0, z * sliceThickness], // Add imagePosition for sorting
        pixelSpacing,
        sliceThickness,
      });
    }
    return images;
  }

  static parseProbabilityMap(arrayBuffer: ArrayBuffer): Float32Array[] | null {
    const volume = this.parseVolume(arrayBuffer);
    if (!volume) return null;
    const { data, width, height, depth } = volume;
    const sliceSize = width * height;
    const slices: Float32Array[] = [];
    for (let z = 0; z < depth; z++) {
      const slice = data.slice(z * sliceSize, (z + 1) * sliceSize);
      slices.push(slice as Float32Array);
    }
    return slices;
  }
}

