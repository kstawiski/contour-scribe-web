// DICOM Types
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

// Contour Types
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

// Editing Types
export interface SelectionInfo {
    contour: Contour;
    pointIndex?: number;
    distance: number;
}

export interface ImageData2D {
    width: number;
    height: number;
    data: Uint8Array | Uint16Array;
    windowWidth: number;
    windowCenter: number;
}

export enum BooleanOp {
    UNION = 'union',
    INTERSECTION = 'intersection',
    DIFFERENCE = 'difference',
    XOR = 'xor'
}
