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

interface DrawnContour {
  points: { x: number; y: number }[];
  sliceIndex: number;
  structureId: string;
}

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
  
  // Drawing state
  const [drawnContours, setDrawnContours] = useState<DrawnContour[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

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

    // Set canvas to fill available space - make it larger and responsive
    const canvasSize = 800; // Much larger canvas
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

    // Correct DICOM coordinate transformation
    const worldToCanvas = (worldX: number, worldY: number, worldZ?: number) => {
      // DICOM RT structures are in patient coordinate system (mm)
      // Image Position Patient defines the origin of the image plane
      const imagePosition = currentImage.imagePosition || [0, 0, 0];
      
      // Get pixel spacing from DICOM header
      let pixelSpacing = currentImage.pixelSpacing || [1, 1];
      
      // Transform from patient coordinates to image pixel coordinates
      // For axial images, X maps to columns, Y maps to rows
      const relativeX = worldX - imagePosition[0];
      const relativeY = worldY - imagePosition[1];
      
      // Convert to pixel coordinates
      const pixelX = relativeX / pixelSpacing[0];
      const pixelY = relativeY / pixelSpacing[1];
      
      // Transform to canvas coordinates
      // DICOM uses right-handed coordinate system, canvas uses left-handed
      // No Y flip needed - keep natural DICOM orientation
      const canvasX = imageX + (pixelX / currentImage.width) * drawWidth;
      const canvasY = imageY + (pixelY / currentImage.height) * drawHeight;
      
      return {
        x: canvasX,
        y: canvasY
      };
    };

    // Render RT structure contours with debugging
    if (rtStruct?.structures) {
      rtStruct.structures.forEach((rtStructure, structIndex) => {
        const structure = structures.find(s => s.id === `rt_${structIndex}`);
        if (!structure?.visible) return;
        
        ctx.strokeStyle = structure.color;
        ctx.lineWidth = 2;
        ctx.setLineDash(structure.isEditing ? [5, 5] : []);
        
        // Get current slice Z position
        const currentSliceZ = currentImage.sliceLocation;
        
        console.log(`Slice ${currentSlice}: Z=${currentSliceZ}, Structure: ${rtStructure.name}`);
        
        rtStructure.contours.forEach((contour, contourIndex) => {
          if (contour.points.length === 0) return;
          
          // Check if this contour belongs to the current slice
          const contourZ = contour.points[0][2]; // Z coordinate from first point
          let shouldShowContour = false;
          
          if (currentSliceZ !== undefined) {
            // Use slice thickness for tolerance, or default to 1mm
            const tolerance = (currentImage.sliceThickness || 1.0) / 2;
            shouldShowContour = Math.abs(contourZ - currentSliceZ) <= tolerance;
          } else {
            // Fallback: match by slice index
            shouldShowContour = contour.sliceIndex === currentSlice;
          }
          
          if (shouldShowContour) {
            console.log(`Drawing contour ${contourIndex} for ${rtStructure.name}:`, {
              contourZ,
              currentSliceZ,
              pointCount: contour.points.length,
              firstPoint: contour.points[0],
              lastPoint: contour.points[contour.points.length - 1]
            });
            
            ctx.beginPath();
            let validPoints = 0;
            
            contour.points.forEach((point, index) => {
              const canvasPoint = worldToCanvas(point[0], point[1], point[2]);
              
              // Debug: draw point markers for first contour
              if (contourIndex === 0 && index < 5) {
                ctx.fillStyle = 'yellow';
                ctx.fillRect(canvasPoint.x - 2, canvasPoint.y - 2, 4, 4);
                ctx.fillStyle = structure.color;
              }
              
              // Only draw if the point is within reasonable bounds
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

    // Render user-drawn contours
    drawnContours
      .filter(contour => contour.sliceIndex === currentSlice)
      .forEach((contour, index) => {
        const structure = structures.find(s => s.id === contour.structureId);
        if (!structure?.visible) return;
        
        ctx.strokeStyle = structure.color;
        ctx.lineWidth = 3;
        ctx.setLineDash(structure.isEditing ? [5, 5] : []);
        
        if (contour.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(contour.points[0].x, contour.points[0].y);
          contour.points.slice(1).forEach(point => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
        }
        
        ctx.setLineDash([]);
      });
    
    // Render current drawing path (live preview)
    if (currentPath.length > 1) {
      const editingStructure = structures.find(s => s.isEditing);
      if (editingStructure) {
        ctx.strokeStyle = editingStructure.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([2, 2]);
        
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        currentPath.slice(1).forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Enhanced debug overlay with coordinate info
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(10, 10, 220, 210); // Larger debug area
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "11px monospace";
    ctx.fillText(`${currentSlice + 1}/${ctImages.length}`, 15, 25);
    ctx.fillText(`WL:${windowLevel[0]} WW:${windowWidth[0]}`, 15, 40);
    ctx.fillText(`${(zoom * 100).toFixed(0)}%`, 15, 55);
    
    if (currentImage.sliceLocation !== undefined) {
      ctx.fillText(`Z: ${currentImage.sliceLocation.toFixed(1)}mm`, 15, 70);
    }
    if (currentImage.sliceThickness !== undefined) {
      ctx.fillText(`Thick: ${currentImage.sliceThickness.toFixed(1)}mm`, 15, 85);
    }
    
    // Show number of visible contours on this slice
    let contoursOnSlice = 0;
    if (rtStruct?.structures) {
      const tolerance = (currentImage.sliceThickness || 1.0) / 2;
      rtStruct.structures.forEach(structure => {
        structure.contours.forEach(contour => {
          if (contour.points.length > 0) {
            const contourZ = contour.points[0][2];
            const currentSliceZ = currentImage.sliceLocation;
            if (currentSliceZ !== undefined && Math.abs(contourZ - currentSliceZ) <= tolerance) {
              contoursOnSlice++;
            }
          }
        });
      });
    }
    
    // COMPREHENSIVE DEBUG INFO
    const contoursOnCurrentSlice = drawnContours.filter(c => c.sliceIndex === currentSlice).length;
    ctx.fillText(`Drawn: ${contoursOnCurrentSlice}`, 15, 115);
    ctx.fillText(`Total drawn: ${drawnContours.length}`, 15, 130);
    ctx.fillText(`Tool: ${activeTool}`, 15, 145);
    ctx.fillText(`Drawing: ${isDrawing ? 'YES' : 'NO'}`, 15, 160);
    ctx.fillText(`Path pts: ${currentPath.length}`, 15, 175);
    ctx.fillText(`Structures: ${structures.length}`, 15, 190);
    
    const editingStructure = structures.find(s => s.isEditing);
    if (editingStructure) {
      ctx.fillText(`Editing: ${editingStructure.name}`, 15, 205);
    }
    // Add center crosshair for reference - image center
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(imageX + drawWidth/2 - 10, imageY + drawHeight/2);
    ctx.lineTo(imageX + drawWidth/2 + 10, imageY + drawHeight/2);
    ctx.moveTo(imageX + drawWidth/2, imageY + drawHeight/2 - 10);
    ctx.lineTo(imageX + drawWidth/2, imageY + drawHeight/2 + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    
  }, [currentSlice, structures, ctImages, windowLevel, windowWidth, zoom, pan, rtStruct, drawnContours, currentPath, isDrawing]);

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

  // COMPLETELY NEW APPROACH: React event handlers instead of addEventListener
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('🟢 REACT onMouseDown triggered!');
    console.log('Event details:', {
      clientX: e.clientX,
      clientY: e.clientY,
      button: e.button,
      target: e.currentTarget,
      activeTool,
      isDrawing
    });
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('❌ No canvas ref');
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const pos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    console.log('📍 Canvas position:', pos);
    console.log('📐 Canvas rect:', rect);
    
    if (activeTool === "brush") {
      console.log('🖌️ Brush tool activated');
      
      // Force create a new structure for testing
      const newStructure: Structure = {
        id: `test_${Date.now()}`,
        name: `Test_${Date.now()}`,
        color: "#ff0000", // Bright red for visibility
        visible: true,
        isEditing: true
      };
      
      console.log('🏗️ Creating new structure:', newStructure);
      
      setStructures(prev => {
        const updated = [...prev.map(s => ({ ...s, isEditing: false })), newStructure];
        console.log('📝 Updated structures:', updated);
        return updated;
      });
      
      setIsDrawing(true);
      setCurrentPath([pos]);
      console.log('✅ Started drawing at:', pos);
      
    } else if (activeTool === "eraser") {
      console.log('🧽 Eraser tool activated');
      const beforeCount = drawnContours.length;
      
      setDrawnContours(prev => {
        const filtered = prev.filter(contour => {
          if (contour.sliceIndex !== currentSlice) return true;
          
          return !contour.points.some(point => {
            const dx = point.x - pos.x;
            const dy = point.y - pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= 50; // Large erase radius for testing
          });
        });
        
        console.log(`🗑️ Erased ${beforeCount - filtered.length} contours`);
        return filtered;
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const pos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    console.log('🖱️ Mouse move while drawing:', pos);
    
    setCurrentPath(prev => {
      const newPath = [...prev, pos];
      console.log('📏 Path length:', newPath.length);
      return newPath;
    });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('🔴 REACT onMouseUp triggered');
    
    if (isDrawing && currentPath.length > 2) {
      const editingStructure = structures.find(s => s.isEditing);
      console.log('💾 Saving contour:', {
        structureId: editingStructure?.id,
        pathLength: currentPath.length,
        sliceIndex: currentSlice
      });
      
      if (editingStructure) {
        const newContour: DrawnContour = {
          points: currentPath.map(p => ({ x: p.x, y: p.y })),
          sliceIndex: currentSlice,
          structureId: editingStructure.id
        };
        
        setDrawnContours(prev => {
          const updated = [...prev, newContour];
          console.log('💿 Saved! Total contours:', updated.length);
          return updated;
        });
        
        toast({
          title: "Drawing saved!",
          description: `${currentPath.length} points on slice ${currentSlice + 1}`,
        });
      }
    }
    
    setIsDrawing(false);
    setCurrentPath([]);
    console.log('🏁 Drawing finished');
  };

  // Add click test handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('🎯 BASIC CLICK TEST WORKS!', e.clientX, e.clientY);
  };

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
          {/* Canvas Container - Full screen stretch */}
          <div className="flex-1 bg-black flex items-center justify-center p-4">
            <div className="relative w-full h-full flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="border-4 border-red-500 shadow-elevation cursor-crosshair"
                style={{
                  imageRendering: "pixelated",
                  width: "min(calc(100vh - 200px), calc(100vw - 700px))",
                  height: "min(calc(100vh - 200px), calc(100vw - 700px))",
                  touchAction: "none",
                  userSelect: "none",
                  backgroundColor: "rgba(255,0,0,0.1)" // Red tint to see canvas bounds
                }}
                onClick={handleCanvasClick}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onPointerDown={(e) => {
                  console.log('🔵 POINTER DOWN:', e.clientX, e.clientY);
                  handleCanvasMouseDown(e as any);
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

        {/* Structures List - Scrollable */}
        <div className="flex-1 p-4 space-y-2 overflow-y-auto max-h-96">
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