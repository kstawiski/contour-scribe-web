import { describe, it, expect } from 'vitest';
import { worldToCanvas, canvasToWorld, getImageBounds, isPointInImage, CanvasConfig } from './coordinate-utils';
import { DicomImage } from '@/types';

// Mock DicomImage for testing
const createMockImage = (width: number, height: number, pixelSpacing = [1, 1], imagePosition = [0, 0, 0]): DicomImage => ({
    width,
    height,
    pixelSpacing,
    imagePosition,
    // Other required fields (mocked)
    arrayBuffer: new ArrayBuffer(0),
    dataSet: {},
    pixelData: new Uint8Array(0),
    windowCenter: 0,
    windowWidth: 0,
    rescaleIntercept: 0,
    rescaleSlope: 1,
    seriesInstanceUID: 'mock-series',
    sopInstanceUID: 'mock-sop',
});

describe('coordinate-utils', () => {
    const mockImage = createMockImage(512, 512, [0.5, 0.5], [0, 0, 0]);
    const defaultConfig: CanvasConfig = {
        canvasSize: 800,
        zoom: 1,
        pan: { x: 0, y: 0 },
    };

    describe('getImageBounds', () => {
        it('should calculate correct bounds for square image fitting in canvas', () => {
            const bounds = getImageBounds(mockImage, defaultConfig);
            // 512x512 image in 800x800 canvas
            // Max size is 800 * 0.95 = 760
            // Image should be scaled to 760x760
            // Centered: (800 - 760) / 2 = 20
            expect(bounds.width).toBeCloseTo(760);
            expect(bounds.height).toBeCloseTo(760);
            expect(bounds.x).toBeCloseTo(20);
            expect(bounds.y).toBeCloseTo(20);
        });

        it('should handle zoom', () => {
            const config = { ...defaultConfig, zoom: 2 };
            const bounds = getImageBounds(mockImage, config);
            expect(bounds.width).toBeCloseTo(1520); // 760 * 2
            expect(bounds.height).toBeCloseTo(1520);
            // Centered: (800 - 1520) / 2 = -360
            expect(bounds.x).toBeCloseTo(-360);
            expect(bounds.y).toBeCloseTo(-360);
        });

        it('should handle pan', () => {
            const config = { ...defaultConfig, pan: { x: 100, y: 50 } };
            const bounds = getImageBounds(mockImage, config);
            expect(bounds.x).toBeCloseTo(120); // 20 + 100
            expect(bounds.y).toBeCloseTo(70);  // 20 + 50
        });
    });

    describe('worldToCanvas', () => {
        it('should convert world origin to canvas coordinates', () => {
            // World (0,0) -> Pixel (0,0) -> Canvas Top-Left of image
            const canvasPoint = worldToCanvas(0, 0, mockImage, defaultConfig);
            const bounds = getImageBounds(mockImage, defaultConfig);
            expect(canvasPoint.x).toBeCloseTo(bounds.x);
            expect(canvasPoint.y).toBeCloseTo(bounds.y);
        });

        it('should convert world center to canvas center', () => {
            // Image is 512x512, spacing 0.5
            // World width = 512 * 0.5 = 256
            // Center is at (128, 128) in world coords (assuming origin at 0,0)
            // Wait, pixel (256, 256) is center.
            // World = 0 + 256 * 0.5 = 128.
            const canvasPoint = worldToCanvas(128, 128, mockImage, defaultConfig);
            expect(canvasPoint.x).toBeCloseTo(400); // Center of 800x800 canvas
            expect(canvasPoint.y).toBeCloseTo(400);
        });
    });

    describe('canvasToWorld', () => {
        it('should convert canvas center to world center', () => {
            const worldPoint = canvasToWorld(400, 400, mockImage, defaultConfig);
            expect(worldPoint.x).toBeCloseTo(128);
            expect(worldPoint.y).toBeCloseTo(128);
        });

        it('should be inverse of worldToCanvas', () => {
            const worldX = 50;
            const worldY = 100;
            const canvasPoint = worldToCanvas(worldX, worldY, mockImage, defaultConfig);
            const resultWorld = canvasToWorld(canvasPoint.x, canvasPoint.y, mockImage, defaultConfig);

            expect(resultWorld.x).toBeCloseTo(worldX);
            expect(resultWorld.y).toBeCloseTo(worldY);
        });
    });

    describe('isPointInImage', () => {
        it('should return true for point inside image', () => {
            expect(isPointInImage(400, 400, mockImage, defaultConfig)).toBe(true);
        });

        it('should return false for point outside image', () => {
            expect(isPointInImage(10, 10, mockImage, defaultConfig)).toBe(false);
        });
    });
});
