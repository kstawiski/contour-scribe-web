import { describe, it, expect } from 'vitest';
import { DicomProcessor } from './dicom-utils';
import { DicomImage, DicomRTStruct } from '@/types';

describe('dicom-utils', () => {
    describe('matchContoursToSlices', () => {
        it('should match contours to slices based on Z coordinate', () => {
            // Mock CT Images
            const ctImages: DicomImage[] = [
                { sliceLocation: 0, sliceThickness: 2 } as any,
                { sliceLocation: 2, sliceThickness: 2 } as any,
                { sliceLocation: 4, sliceThickness: 2 } as any,
            ];

            // Mock RT Struct
            const rtStruct: DicomRTStruct = {
                frameOfReference: '1.2.3',
                structures: [
                    {
                        name: 'Structure1',
                        color: [255, 0, 0],
                        contours: [
                            { points: [[0, 0, 0], [10, 10, 0]], sliceIndex: 0 }, // Should match index 0
                            { points: [[0, 0, 2], [10, 10, 2]], sliceIndex: 0 }, // Should match index 1
                            { points: [[0, 0, 3.9], [10, 10, 3.9]], sliceIndex: 0 }, // Should match index 2 (within tolerance)
                        ],
                    },
                ],
            };

            const matched = DicomProcessor.matchContoursToSlices(rtStruct, ctImages);
            const contours = matched.structures[0].contours;

            expect(contours[0].sliceIndex).toBe(0);
            expect(contours[1].sliceIndex).toBe(1);
            expect(contours[2].sliceIndex).toBe(2);
        });

        it('should handle empty inputs gracefully', () => {
            const matched = DicomProcessor.matchContoursToSlices({ structures: [], frameOfReference: '' }, []);
            expect(matched.structures).toEqual([]);
        });
    });

    describe('getHUValueAtPixel', () => {
        it('should calculate HU value correctly', () => {
            const image: DicomImage = {
                width: 2,
                height: 2,
                pixelData: new Int16Array([0, 100, 1000, -1000]),
                rescaleSlope: 1,
                rescaleIntercept: -1024,
            } as any;

            // Pixel 0 (0,0) -> 0 * 1 - 1024 = -1024
            expect(DicomProcessor.getHUValueAtPixel(image, 0, 0)).toBe(-1024);

            // Pixel 1 (1,0) -> 100 * 1 - 1024 = -924
            expect(DicomProcessor.getHUValueAtPixel(image, 1, 0)).toBe(-924);
        });

        it('should return null for out of bounds', () => {
            const image: DicomImage = {
                width: 2,
                height: 2,
                pixelData: new Int16Array(4),
            } as any;

            expect(DicomProcessor.getHUValueAtPixel(image, 2, 0)).toBeNull();
            expect(DicomProcessor.getHUValueAtPixel(image, -1, 0)).toBeNull();
        });
    });
});
