import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { DicomImage, DicomRTStruct } from "@/lib/dicom-utils";
import {
  buildMPRVolume,
  getAxialSlice,
  getSagittalSlice,
  getCoronalSlice,
  renderMPRSliceToCanvas,
  updateCrosshair,
  canvasToVolumeCoords,
  MPRVolume,
  MPRCrosshair,
  ViewPlane,
} from "@/lib/mpr-utils";
import { RotateCcw, Maximize2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Structure } from "@/hooks/useDrawing";

interface MPRViewerProps {
  ctImages: DicomImage[];
  windowLevel: number;
  windowWidth: number;
  onWindowLevelChange: (level: number) => void;
  onWindowWidthChange: (width: number) => void;
  rtStruct?: DicomRTStruct;
  structures?: Structure[];
}

export const MPRViewer = ({
  ctImages,
  windowLevel,
  windowWidth,
  onWindowLevelChange,
  onWindowWidthChange,
  rtStruct,
  structures = [],
}: MPRViewerProps) => {
  const { toast } = useToast();

  // Canvas refs
  const axialCanvasRef = useRef<HTMLCanvasElement>(null);
  const sagittalCanvasRef = useRef<HTMLCanvasElement>(null);
  const coronalCanvasRef = useRef<HTMLCanvasElement>(null);

  // MPR volume
  const [volume, setVolume] = useState<MPRVolume | null>(null);

  // Crosshair position (shared across all views)
  const [crosshair, setCrosshair] = useState<MPRCrosshair>({
    axialIndex: 0,
    sagittalIndex: 0,
    coronalIndex: 0,
  });

  const [focusedPanel, setFocusedPanel] = useState<ViewPlane | null>(null);

  // Structure visibility toggle
  const [showStructures, setShowStructures] = useState(true);

  // Build MPR volume on mount
  useEffect(() => {
    if (ctImages.length > 0) {
      const mprVolume = buildMPRVolume(ctImages);
      if (mprVolume) {
        setVolume(mprVolume);
        // Initialize crosshair to center of volume
        setCrosshair({
          axialIndex: Math.floor(mprVolume.depth / 2),
          sagittalIndex: Math.floor(mprVolume.width / 2),
          coronalIndex: Math.floor(mprVolume.height / 2),
        });

        toast({
          title: "MPR View Ready",
          description: `3D volume built: ${mprVolume.width}×${mprVolume.height}×${mprVolume.depth}`,
        });
      }
    }
  }, [ctImages, toast]);

  // Render axial view
  useEffect(() => {
    if (!volume || !axialCanvasRef.current) return;

    const slice = getAxialSlice(volume, crosshair.axialIndex);
    renderMPRSliceToCanvas(
      axialCanvasRef.current,
      slice,
      volume,
      windowLevel,
      windowWidth
    );

    // Draw structures
    renderStructuresOnCanvas(axialCanvasRef.current, 'axial');

    // Draw crosshair
    const ctx = axialCanvasRef.current.getContext('2d');
    if (ctx) {
      const canvas = axialCanvasRef.current;
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      // Vertical line (sagittal position)
      const xPos = (crosshair.sagittalIndex / slice.width) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, canvas.height);
      ctx.stroke();

      // Horizontal line (coronal position)
      const yPos = (crosshair.coronalIndex / slice.height) * canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(canvas.width, yPos);
      ctx.stroke();

      ctx.setLineDash([]);
    }
  }, [volume, crosshair, windowLevel, windowWidth, renderStructuresOnCanvas]);

  // Render sagittal view
  useEffect(() => {
    if (!volume || !sagittalCanvasRef.current) return;

    const slice = getSagittalSlice(volume, crosshair.sagittalIndex);
    renderMPRSliceToCanvas(
      sagittalCanvasRef.current,
      slice,
      volume,
      windowLevel,
      windowWidth
    );

    // Draw structures
    renderStructuresOnCanvas(sagittalCanvasRef.current, 'sagittal');

    // Draw crosshair (account for flipped Z)
    const ctx = sagittalCanvasRef.current.getContext('2d');
    if (ctx) {
      const canvas = sagittalCanvasRef.current;
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      // Vertical line (axial position) - Z is flipped
      const flippedZ = volume.depth - 1 - crosshair.axialIndex;
      const xPos = (flippedZ / slice.width) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, canvas.height);
      ctx.stroke();

      // Horizontal line (coronal position)
      const yPos = (crosshair.coronalIndex / slice.height) * canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(canvas.width, yPos);
      ctx.stroke();

      ctx.setLineDash([]);
    }
  }, [volume, crosshair, windowLevel, windowWidth, renderStructuresOnCanvas]);

  // Render coronal view
  useEffect(() => {
    if (!volume || !coronalCanvasRef.current) return;

    const slice = getCoronalSlice(volume, crosshair.coronalIndex);
    renderMPRSliceToCanvas(
      coronalCanvasRef.current,
      slice,
      volume,
      windowLevel,
      windowWidth
    );

    // Draw structures
    renderStructuresOnCanvas(coronalCanvasRef.current, 'coronal');

    // Draw crosshair (account for flipped Z)
    const ctx = coronalCanvasRef.current.getContext('2d');
    if (ctx) {
      const canvas = coronalCanvasRef.current;
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);

      // Vertical line (sagittal position)
      const xPos = (crosshair.sagittalIndex / slice.width) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, canvas.height);
      ctx.stroke();

      // Horizontal line (axial position) - Z is flipped
      const flippedZ = volume.depth - 1 - crosshair.axialIndex;
      const yPos = (flippedZ / slice.height) * canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(canvas.width, yPos);
      ctx.stroke();

      ctx.setLineDash([]);
    }
  }, [volume, crosshair, windowLevel, windowWidth, renderStructuresOnCanvas]);

  // Handle canvas click to update crosshair
  const handleCanvasClick = useCallback(
    (plane: ViewPlane, e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!volume) return;

      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert to canvas coordinates (account for display scaling)
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const canvasX = x * scaleX;
      const canvasY = y * scaleY;

      // Get the slice to know its dimensions
      let slice;
      if (plane === 'axial') {
        slice = getAxialSlice(volume, crosshair.axialIndex);
      } else if (plane === 'sagittal') {
        slice = getSagittalSlice(volume, crosshair.sagittalIndex);
      } else {
        slice = getCoronalSlice(volume, crosshair.coronalIndex);
      }

      // Convert from canvas coordinates to slice pixel coordinates
      const sliceX = (canvasX / canvas.width) * slice.width;
      const sliceY = (canvasY / canvas.height) * slice.height;

      // Update crosshair based on plane
      const volumeCoords = canvasToVolumeCoords(sliceX, sliceY, plane, crosshair, volume);
      setCrosshair({
        axialIndex: volumeCoords.z,
        sagittalIndex: volumeCoords.x,
        coronalIndex: volumeCoords.y,
      });
    },
    [volume, crosshair]
  );

  // Handle wheel for scrolling through slices
  const handleWheel = useCallback(
    (plane: ViewPlane, e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (!volume) return;

      const delta = e.deltaY > 0 ? 1 : -1;
      const newCrosshair = updateCrosshair(
        volume,
        plane,
        plane === 'axial'
          ? crosshair.axialIndex + delta
          : plane === 'sagittal'
          ? crosshair.sagittalIndex + delta
          : crosshair.coronalIndex + delta,
        crosshair
      );
      setCrosshair(newCrosshair);
    },
    [volume, crosshair]
  );

  const resetView = () => {
    if (volume) {
      setCrosshair({
        axialIndex: Math.floor(volume.depth / 2),
        sagittalIndex: Math.floor(volume.width / 2),
        coronalIndex: Math.floor(volume.height / 2),
      });
    }

    toast({
      title: "View reset",
      description: "Crosshair returned to center of volume",
    });
  };

  // Helper function to render structures on canvas for a given plane
  const renderStructuresOnCanvas = useCallback(
    (canvas: HTMLCanvasElement, plane: ViewPlane) => {
      if (!volume || !showStructures) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get current slice index for this plane
      const currentSliceIndex =
        plane === 'axial' ? crosshair.axialIndex :
        plane === 'sagittal' ? crosshair.sagittalIndex :
        crosshair.coronalIndex;

      // Get the current slice to know dimensions
      let slice;
      if (plane === 'axial') {
        slice = getAxialSlice(volume, currentSliceIndex);
      } else if (plane === 'sagittal') {
        slice = getSagittalSlice(volume, currentSliceIndex);
      } else {
        slice = getCoronalSlice(volume, currentSliceIndex);
      }

      // Render RT structures from DICOM
      if (rtStruct?.structures) {
        rtStruct.structures.forEach((rtStructure, structIndex) => {
          // Find corresponding structure in structures array for visibility
          const structure = structures.find(s => s.id === `rt_${structIndex}`);
          if (structure && !structure.visible) return;

          const color = structure?.color || `rgb(${Math.round(rtStructure.color[0])}, ${Math.round(rtStructure.color[1])}, ${Math.round(rtStructure.color[2])})`;

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.setLineDash([]);

          rtStructure.contours.forEach((contour) => {
            if (contour.points.length === 0) return;

            // For axial plane: match by Z coordinate (slice location)
            if (plane === 'axial') {
              const contourZ = contour.points[0][2];
              const currentImage = volume.axialSlices[currentSliceIndex];
              if (!currentImage || currentImage.sliceLocation === undefined) return;

              const tolerance = (currentImage.sliceThickness || 1.0) / 2;
              if (Math.abs(contourZ - currentImage.sliceLocation) > tolerance) return;

              // Draw contour
              ctx.beginPath();
              let started = false;
              contour.points.forEach((point) => {
                const worldX = point[0];
                const worldY = point[1];

                // Convert world coordinates to pixel coordinates
                const imagePosition = currentImage.imagePosition || [0, 0, 0];
                const pixelSpacing = currentImage.pixelSpacing || [1, 1];
                const pixelX = (worldX - imagePosition[0]) / pixelSpacing[0];
                const pixelY = (worldY - imagePosition[1]) / pixelSpacing[1];

                // Convert pixel coordinates to canvas coordinates
                const canvasX = (pixelX / slice.width) * canvas.width;
                const canvasY = (pixelY / slice.height) * canvas.height;

                if (!started) {
                  ctx.moveTo(canvasX, canvasY);
                  started = true;
                } else {
                  ctx.lineTo(canvasX, canvasY);
                }
              });
              ctx.closePath();
              ctx.stroke();
            }
          });
        });
      }

      // Render drawing structures
      structures.filter(s => s.id.startsWith('edit_') && s.visible).forEach((structure) => {
        ctx.strokeStyle = structure.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);

        structure.contours.forEach((contour) => {
          if (contour.points.length === 0) return;

          // For axial plane: match by slice index
          if (plane === 'axial' && contour.sliceIndex === currentSliceIndex) {
            ctx.beginPath();
            let started = false;
            contour.points.forEach((worldPoint) => {
              const currentImage = volume.axialSlices[currentSliceIndex];
              if (!currentImage) return;

              // Convert world coordinates to pixel coordinates
              const imagePosition = currentImage.imagePosition || [0, 0, 0];
              const pixelSpacing = currentImage.pixelSpacing || [1, 1];
              const pixelX = (worldPoint.x - imagePosition[0]) / pixelSpacing[0];
              const pixelY = (worldPoint.y - imagePosition[1]) / pixelSpacing[1];

              // Convert pixel coordinates to canvas coordinates
              const canvasX = (pixelX / slice.width) * canvas.width;
              const canvasY = (pixelY / slice.height) * canvas.height;

              if (!started) {
                ctx.moveTo(canvasX, canvasY);
                started = true;
              } else {
                ctx.lineTo(canvasX, canvasY);
              }
            });
            if (contour.isClosed) {
              ctx.closePath();
            }
            ctx.stroke();
          }
        });
      });
    },
    [volume, showStructures, crosshair, rtStruct, structures]
  );

  if (!volume) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Building 3D volume...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Control Bar */}
      <div className="bg-card border-b border-border p-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="flex items-center gap-2">
            <Maximize2 className="w-3 h-3" />
            MPR View
          </Badge>
          <span className="text-xs text-muted-foreground">
            Volume: {volume.width}×{volume.height}×{volume.depth}
          </span>
          {(rtStruct || structures.length > 0) && (
            <Badge variant={showStructures ? "default" : "outline"} className="text-xs">
              {structures.filter(s => s.visible).length} structure{structures.filter(s => s.visible).length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(rtStruct || structures.length > 0) && (
            <Button
              variant={showStructures ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setShowStructures(!showStructures);
                toast({
                  title: showStructures ? "Structures hidden" : "Structures visible",
                  description: showStructures
                    ? "RT structures are now hidden in MPR view"
                    : "RT structures are now visible in MPR view",
                });
              }}
              title={showStructures ? "Hide structures" : "Show structures"}
            >
              {showStructures ? (
                <>
                  <Eye className="w-4 h-4 mr-1" />
                  Structures
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 mr-1" />
                  Structures
                </>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={resetView}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset All
          </Button>
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 p-2">
        {/* Axial View (Top-Left) */}
        <Card className="relative bg-black flex flex-col overflow-hidden">
          <div className="absolute top-2 left-2 z-10 bg-black/80 text-white px-2 py-1 rounded text-xs font-semibold">
            AXIAL
          </div>
          <div className="absolute top-2 right-2 z-10 bg-black/80 text-white px-2 py-1 rounded text-xs">
            {crosshair.axialIndex + 1} / {volume.depth}
          </div>
          <div className="flex-1 flex items-center justify-center p-2">
            <canvas
              ref={axialCanvasRef}
              className="max-w-full max-h-full"
              style={{
                imageRendering: "pixelated",
                border: focusedPanel === 'axial' ? "2px solid #00ff00" : "2px solid #333",
                cursor: "crosshair",
              }}
              onClick={(e) => handleCanvasClick('axial', e)}
              onWheel={(e) => handleWheel('axial', e)}
              onFocus={() => setFocusedPanel('axial')}
              onBlur={() => setFocusedPanel(null)}
              tabIndex={0}
            />
          </div>
          <div className="p-2 bg-card/50">
            <Slider
              value={[crosshair.axialIndex]}
              onValueChange={([value]) => setCrosshair({ ...crosshair, axialIndex: value })}
              max={volume.depth - 1}
              step={1}
              className="w-full"
            />
          </div>
        </Card>

        {/* Sagittal View (Top-Right) */}
        <Card className="relative bg-black flex flex-col overflow-hidden">
          <div className="absolute top-2 left-2 z-10 bg-black/80 text-white px-2 py-1 rounded text-xs font-semibold">
            SAGITTAL
          </div>
          <div className="absolute top-2 right-2 z-10 bg-black/80 text-white px-2 py-1 rounded text-xs">
            {crosshair.sagittalIndex + 1} / {volume.width}
          </div>
          <div className="flex-1 flex items-center justify-center p-2">
            <canvas
              ref={sagittalCanvasRef}
              className="max-w-full max-h-full"
              style={{
                imageRendering: "pixelated",
                border: focusedPanel === 'sagittal' ? "2px solid #00ff00" : "2px solid #333",
                cursor: "crosshair",
              }}
              onClick={(e) => handleCanvasClick('sagittal', e)}
              onWheel={(e) => handleWheel('sagittal', e)}
              onFocus={() => setFocusedPanel('sagittal')}
              onBlur={() => setFocusedPanel(null)}
              tabIndex={0}
            />
          </div>
          <div className="p-2 bg-card/50">
            <Slider
              value={[crosshair.sagittalIndex]}
              onValueChange={([value]) => setCrosshair({ ...crosshair, sagittalIndex: value })}
              max={volume.width - 1}
              step={1}
              className="w-full"
            />
          </div>
        </Card>

        {/* Coronal View (Bottom-Left) */}
        <Card className="relative bg-black flex flex-col overflow-hidden">
          <div className="absolute top-2 left-2 z-10 bg-black/80 text-white px-2 py-1 rounded text-xs font-semibold">
            CORONAL
          </div>
          <div className="absolute top-2 right-2 z-10 bg-black/80 text-white px-2 py-1 rounded text-xs">
            {crosshair.coronalIndex + 1} / {volume.height}
          </div>
          <div className="flex-1 flex items-center justify-center p-2">
            <canvas
              ref={coronalCanvasRef}
              className="max-w-full max-h-full"
              style={{
                imageRendering: "pixelated",
                border: focusedPanel === 'coronal' ? "2px solid #00ff00" : "2px solid #333",
                cursor: "crosshair",
              }}
              onClick={(e) => handleCanvasClick('coronal', e)}
              onWheel={(e) => handleWheel('coronal', e)}
              onFocus={() => setFocusedPanel('coronal')}
              onBlur={() => setFocusedPanel(null)}
              tabIndex={0}
            />
          </div>
          <div className="p-2 bg-card/50">
            <Slider
              value={[crosshair.coronalIndex]}
              onValueChange={([value]) => setCrosshair({ ...crosshair, coronalIndex: value })}
              max={volume.height - 1}
              step={1}
              className="w-full"
            />
          </div>
        </Card>

        {/* Info Panel (Bottom-Right) */}
        <Card className="bg-card p-4 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-3">Crosshair Position</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Axial (Z):</span>
                <span className="font-mono">{crosshair.axialIndex}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sagittal (X):</span>
                <span className="font-mono">{crosshair.sagittalIndex}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coronal (Y):</span>
                <span className="font-mono">{crosshair.coronalIndex}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Volume Info</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dimensions:</span>
                <span className="font-mono">
                  {volume.width}×{volume.height}×{volume.depth}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pixel Spacing:</span>
                <span className="font-mono">
                  {volume.pixelSpacing[0].toFixed(2)}×{volume.pixelSpacing[1].toFixed(2)} mm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slice Spacing:</span>
                <span className="font-mono">{volume.sliceSpacing.toFixed(2)} mm</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">Instructions</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Click any view to move crosshair</li>
              <li>• Scroll to navigate through slices</li>
              <li>• Drag sliders for precise control</li>
              <li>• Green lines show crosshair position</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};
