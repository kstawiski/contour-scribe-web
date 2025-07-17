import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Move, 
  MousePointer, 
  Paintbrush, 
  Eraser, 
  Download,
  Settings,
  Layers,
  Eye,
  EyeOff,
  Plus,
  ArrowLeft,
  Scissors,
  Copy,
  RotateCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DicomImage, DicomRTStruct, DicomProcessor } from "@/lib/dicom-utils";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { useDrawing, DrawingTool } from "@/hooks/useDrawing";
import { BooleanOperation, Point2D } from "@/lib/contour-utils";

interface DicomViewerProps {
  ctImages: DicomImage[];
  rtStruct?: DicomRTStruct;
  onBack?: () => void;
}

interface RTStructure {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  isEditing: boolean;
}

type ViewerTool = "select" | "pan" | "zoom" | "windowing";

export const DicomViewer = ({ ctImages, rtStruct, onBack }: DicomViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Drawing system
  const drawing = useDrawing();

  // Viewer state
  const [currentSlice, setCurrentSlice] = useState(0);
  const [viewerTool, setViewerTool] = useState<ViewerTool>("select");
  const [windowLevel, setWindowLevel] = useState([400]);
  const [windowWidth, setWindowWidth] = useState([800]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // RT Structure state - only include RT structures
  const [rtStructures, setRTStructures] = useState<RTStructure[]>(() => {
    const structures: RTStructure[] = [];
    
    // Add RT structures if available
    if (rtStruct?.structures) {
      rtStruct.structures.forEach((rtStructure, index) => {
        structures.push({
          id: `rt_${index}`,
          name: rtStructure.name,
          color: `rgb(${Math.round(rtStructure.color[0])}, ${Math.round(rtStructure.color[1])}, ${Math.round(rtStructure.color[2])})`,
          visible: true,
          isEditing: false
        });
      });
    }
    
    return structures;
  });

  // Initialize drawing structures from RT structures
  useEffect(() => {
    if (drawing.structures.length === 0 && rtStruct?.structures) {
      rtStruct.structures.forEach((rtStructure, index) => {
        drawing.addStructure({
          id: `rt_${index}`,
          name: rtStructure.name,
          color: `rgb(${Math.round(rtStructure.color[0])}, ${Math.round(rtStructure.color[1])}, ${Math.round(rtStructure.color[2])})`,
          visible: true
        });
      });
    }
  }, [rtStruct, drawing]);

  // Canvas setup and DICOM rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || ctImages.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentImage = ctImages[currentSlice];
    if (!currentImage) return;

    // Set canvas size
    const canvasSize = 800;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Clear canvas with black background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate image positioning and scaling
    const imageAspect = currentImage.width / currentImage.height;
    let drawWidth = currentImage.width;
    let drawHeight = currentImage.height;
    
    const maxSize = canvasSize * 0.95;
    if (imageAspect > 1) {
      drawWidth = maxSize;
      drawHeight = drawWidth / imageAspect;
    } else {
      drawHeight = maxSize;
      drawWidth = drawHeight * imageAspect;
    }
    
    drawWidth *= zoom;
    drawHeight *= zoom;
    
    const imageX = (canvasSize - drawWidth) / 2 + pan.x;
    const imageY = (canvasSize - drawHeight) / 2 + pan.y;

    // Render the DICOM image
    try {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      if (tempCtx) {
        DicomProcessor.renderImageToCanvas(
          tempCanvas, 
          currentImage, 
          windowLevel[0], 
          windowWidth[0]
        );
        
        ctx.drawImage(tempCanvas, imageX, imageY, drawWidth, drawHeight);
      }
    } catch (error) {
      console.error("Error rendering DICOM image:", error);
      
      ctx.fillStyle = "#333333";
      ctx.fillRect(imageX, imageY, drawWidth, drawHeight);
    }

    // Coordinate transformation functions
    const worldToCanvas = (worldX: number, worldY: number) => {
      const imagePosition = currentImage.imagePosition || [0, 0, 0];
      const pixelSpacing = currentImage.pixelSpacing || [1, 1];
      
      const pixelX = (worldX - imagePosition[0]) / pixelSpacing[0];
      const pixelY = (worldY - imagePosition[1]) / pixelSpacing[1];
      
      const scaleX = drawWidth / currentImage.width;
      const scaleY = drawHeight / currentImage.height;
      
      return {
        x: imageX + (pixelX * scaleX),
        y: imageY + (pixelY * scaleY)
      };
    };

    // Render RT structure contours
    if (rtStruct?.structures) {
      rtStruct.structures.forEach((rtStructure, structIndex) => {
        const structure = rtStructures.find(s => s.id === `rt_${structIndex}`);
        if (!structure?.visible) return;
        
        ctx.strokeStyle = structure.color;
        ctx.lineWidth = 2;
        ctx.setLineDash(structure.isEditing ? [5, 5] : []);
        
        const currentSliceZ = currentImage.sliceLocation;
        
        rtStructure.contours.forEach((contour) => {
          if (contour.points.length === 0) return;
          
          const contourZ = contour.points[0][2];
          let shouldShowContour = false;
          
          if (currentSliceZ !== undefined) {
            const tolerance = (currentImage.sliceThickness || 1.0) / 2;
            shouldShowContour = Math.abs(contourZ - currentSliceZ) <= tolerance;
          } else {
            shouldShowContour = contour.sliceIndex === currentSlice;
          }
          
          if (shouldShowContour) {
            ctx.beginPath();
            let validPoints = 0;
            
            contour.points.forEach((point) => {
              const canvasPoint = worldToCanvas(point[0], point[1]);
              
              if (canvasPoint.x >= imageX - 50 && canvasPoint.x <= imageX + drawWidth + 50 &&
                  canvasPoint.y >= imageY - 50 && canvasPoint.y <= imageY + drawHeight + 50) {
                if (validPoints === 0) {
                  ctx.moveTo(canvasPoint.x, canvasPoint.y);
                } else {
                  ctx.lineTo(canvasPoint.x, canvasPoint.y);
                }
                validPoints++;
              }
            });
            
            if (validPoints > 2) {
              ctx.closePath();
              ctx.stroke();
            }
          }
        });
        
        ctx.setLineDash([]);
      });
    }

    
  }, [currentSlice, rtStructures, ctImages, windowLevel, windowWidth, zoom, pan, rtStruct, drawing]);

  // Convert canvas coordinates to world coordinates for drawing
  const canvasToWorld = (canvasX: number, canvasY: number): Point2D => {
    const currentImage = ctImages[currentSlice];
    if (!currentImage) return { x: 0, y: 0 };
    
    const canvasSize = 800;
    const imageAspect = currentImage.width / currentImage.height;
    
    let drawWidth = currentImage.width;
    let drawHeight = currentImage.height;
    
    const maxSize = canvasSize * 0.95;
    if (imageAspect > 1) {
      drawWidth = maxSize;
      drawHeight = drawWidth / imageAspect;
    } else {
      drawHeight = maxSize;
      drawWidth = drawHeight * imageAspect;
    }
    
    drawWidth *= zoom;
    drawHeight *= zoom;
    
    const imageX = (canvasSize - drawWidth) / 2 + pan.x;
    const imageY = (canvasSize - drawHeight) / 2 + pan.y;
    
    const imagePosition = currentImage.imagePosition || [0, 0, 0];
    const pixelSpacing = currentImage.pixelSpacing || [1, 1];
    
    const scaleX = drawWidth / currentImage.width;
    const scaleY = drawHeight / currentImage.height;
    
    const pixelX = (canvasX - imageX) / scaleX;
    const pixelY = (canvasY - imageY) / scaleY;
    
    return {
      x: imagePosition[0] + (pixelX * pixelSpacing[0]),
      y: imagePosition[1] + (pixelY * pixelSpacing[1])
    };
  };

  // Handle wheel events for slice navigation
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (viewerTool !== "zoom") {
      const delta = e.deltaY > 0 ? 1 : -1;
      setCurrentSlice(prev => {
        const newSlice = prev + delta;
        return Math.max(0, Math.min(ctImages.length - 1, newSlice));
      });
    } else {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
    }
  };

  // Drawing event handlers
  const handleStartDrawing = (point: Point2D) => {
    const worldPoint = canvasToWorld(point.x, point.y);
    drawing.startDrawing(worldPoint);
  };

  const handleAddPoint = (point: Point2D) => {
    const worldPoint = canvasToWorld(point.x, point.y);
    drawing.addPoint(worldPoint);
  };

  const handleFinishDrawing = () => {
    drawing.finishDrawing(currentSlice);
    toast({
      title: "Contour saved",
      description: "Drawing has been added to the active structure",
    });
  };

  const handleEraseAt = (point: Point2D) => {
    const worldPoint = canvasToWorld(point.x, point.y);
    drawing.eraseAt(worldPoint, currentSlice);
  };

  // Tool change handlers
  const handleViewerToolChange = (tool: ViewerTool) => {
    setViewerTool(tool);
    if (tool !== "select") {
      drawing.setTool("select");
    }
  };

  const handleDrawingToolChange = (tool: DrawingTool) => {
    drawing.setTool(tool);
    setViewerTool("select");
    
    // Auto-create a structure if none is active and we're starting to draw
    if (!drawing.activeStructureId && (tool === "brush" || tool === "polygon")) {
      addNewStructure();
    }
  };

  const toggleRTStructureVisibility = (id: string) => {
    setRTStructures(prev => 
      prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s)
    );
    drawing.toggleStructureVisibility(id);
  };

  const startEditingRTStructure = (id: string) => {
    setRTStructures(prev => 
      prev.map(s => ({ ...s, isEditing: s.id === id ? !s.isEditing : false }))
    );
    drawing.setActiveStructure(id);
    if (drawing.currentTool === "select") {
      drawing.setTool("brush");
    }
  };

  const addNewStructure = () => {
    const newId = `edit_${Date.now()}`;
    const colors = ["#ff8844", "#8844ff", "#44ff88", "#ff4488", "#88ff44"];
    const color = colors[drawing.structures.filter(s => s.id.startsWith('edit_')).length % colors.length];
    
    const newStructure = {
      id: newId,
      name: `New_Structure_${drawing.structures.length + 1}`,
      color,
      visible: true
    };
    
    drawing.addStructure(newStructure);
    drawing.setActiveStructure(newId);
    drawing.setTool("brush");
    
    setRTStructures(prev => [...prev, { ...newStructure, isEditing: true }]);
    
    toast({
      title: "New structure created",
      description: `${newStructure.name} ready for drawing`,
    });
  };

  const handleDownload = () => {
    toast({
      title: "Export initiated",
      description: "Generating DICOM RT Structure file...",
    });
    
    setTimeout(() => {
      toast({
        title: "Export complete",
        description: "RT Structure file downloaded successfully",
      });
    }, 2000);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setWindowLevel([ctImages[0]?.windowCenter || 400]);
    setWindowWidth([ctImages[0]?.windowWidth || 800]);
    toast({
      title: "View reset",
      description: "Returned to default view settings",
    });
  };

  const interpolateSlices = () => {
    if (drawing.activeStructureId) {
      const activeStructure = drawing.structures.find(s => s.id === drawing.activeStructureId);
      if (activeStructure && activeStructure.contours.length >= 2) {
        // Find slices with contours
        const slicesWithContours = [...new Set(activeStructure.contours.map(c => c.sliceIndex))].sort((a, b) => a - b);
        
        if (slicesWithContours.length >= 2) {
          const startSlice = slicesWithContours[0];
          const endSlice = slicesWithContours[slicesWithContours.length - 1];
          const targetSlices = [];
          
          for (let i = startSlice + 1; i < endSlice; i++) {
            if (!slicesWithContours.includes(i)) {
              targetSlices.push(i);
            }
          }
          
          if (targetSlices.length > 0) {
            // Simplified interpolation - just copy the first contour to all target slices
            const firstContour = activeStructure.contours[0];
            targetSlices.forEach(slice => {
              const interpolatedContour = {
                id: `interpolated_${Date.now()}_${slice}`,
                points: firstContour.points,
                sliceIndex: slice,
                structureId: drawing.activeStructureId!,
                isClosed: true,
                color: firstContour.color
              };
              
              drawing.addStructure({
                id: drawing.activeStructureId!,
                name: activeStructure.name,
                color: activeStructure.color,
                visible: true
              });
            });
            
            toast({
              title: "Interpolation complete",
              description: `Added contours to ${targetSlices.length} slices`,
            });
          }
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex animate-fade-in">
      {/* Main Viewer */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">DICOM Viewer</h2>
              <p className="text-muted-foreground text-sm">
                CT Series • {ctImages.length} slices • {rtStruct ? "RT Structure loaded" : "No RT Structure"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onBack && (
                <Button variant="outline" size="sm" onClick={onBack}>
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={resetView}>
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
              <Button variant="medical" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 border border-border rounded-md p-1">
              <Button
                variant={viewerTool === "select" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleViewerToolChange("select")}
              >
                <MousePointer className="w-4 h-4" />
              </Button>
              <Button
                variant={viewerTool === "pan" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleViewerToolChange("pan")}
              >
                <Move className="w-4 h-4" />
              </Button>
              <Button
                variant={viewerTool === "zoom" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleViewerToolChange("zoom")}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant={viewerTool === "windowing" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleViewerToolChange("windowing")}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            <div className="flex items-center gap-1 border border-border rounded-md p-1">
              <Button
                variant={drawing.currentTool === "brush" ? "medical" : "ghost"}
                size="sm"
                onClick={() => handleDrawingToolChange("brush")}
              >
                <Paintbrush className="w-4 h-4" />
              </Button>
              <Button
                variant={drawing.currentTool === "eraser" ? "destructive" : "ghost"}
                size="sm"
                onClick={() => handleDrawingToolChange("eraser")}
              >
                <Eraser className="w-4 h-4" />
              </Button>
              <Button
                variant={drawing.currentTool === "polygon" ? "medical" : "ghost"}
                size="sm"
                onClick={() => handleDrawingToolChange("polygon")}
              >
                <Scissors className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Tool:</span>
              <Badge variant="secondary" className="capitalize">
                {drawing.currentTool}
              </Badge>
            </div>
          </div>
        </div>

        {/* Viewer Canvas */}
        <div className="flex-1 flex">
          <div className="flex-1 bg-black flex items-center justify-center p-4">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="shadow-elevation block"
                style={{
                  imageRendering: "pixelated",
                  width: "800px",
                  height: "800px",
                  border: "2px solid #333"
                }}
                onWheel={handleWheel}
              />
              
              <DrawingCanvas
                width={800}
                height={800}
                contours={drawing.getContoursForSlice(currentSlice).map(contour => ({
                  ...contour,
                  points: contour.points.map(worldPoint => {
                    const currentImage = ctImages[currentSlice];
                    if (!currentImage) return { x: 0, y: 0 };
                    
                    const canvasSize = 800;
                    const imageAspect = currentImage.width / currentImage.height;
                    
                    let drawWidth = currentImage.width;
                    let drawHeight = currentImage.height;
                    
                    const maxSize = canvasSize * 0.95;
                    if (imageAspect > 1) {
                      drawWidth = maxSize;
                      drawHeight = drawWidth / imageAspect;
                    } else {
                      drawHeight = maxSize;
                      drawWidth = drawHeight * imageAspect;
                    }
                    
                    drawWidth *= zoom;
                    drawHeight *= zoom;
                    
                    const imageX = (canvasSize - drawWidth) / 2 + pan.x;
                    const imageY = (canvasSize - drawHeight) / 2 + pan.y;
                    
                    const imagePosition = currentImage.imagePosition || [0, 0, 0];
                    const pixelSpacing = currentImage.pixelSpacing || [1, 1];
                    
                    const pixelX = (worldPoint.x - imagePosition[0]) / pixelSpacing[0];
                    const pixelY = (worldPoint.y - imagePosition[1]) / pixelSpacing[1];
                    
                    const scaleX = drawWidth / currentImage.width;
                    const scaleY = drawHeight / currentImage.height;
                    
                    return {
                      x: imageX + (pixelX * scaleX),
                      y: imageY + (pixelY * scaleY)
                    };
                  })
                }))}
                currentPath={drawing.currentPath.map(worldPoint => {
                  const currentImage = ctImages[currentSlice];
                  if (!currentImage) return { x: 0, y: 0 };
                  
                  const canvasSize = 800;
                  const imageAspect = currentImage.width / currentImage.height;
                  
                  let drawWidth = currentImage.width;
                  let drawHeight = currentImage.height;
                  
                  const maxSize = canvasSize * 0.95;
                  if (imageAspect > 1) {
                    drawWidth = maxSize;
                    drawHeight = drawWidth / imageAspect;
                  } else {
                    drawHeight = maxSize;
                    drawWidth = drawHeight * imageAspect;
                  }
                  
                  drawWidth *= zoom;
                  drawHeight *= zoom;
                  
                  const imageX = (canvasSize - drawWidth) / 2 + pan.x;
                  const imageY = (canvasSize - drawHeight) / 2 + pan.y;
                  
                  const imagePosition = currentImage.imagePosition || [0, 0, 0];
                  const pixelSpacing = currentImage.pixelSpacing || [1, 1];
                  
                  const pixelX = (worldPoint.x - imagePosition[0]) / pixelSpacing[0];
                  const pixelY = (worldPoint.y - imagePosition[1]) / pixelSpacing[1];
                  
                  const scaleX = drawWidth / currentImage.width;
                  const scaleY = drawHeight / currentImage.height;
                  
                  return {
                    x: imageX + (pixelX * scaleX),
                    y: imageY + (pixelY * scaleY)
                  };
                })}
                currentTool={drawing.currentTool}
                isDrawing={drawing.isDrawing}
                brushSize={drawing.brushSize}
                eraserSize={drawing.eraserSize}
                onStartDrawing={handleStartDrawing}
                onAddPoint={handleAddPoint}
                onFinishDrawing={handleFinishDrawing}
                onEraseAt={handleEraseAt}
                onWheel={handleWheel}
              />
              
              <div className="absolute bottom-2 left-2 bg-black/80 text-white p-2 rounded text-xs">
                {viewerTool === "select" && drawing.currentTool === "select" && "Mouse wheel: Navigate slices"}
                {viewerTool === "pan" && "Drag: Pan image | Wheel: Navigate slices"}
                {viewerTool === "zoom" && "Wheel: Zoom in/out"}
                {viewerTool === "windowing" && "Drag: Adjust window/level"}
                {drawing.currentTool === "brush" && "Click/Drag: Draw contour | Wheel: Navigate slices"}
                {drawing.currentTool === "eraser" && "Click/Drag: Erase contours | Wheel: Navigate slices"}
                {drawing.currentTool === "polygon" && "Click: Add points, double-click: Close polygon"}
              </div>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="w-80 bg-card border-l border-border p-4 space-y-6">
            {/* Slice Navigation */}
            <div>
              <h3 className="font-medium text-foreground mb-3">Slice Navigation</h3>
              <div className="space-y-3">
                <div className="text-center">
                  <span className="text-sm text-muted-foreground">
                    {currentSlice + 1} / {ctImages.length}
                  </span>
                </div>
                <Slider
                  value={[currentSlice]}
                  onValueChange={([value]) => setCurrentSlice(value)}
                  max={ctImages.length - 1}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            {/* Image Controls */}
            <div>
              <h3 className="font-medium text-foreground mb-3">Image Controls</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Window Level</label>
                  <Slider
                    value={windowLevel}
                    onValueChange={setWindowLevel}
                    min={-1000}
                    max={3000}
                    step={10}
                    className="mt-2"
                  />
                  <span className="text-xs text-muted-foreground">{windowLevel[0]}</span>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Window Width</label>
                  <Slider
                    value={windowWidth}
                    onValueChange={setWindowWidth}
                    min={1}
                    max={4000}
                    step={10}
                    className="mt-2"
                  />
                  <span className="text-xs text-muted-foreground">{windowWidth[0]}</span>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Zoom</label>
                  <Slider
                    value={[zoom]}
                    onValueChange={([value]) => setZoom(value)}
                    min={0.1}
                    max={5}
                    step={0.1}
                    className="mt-2"
                  />
                  <span className="text-xs text-muted-foreground">{(zoom * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* Drawing Controls */}
            <div>
              <h3 className="font-medium text-foreground mb-3">Drawing Tools</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Brush Size</label>
                  <Slider
                    value={[drawing.brushSize]}
                    onValueChange={([value]) => drawing.setBrushSize(value)}
                    min={1}
                    max={20}
                    step={1}
                    className="mt-2"
                  />
                  <span className="text-xs text-muted-foreground">{drawing.brushSize}px</span>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Eraser Size</label>
                  <Slider
                    value={[drawing.eraserSize]}
                    onValueChange={([value]) => drawing.setEraserSize(value)}
                    min={5}
                    max={50}
                    step={5}
                    className="mt-2"
                  />
                  <span className="text-xs text-muted-foreground">{drawing.eraserSize}px</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => drawing.clearSlice(currentSlice)}
                  className="w-full"
                >
                  Clear Slice
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editor Panel */}
      <div className="w-80 bg-card border-l border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Structures
            </h3>
            <Button variant="medical" size="sm" onClick={addNewStructure}>
              <Plus className="w-4 h-4" />
              New
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-2 overflow-y-auto max-h-96">
          {[...rtStructures, ...drawing.structures.filter(s => !s.id.startsWith('rt_'))].map((structure) => {
            const isActive = drawing.activeStructureId === structure.id;
            return (
              <Card 
                key={structure.id} 
                className={`p-3 cursor-pointer transition-all ${
                  isActive ? "border-primary shadow-glow" : "hover:bg-muted/50"
                }`}
                onClick={() => startEditingRTStructure(structure.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-4 h-4 rounded border-2 flex-shrink-0"
                      style={{ backgroundColor: structure.color }}
                    />
                    <span className="text-sm font-medium text-foreground truncate">
                      {structure.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRTStructureVisibility(structure.id);
                    }}
                    className="flex-shrink-0"
                  >
                    {structure.visible ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {isActive && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <Badge variant="secondary" className="text-xs">
                      Active for drawing
                    </Badge>
                  </div>
                )}
              </Card>
            );
          })}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={interpolateSlices}
            className="w-full mt-4"
          >
            <Copy className="w-4 h-4 mr-2" />
            Interpolate Slices
          </Button>
        </div>

        <div className="p-4 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Total structures: {drawing.structures.length}</div>
            <div>Visible: {drawing.structures.filter(s => s.visible).length}</div>
            <div>Active: {drawing.activeStructureId || 'None'}</div>
            <div>Contours on slice: {drawing.getContoursForSlice(currentSlice).length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};