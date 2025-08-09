import * as nifti from 'nifti-reader-js';
import { DicomImage } from '@/lib/dicom-utils';

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
    const data = nifti.Utils.convertToTypedArray(header, image) as Float32Array;
    const width = header.dims[1];
    const height = header.dims[2];
    const depth = header.dims[3];
    const pixDims = [header.pixDims[1], header.pixDims[2], header.pixDims[3]];
    return { data, width, height, depth, pixDims };
  }

  static volumeToDicomImages(volume: NiftiVolume): DicomImage[] {
    const images: DicomImage[] = [];
    const { data, width, height, depth } = volume;
    const sliceSize = width * height;
    for (let z = 0; z < depth; z++) {
      const slice = new Uint16Array(sliceSize);
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
        sliceLocation: z,
        pixelSpacing: [1, 1],
        sliceThickness: 1,
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

