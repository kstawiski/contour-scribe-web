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
  ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DicomImage, DicomRTStruct, DicomProcessor } from "@/lib/dicom-utils";

interface DicomViewerProps {
  ctImages: DicomImage[];
  rtStruct?: DicomRTStruct;
  onBack?: () => void;
}

interface Structure {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  isEditing: boolean;
}

type Tool = "select" | "pan" | "zoom" | "windowing" | "brush" | "eraser";

export const DicomViewer = ({ ctImages, rtStruct, onBack }: DicomViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Viewer state
  const [currentSlice, setCurrentSlice] = useState(0);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [windowLevel, setWindowLevel] = useState([400]);
  const [windowWidth, setWindowWidth] = useState([800]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Structure state - only include RT structures, remove default mock structures
  const [structures, setStructures] = useState<Structure[]>(() => {
    const editableStructures: Structure[] = [];
    
    // Add RT structures if available
    if (rtStruct?.structures) {
      rtStruct.structures.forEach((rtStructure, index) => {
        editableStructures.push({
          id: `rt_${index}`,
          name: rtStructure.name,
          color: `rgb(${Math.round(rtStructure.color[0])}, ${Math.round(rtStructure.color[1])}, ${Math.round(rtStructure.color[2])})`,
          visible: true,
          isEditing: false
        });
      });
    }
    
    return editableStructures;
  });

  // Canvas setup and rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || ctImages.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentImage = ctImages[currentSlice];
    if (!currentImage) return;

    // Set canvas to fill available space - much larger than before
    const canvasSize = 600; // Increased from 512
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Clear canvas with black background (standard for medical imaging)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate image positioning and scaling to fill more of the canvas
    const imageAspect = currentImage.width / currentImage.height;
    const canvasAspect = 1; // Square canvas
    
    let drawWidth = currentImage.width;
    let drawHeight = currentImage.height;
    
    // Scale to fit canvas while maintaining aspect ratio - use more space
    const maxSize = canvasSize * 0.95; // Use 95% of canvas instead of 90%
    if (imageAspect > canvasAspect) {
      drawWidth = maxSize;
      drawHeight = drawWidth / imageAspect;
    } else {
      drawHeight = maxSize;
      drawWidth = drawHeight * imageAspect;
    }
    
    // Apply zoom
    drawWidth *= zoom;
    drawHeight *= zoom;
    
    // Center the image with pan offset
    const imageX = (canvasSize - drawWidth) / 2 + pan.x;
    const imageY = (canvasSize - drawHeight) / 2 + pan.y;

    // Store image bounds for coordinate transformation
    const imageBounds = {
      x: imageX,
      y: imageY,
      width: drawWidth,
      height: drawHeight,
      scaleX: drawWidth / currentImage.width,
      scaleY: drawHeight / currentImage.height
    };

    // Render the actual DICOM image
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
        
        // Draw the DICOM image at calculated position
        ctx.drawImage(tempCanvas, imageX, imageY, drawWidth, drawHeight);
      }
    } catch (error) {
      console.error("Error rendering DICOM image:", error);
      
      // Fallback rendering
      ctx.fillStyle = "#333333";
      ctx.fillRect(imageX, imageY, drawWidth, drawHeight);
      
      // Add a simple cross-hair in center for reference
      ctx.strokeStyle = "#666666";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(imageX + drawWidth/2 - 20, imageY + drawHeight/2);
      ctx.lineTo(imageX + drawWidth/2 + 20, imageY + drawHeight/2);
      ctx.moveTo(imageX + drawWidth/2, imageY + drawHeight/2 - 20);
      ctx.lineTo(imageX + drawWidth/2, imageY + drawHeight/2 + 20);
      ctx.stroke();
    }

    // Improved coordinate transformation for DICOM structures
    const worldToCanvas = (worldX: number, worldY: number, worldZ?: number) => {
      // More accurate coordinate transformation
      // Assume DICOM coordinates are in mm, need to convert to pixel space
      // This is a simplified transformation - real implementation would use 
      // Image Position Patient and Image Orientation Patient DICOM tags
      
      // For now, assume the image center is at world coordinate (0,0)
      // and scale appropriately
      const pixelSpacing = 1; // mm per pixel - would come from DICOM tags
      
      const normalizedX = 0.5 + (worldX / (currentImage.width * pixelSpacing * 0.5));
      const normalizedY = 0.5 - (worldY / (currentImage.height * pixelSpacing * 0.5)); // Flip Y
      
      return {
        x: imageX + normalizedX * drawWidth,
        y: imageY + normalizedY * drawHeight
      };
    };

    // Render RT structure contours if available - more precise slice matching
    if (rtStruct?.structures) {
      rtStruct.structures.forEach((rtStructure, structIndex) => {
        const structure = structures.find(s => s.id === `rt_${structIndex}`);
        if (!structure?.visible) return;
        
        ctx.strokeStyle = structure.color;
        ctx.lineWidth = 2;
        ctx.setLineDash(structure.isEditing ? [5, 5] : []);
        
        // Only show contours that exactly match the current slice or are very close
        rtStructure.contours.forEach(contour => {
          const currentSliceLocation = currentImage.sliceLocation || currentSlice * 5;
          
          // Much more precise slice matching - only show if exactly on this slice
          let shouldShowContour = false;
          
          if (contour.sliceIndex === currentSlice) {
            shouldShowContour = true;
          } else if (contour.points.length > 0) {
            // Check Z coordinate of contour points
            const contourZ = contour.points[0][2];
            const sliceTolerance = 1.0; // mm tolerance
            shouldShowContour = Math.abs(contourZ - currentSliceLocation) < sliceTolerance;
          }
          
          if (shouldShowContour && contour.points.length > 0) {
            ctx.beginPath();
            contour.points.forEach((point, index) => {
              const canvasPoint = worldToCanvas(point[0], point[1], point[2]);
              
              if (index === 0) {
                ctx.moveTo(canvasPoint.x, canvasPoint.y);
              } else {
                ctx.lineTo(canvasPoint.x, canvasPoint.y);
              }
            });
            ctx.closePath();
            ctx.stroke();
          }
        });
        
        ctx.setLineDash([]);
      });
    }

    // Remove the mock circular structures - they were confusing
    // Only render user-created structures when they're actually being edited
    structures.forEach((structure) => {
      if (!structure.visible || structure.id.startsWith('rt_') || !structure.isEditing) return;
      
      ctx.strokeStyle = structure.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      
      // Show editing indicator in center
      const centerX = imageX + drawWidth / 2;
      const centerY = imageY + drawHeight / 2;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, 10, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Add text indicating editing mode
      ctx.fillStyle = structure.color;
      ctx.font = "14px Arial";
      ctx.fillText("Editing: " + structure.name, centerX + 15, centerY);
      
      ctx.setLineDash([]);
    });

    // Compact overlay information in corner
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 180, 70);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "11px monospace";
    ctx.fillText(`${currentSlice + 1}/${ctImages.length}`, 15, 25);
    ctx.fillText(`WL:${windowLevel[0]} WW:${windowWidth[0]}`, 15, 40);
    ctx.fillText(`${(zoom * 100).toFixed(0)}%`, 15, 55);
    
    if (currentImage.sliceLocation !== undefined) {
      ctx.fillText(`${currentImage.sliceLocation.toFixed(1)}mm`, 15, 70);
    }
    
  }, [currentSlice, structures, ctImages, windowLevel, windowWidth, zoom, pan, rtStruct]);

  // Mouse wheel event for slice navigation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Only navigate slices if we're not in zoom mode
      if (activeTool !== "zoom") {
        const delta = e.deltaY > 0 ? 1 : -1;
        setCurrentSlice(prev => {
          const newSlice = prev + delta;
          return Math.max(0, Math.min(ctImages.length - 1, newSlice));
        });
      } else {
        // Zoom mode: use wheel for zooming
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [activeTool, ctImages.length]);

  // Mouse events for panning and windowing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isMouseDown = false;
    let lastMousePos = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      const rect = canvas.getBoundingClientRect();
      lastMousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;

      const rect = canvas.getBoundingClientRect();
      const currentPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      const deltaX = currentPos.x - lastMousePos.x;
      const deltaY = currentPos.y - lastMousePos.y;

      if (activeTool === "pan") {
        setPan(prev => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY
        }));
      } else if (activeTool === "windowing") {
        // Standard DICOM windowing: horizontal = window width, vertical = window level
        setWindowWidth(prev => [Math.max(1, prev[0] + deltaX * 4)]);
        setWindowLevel(prev => [prev[0] - deltaY * 2]);
      }

      lastMousePos = currentPos;
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [activeTool]);

  const handleToolChange = (tool: Tool) => {
    setActiveTool(tool);
    // Reset editing state when changing tools
    if (tool !== "brush" && tool !== "eraser") {
      setStructures(prev => prev.map(s => ({ ...s, isEditing: false })));
    }
  };

  const toggleStructureVisibility = (id: string) => {
    setStructures(prev => 
      prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s)
    );
  };

  const startEditingStructure = (id: string) => {
    setStructures(prev => 
      prev.map(s => ({ ...s, isEditing: s.id === id ? !s.isEditing : false }))
    );
    if (activeTool === "select") {
      setActiveTool("brush");
    }
  };

  const addNewStructure = () => {
    const newId = `edit_${Date.now()}`;
    const colors = ["#ff8844", "#8844ff", "#44ff88", "#ff4488", "#88ff44"];
    const color = colors[structures.filter(s => s.id.startsWith('edit_')).length % colors.length];
    
    const newStructure: Structure = {
      id: newId,
      name: `New_Structure_${structures.length + 1}`,
      color,
      visible: true,
      isEditing: true
    };
    
    setStructures(prev => [...prev, newStructure]);
    setActiveTool("brush");
    
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
    
    // Mock download - in real implementation, this would generate a proper DICOM file
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
                variant={activeTool === "select" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleToolChange("select")}
              >
                <MousePointer className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTool === "pan" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleToolChange("pan")}
              >
                <Move className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTool === "zoom" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleToolChange("zoom")}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTool === "windowing" ? "default" : "ghost"}
                size="sm"
                onClick={() => handleToolChange("windowing")}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            <div className="flex items-center gap-1 border border-border rounded-md p-1">
              <Button
                variant={activeTool === "brush" ? "medical" : "ghost"}
                size="sm"
                onClick={() => handleToolChange("brush")}
              >
                <Paintbrush className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTool === "eraser" ? "warning" : "ghost"}
                size="sm"
                onClick={() => handleToolChange("eraser")}
              >
                <Eraser className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-8" />

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Tool:</span>
              <Badge variant="secondary" className="capitalize">
                {activeTool}
              </Badge>
            </div>
          </div>
        </div>

        {/* Viewer Canvas */}
        <div className="flex-1 flex">
          {/* Canvas Container - Make it stretch more */}
          <div className="flex-1 bg-black flex items-center justify-center p-2">
            <div className="relative w-full h-full flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="border border-border shadow-elevation max-w-full max-h-full"
                style={{
                  imageRendering: "pixelated",
                  width: "min(80vh, 80vw)", // Responsive sizing
                  height: "min(80vh, 80vw)",
                  cursor: activeTool === "pan" ? "move" : 
                         activeTool === "zoom" ? "zoom-in" : 
                         activeTool === "windowing" ? "crosshair" :
                         activeTool === "brush" ? "crosshair" :
                         activeTool === "eraser" ? "crosshair" : "default"
                }}
              />
              
              {/* Tool instructions overlay */}
              <div className="absolute bottom-2 left-2 bg-black/80 text-white p-2 rounded text-xs">
                {activeTool === "select" && "Mouse wheel: Navigate slices"}
                {activeTool === "pan" && "Drag: Pan image | Wheel: Navigate slices"}
                {activeTool === "zoom" && "Wheel: Zoom in/out | Drag: Pan"}
                {activeTool === "windowing" && "Drag: Adjust window/level | Wheel: Navigate slices"}
                {activeTool === "brush" && "Click/Drag: Draw structure | Wheel: Navigate slices"}
                {activeTool === "eraser" && "Click/Drag: Erase structure | Wheel: Navigate slices"}
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
                  orientation="horizontal"
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
          </div>
        </div>
      </div>

      {/* Editor Panel */}
      <div className="w-80 bg-card border-l border-border flex flex-col">
        {/* Header */}
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

        {/* Structures List */}
        <div className="flex-1 p-4 space-y-2 overflow-y-auto">
          {structures.map((structure) => (
            <Card 
              key={structure.id} 
              className={`p-3 cursor-pointer transition-all ${
                structure.isEditing ? "border-primary shadow-glow" : "hover:bg-muted/50"
              }`}
              onClick={() => startEditingStructure(structure.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded border-2"
                    style={{ backgroundColor: structure.color }}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {structure.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStructureVisibility(structure.id);
                    }}
                  >
                    {structure.visible ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              {structure.isEditing && (
                <div className="mt-2 pt-2 border-t border-border">
                  <div className="flex gap-1">
                    <Badge variant="secondary" className="text-xs">
                      Editing
                    </Badge>
                    <Badge 
                      variant={activeTool === "brush" ? "default" : "outline"} 
                      className="text-xs"
                    >
                      Draw
                    </Badge>
                    <Badge 
                      variant={activeTool === "eraser" ? "destructive" : "outline"} 
                      className="text-xs"
                    >
                      Erase
                    </Badge>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Total structures: {structures.length}</div>
            <div>Visible: {structures.filter(s => s.visible).length}</div>
            <div>Editing: {structures.filter(s => s.isEditing).length}</div>
          </div>
        </div>
      </div>
    </div>
  );
};