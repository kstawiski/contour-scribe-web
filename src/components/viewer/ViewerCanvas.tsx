import { RefObject, useMemo, useCallback } from "react";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { HUOverlay } from "@/components/HUOverlay";
import { DicomImage, Point2D } from "@/types";
import { useDrawing, DrawingTool } from "@/hooks/useDrawing";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft } from "lucide-react";

type ViewerTool = "select" | "pan" | "zoom" | "windowing";

interface ViewerCanvasProps {
    canvasRef: RefObject<HTMLCanvasElement>;
    viewerTool: ViewerTool;
    drawing: ReturnType<typeof useDrawing>;
    isDragging: boolean;
    onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseLeave: () => void;
    currentSlice: number;
    ctImages: DicomImage[];
    setZoom: (zoom: number | ((prev: number) => number)) => void;
    setCurrentSlice: (slice: number | ((prev: number) => number)) => void;
    onStartDrawing: (point: Point2D) => void;
    onAddPoint: (point: Point2D) => void;
    onFinishDrawing: () => void;
    onEraseAt: (point: Point2D) => void;
    onSelectContour: (canvasPoint: Point2D, selectPoint: boolean) => void;
    onMovePoint: (contourId: string, pointIndex: number, canvasPos: Point2D, elastic: boolean) => void;
    onInsertPoint: (contourId: string, canvasPos: Point2D) => void;
    onDeletePoint: (contourId: string, pointIndex: number) => void;
    mouseCanvasPos: { x: number; y: number } | null;
    huInfo: { pixelX: number; pixelY: number; huValue: number } | null;
    showHUOverlay: boolean;
    showCrosshair: boolean;
    worldToCanvas: (x: number, y: number) => Point2D;
}

export const ViewerCanvas = ({
    canvasRef,
    viewerTool,
    drawing,
    isDragging,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    currentSlice,
    ctImages,
    setZoom,
    setCurrentSlice,
    onStartDrawing,
    onAddPoint,
    onFinishDrawing,
    onEraseAt,
    onSelectContour,
    onMovePoint,
    onInsertPoint,
    onDeletePoint,
    mouseCanvasPos,
    huInfo,
    showHUOverlay,
    showCrosshair,
    worldToCanvas,
}: ViewerCanvasProps) => {
    return (
        <div className="flex-1 bg-black flex flex-col min-h-0">
            <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                <div className="relative w-full h-full flex items-center justify-center">
                    <canvas
                        ref={canvasRef}
                        className="shadow-elevation block max-w-full max-h-full"
                        style={{
                            imageRendering: "pixelated",
                            width: "auto",
                            height: "auto",
                            maxWidth: "100%",
                            maxHeight: "100%",
                            aspectRatio: "1 / 1",
                            border: "2px solid #333",
                            cursor:
                                isDragging && viewerTool === "pan" ? "grabbing" :
                                    viewerTool === "pan" ? "grab" :
                                        viewerTool === "windowing" ? "crosshair" :
                                            drawing.currentTool === "brush" ? "crosshair" :
                                                drawing.currentTool === "eraser" ? "cell" :
                                                    drawing.currentTool === "polygon" ? "crosshair" :
                                                        "default"
                        }}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseLeave}
                        onContextMenu={(e) => e.preventDefault()}
                    />

                    <DrawingCanvas
                        width={800}
                        height={800}
                        className="max-w-full max-h-full"
                        canvasStyle={{
                            width: "auto",
                            height: "auto",
                            maxWidth: "100%",
                            maxHeight: "100%",
                            aspectRatio: "1 / 1",
                        }}
                        contours={useMemo(() => drawing.getContoursForSlice(currentSlice).map(contour => ({
                            ...contour,
                            points: contour.points.map(worldPoint => worldToCanvas(worldPoint.x, worldPoint.y))
                        })), [drawing, currentSlice, worldToCanvas])}
                        currentPath={useMemo(() => drawing.currentPath.map(worldPoint => worldToCanvas(worldPoint.x, worldPoint.y)), [drawing.currentPath, worldToCanvas])}
                        currentTool={drawing.currentTool}
                        isDrawing={drawing.isDrawing}
                        brushSize={drawing.brushSize}
                        eraserSize={drawing.eraserSize}
                        onStartDrawing={onStartDrawing}
                        onAddPoint={onAddPoint}
                        onFinishDrawing={onFinishDrawing}
                        onEraseAt={onEraseAt}
                        onWheel={useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
                            if (e.ctrlKey || e.metaKey) {
                                e.preventDefault();
                                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                                setZoom(prev => Math.max(0.5, Math.min(5, prev * delta)));
                            } else {
                                e.preventDefault();
                                const newSlice = currentSlice + (e.deltaY > 0 ? 1 : -1);
                                if (newSlice >= 0 && newSlice < ctImages.length) {
                                    setCurrentSlice(newSlice);
                                }
                            }
                        }, [currentSlice, ctImages.length, setZoom, setCurrentSlice])}
                        selectedContour={drawing.selectedContour}
                        onSelectContour={onSelectContour}
                        onMovePoint={onMovePoint}
                        onInsertPoint={onInsertPoint}
                        onDeletePoint={onDeletePoint}
                    />

                    {/* HU Value Overlay */}
                    {mouseCanvasPos && huInfo && (
                        <HUOverlay
                            visible={showHUOverlay}
                            x={mouseCanvasPos.x}
                            y={mouseCanvasPos.y}
                            pixelX={huInfo.pixelX}
                            pixelY={huInfo.pixelY}
                            huValue={huInfo.huValue}
                            sliceNumber={currentSlice}
                            totalSlices={ctImages.length}
                            showCrosshair={showCrosshair}
                        />
                    )}

                    <div className="absolute top-2 left-2 bg-black/80 text-white px-3 py-1.5 rounded text-xs">
                        {viewerTool === "select" && drawing.currentTool === "select" && "🖱️ Scroll: Slices • Ctrl+Scroll: Zoom • Middle: Pan"}
                        {viewerTool === "pan" && "🖱️ Drag: Pan • Scroll: Slices • Ctrl+Scroll: Zoom"}
                        {viewerTool === "windowing" && "🖱️ Drag: Brightness/Contrast • Scroll: Slices"}
                        {drawing.currentTool === "brush" && "🖱️ Draw • Scroll: Slices • Ctrl+Scroll: Zoom"}
                        {drawing.currentTool === "eraser" && "🖱️ Erase • Scroll: Slices • Ctrl+Scroll: Zoom"}
                        {drawing.currentTool === "polygon" && "🖱️ Click: Points • Double-click: Finish • Scroll: Slices"}
                    </div>
                </div>
            </div>

            {/* Bottom Slice Navigation Bar - PROMINENT */}
            <div className="bg-card border-t-2 border-primary/50 p-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentSlice(0)}
                            disabled={currentSlice === 0}
                            title="First slice"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <ArrowLeft className="w-4 h-4 -ml-3" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentSlice(prev => Math.max(0, prev - 1))}
                            disabled={currentSlice === 0}
                            title="Previous slice ([)"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex-1 flex items-center gap-4">
                        <Slider
                            value={[currentSlice]}
                            onValueChange={([value]) => setCurrentSlice(value)}
                            max={ctImages.length - 1}
                            step={1}
                            className="flex-1"
                        />
                        <div className="text-sm font-medium text-foreground min-w-[80px] text-center bg-muted px-3 py-1 rounded">
                            {currentSlice + 1} / {ctImages.length}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentSlice(prev => Math.min(ctImages.length - 1, prev + 1))}
                            disabled={currentSlice === ctImages.length - 1}
                            title="Next slice (])"
                        >
                            <ArrowLeft className="w-4 h-4 rotate-180" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentSlice(ctImages.length - 1)}
                            disabled={currentSlice === ctImages.length - 1}
                            title="Last slice"
                        >
                            <ArrowLeft className="w-4 h-4 rotate-180" />
                            <ArrowLeft className="w-4 h-4 rotate-180 -ml-3" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
