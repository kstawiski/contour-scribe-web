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
  
  // Drawing state with AGGRESSIVE debugging
  const [drawnContours, setDrawnContours] = useState<DrawnContour[]>([]);
  
  const [isDrawing, setIsDrawingInternal] = useState(false);
  const setIsDrawing = (value: boolean) => {
    console.log('🔥 setIsDrawing called!', { 
      from: isDrawing, 
      to: value, 
      stack: new Error().stack?.split('\n')[2] // Show where it was called from
    });
    setIsDrawingInternal(value);
  };
  
  const [currentPath, setCurrentPathInternal] = useState<{ x: number; y: number; z?: number }[]>([]);
  const setCurrentPath = (value: any) => {
    const newPath = typeof value === 'function' ? value(currentPath) : value;
    console.log('🔥 setCurrentPath called!', { 
      fromLength: currentPath.length, 
      toLength: Array.isArray(newPath) ? newPath.length : 'unknown',
      stack: new Error().stack?.split('\n')[2] // Show where it was called from
    });
    setCurrentPathInternal(newPath);
  };

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

  // Debug when drawing state changes - MOVED AFTER structures declaration
  useEffect(() => {
    console.log('🔄 Drawing state changed:', { isDrawing, pathLength: currentPath.length });
    
    // EMERGENCY SAVE: If we have a path but drawing stops unexpectedly, save it
    if (!isDrawing && currentPath.length > 5) {
      console.log('🆘 EMERGENCY SAVE: Drawing stopped with unsaved path!');
      const editingStructure = structures.find(s => s.isEditing);
      
      if (editingStructure) {
        const newContour: DrawnContour = {
          points: currentPath.map(p => ({ x: p.x, y: p.y })),
          sliceIndex: currentSlice,
          structureId: editingStructure.id
        };
        
        setDrawnContours(prev => {
          const updated = [...prev, newContour];
          console.log('🆘 Emergency saved! Total contours now:', updated.length);
          return updated;
        });
        
        toast({
          title: "Emergency save!",
          description: `Saved ${currentPath.length} points`,
        });
      }
    }
  }, [isDrawing, currentPath.length, structures, currentSlice]);

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

    // Simplified coordinate transformation - no offset issues
    const worldToCanvas = (worldX: number, worldY: number, worldZ?: number) => {
      const imagePosition = currentImage.imagePosition || [0, 0, 0];
      const pixelSpacing = currentImage.pixelSpacing || [1, 1];
      
      // Convert world coordinates to image pixel coordinates
      const pixelX = (worldX - imagePosition[0]) / pixelSpacing[0];
      const pixelY = (worldY - imagePosition[1]) / pixelSpacing[1];
      
      // Convert pixel coordinates to canvas coordinates with proper scaling
      const canvasX = imageX + (pixelX * imageBounds.scaleX);
      const canvasY = imageY + (pixelY * imageBounds.scaleY);
      
      return { x: canvasX, y: canvasY };
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

    // Render user-drawn contours - convert world coordinates back to canvas
    console.log('🎨 Rendering contours debug:', {
      totalContours: drawnContours.length,
      contoursOnSlice: drawnContours.filter(c => c.sliceIndex === currentSlice).length,
      currentSlice,
      visibleStructures: structures.filter(s => s.visible).length
    });
    
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
          // Convert first world coordinate point back to canvas coordinates
          const firstCanvasPoint = worldToCanvas(contour.points[0].x, contour.points[0].y);
          ctx.moveTo(firstCanvasPoint.x, firstCanvasPoint.y);
          
          contour.points.slice(1).forEach(point => {
            // Convert each world coordinate point back to canvas coordinates
            const canvasPoint = worldToCanvas(point.x, point.y);
            ctx.lineTo(canvasPoint.x, canvasPoint.y);
          });
          ctx.stroke();
        }
        
        ctx.setLineDash([]);
      });
    
    // Render current drawing path (live preview) - convert world coordinates
    if (currentPath.length > 1) {
      const editingStructure = structures.find(s => s.isEditing);
      if (editingStructure) {
        ctx.strokeStyle = editingStructure.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([2, 2]);
        
        ctx.beginPath();
        // Convert first world coordinate point back to canvas coordinates
        const firstCanvasPoint = worldToCanvas(currentPath[0].x, currentPath[0].y);
        ctx.moveTo(firstCanvasPoint.x, firstCanvasPoint.y);
        
        currentPath.slice(1).forEach(point => {
          // Convert each world coordinate point back to canvas coordinates
          const canvasPoint = worldToCanvas(point.x, point.y);
          ctx.lineTo(canvasPoint.x, canvasPoint.y);
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

  // EMERGENCY FIX: Add DOM event listeners as fallback for mouse events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleDOMMouseDown = (e: MouseEvent) => {
      console.log('🆘 DOM mousedown triggered as fallback!');
      console.log('🆘 DOM Event details:', { clientX: e.clientX, clientY: e.clientY, button: e.button });
      
      // Convert DOM event to React-like event object
      const reactEvent = {
        clientX: e.clientX,
        clientY: e.clientY,
        button: e.button,
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation(),
        currentTarget: canvas
      } as React.MouseEvent<HTMLCanvasElement>;
      
      handleCanvasMouseDown(reactEvent);
    };

    const handleDOMMouseUp = (e: MouseEvent) => {
      console.log('🆘 DOM mouseup triggered as fallback!');
      const reactEvent = {
        clientX: e.clientX,
        clientY: e.clientY,
        button: e.button,
        preventDefault: () => e.preventDefault(),
        stopPropagation: () => e.stopPropagation(),
        currentTarget: canvas
      } as React.MouseEvent<HTMLCanvasElement>;
      
      handleCanvasMouseUp(reactEvent);
    };

    // Add DOM listeners as emergency fallback
    canvas.addEventListener('mousedown', handleDOMMouseDown);
    canvas.addEventListener('mouseup', handleDOMMouseUp);
    
    console.log('🆘 Emergency DOM listeners added!');
    
    return () => {
      canvas.removeEventListener('mousedown', handleDOMMouseDown);
      canvas.removeEventListener('mouseup', handleDOMMouseUp);
    };
  }, [activeTool, ctImages.length]);


  // Helper function to convert canvas coordinates to world coordinates  
  const canvasToWorld = (canvasX: number, canvasY: number) => {
    const currentImage = ctImages[currentSlice];
    if (!currentImage) return { x: 0, y: 0, z: 0 };
    
    const canvasSize = 800;
    const imageAspect = currentImage.width / currentImage.height;
    const canvasAspect = 1;
    
    let drawWidth = currentImage.width;
    let drawHeight = currentImage.height;
    
    const maxSize = canvasSize * 0.95;
    if (imageAspect > canvasAspect) {
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
    
    const imageBounds = {
      x: imageX,
      y: imageY,
      width: drawWidth,
      height: drawHeight,
      scaleX: drawWidth / currentImage.width,
      scaleY: drawHeight / currentImage.height
    };
    
    const imagePosition = currentImage.imagePosition || [0, 0, currentImage.imagePosition?.[2] || 0];
    const pixelSpacing = currentImage.pixelSpacing || [1, 1];
    
    // Convert canvas position to image pixel coordinates
    const pixelX = (canvasX - imageBounds.x) / imageBounds.scaleX;
    const pixelY = (canvasY - imageBounds.y) / imageBounds.scaleY;
    
    // Convert to world coordinates
    const worldX = imagePosition[0] + (pixelX * pixelSpacing[0]);
    const worldY = imagePosition[1] + (pixelY * pixelSpacing[1]);
    const worldZ = imagePosition[2];
    
    return { x: worldX, y: worldY, z: worldZ };
  };

  // Helper function to convert world coordinates back to canvas coordinates
  const worldToCanvas = (worldX: number, worldY: number) => {
    const currentImage = ctImages[currentSlice];
    if (!currentImage) return { x: 0, y: 0 };
    
    const canvasSize = 800;
    const imageAspect = currentImage.width / currentImage.height;
    const canvasAspect = 1;
    
    let drawWidth = currentImage.width;
    let drawHeight = currentImage.height;
    
    const maxSize = canvasSize * 0.95;
    if (imageAspect > canvasAspect) {
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
    
    const imageBounds = {
      x: imageX,
      y: imageY,
      width: drawWidth,
      height: drawHeight,
      scaleX: drawWidth / currentImage.width,
      scaleY: drawHeight / currentImage.height
    };
    
    const imagePosition = currentImage.imagePosition || [0, 0, 0];
    const pixelSpacing = currentImage.pixelSpacing || [1, 1];
    
    // Convert world coordinates to image pixel coordinates
    const pixelX = (worldX - imagePosition[0]) / pixelSpacing[0];
    const pixelY = (worldY - imagePosition[1]) / pixelSpacing[1];
    
    // Convert pixel coordinates to canvas coordinates with proper scaling
    const canvasX = imageX + (pixelX * imageBounds.scaleX);
    const canvasY = imageY + (pixelY * imageBounds.scaleY);
    
    return { x: canvasX, y: canvasY };
  };

  // COMPLETELY NEW APPROACH: React event handlers instead of addEventListener
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('🟢 REACT onMouseDown triggered!');
    console.log('🔴 EMERGENCY DEBUG: Mouse down handler called!');
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('❌ No canvas ref');
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const canvasPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    // Convert to world coordinates using helper function
    const pos = canvasToWorld(canvasPos.x, canvasPos.y);
    
    // EXTENSIVE DEBUGGING FOR COORDINATE CONVERSION
    console.log('🔍 COORDINATE DEBUGGING:');
    console.log('📍 Raw canvas click:', canvasPos);
    console.log('🎯 Converted to world:', pos);
    
    // Test round-trip conversion
    const testCanvasPoint = worldToCanvas(pos.x, pos.y);
    console.log('🔄 Round-trip back to canvas:', testCanvasPoint);
    console.log('📐 Offset difference:', {
      x: canvasPos.x - testCanvasPoint.x,
      y: canvasPos.y - testCanvasPoint.y
    });
    
    // Log transformation parameters
    const currentImage = ctImages[currentSlice];
    if (currentImage) {
      console.log('🖼️ Image info:', {
        width: currentImage.width,
        height: currentImage.height,
        imagePosition: currentImage.imagePosition,
        pixelSpacing: currentImage.pixelSpacing,
        zoom,
        pan
      });
    }
    
    if (activeTool === "brush") {
      console.log('🖌️ Brush tool activated');
      
      // VISUAL DEBUGGING: Mark the actual click position on canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Draw a big red dot at the actual click position
          ctx.fillStyle = "#ff0000";
          ctx.beginPath();
          ctx.arc(canvasPos.x, canvasPos.y, 8, 0, 2 * Math.PI);
          ctx.fill();
          
          // Draw a big blue dot at where we think we clicked after conversion
          const backConverted = worldToCanvas(pos.x, pos.y);
          ctx.fillStyle = "#0000ff";
          ctx.beginPath();
          ctx.arc(backConverted.x, backConverted.y, 6, 0, 2 * Math.PI);
          ctx.fill();
          
          // Draw a line between them to see the offset
          ctx.strokeStyle = "#ffff00";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(canvasPos.x, canvasPos.y);
          ctx.lineTo(backConverted.x, backConverted.y);
          ctx.stroke();
        }
      }
      
      // Find existing editing structure or create one
      let editingStructure = structures.find(s => s.isEditing);
      
      if (!editingStructure) {
        const newStructure: Structure = {
          id: `user_structure_${Date.now()}`,
          name: `New Structure`,
          color: "#ff0000",
          visible: true,
          isEditing: true
        };
        
        console.log('🏗️ Creating new structure:', newStructure);
        setStructures(prev => [...prev.map(s => ({ ...s, isEditing: false })), newStructure]);
        editingStructure = newStructure;
      }
      
      setIsDrawing(true);
      setCurrentPath([pos]);
      console.log('✅ Started drawing for structure:', editingStructure.name);
      
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
    // SAFETY CHECK: Only allow drawing if mouse down was properly triggered
    if (!isDrawing) {
      console.log('🚫 Mouse move ignored - not in drawing mode');
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const canvasPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    // Convert to world coordinates using the same helper function
    const pos = canvasToWorld(canvasPos.x, canvasPos.y);
    
    console.log('🖱️ Mouse move while drawing:', pos);
    
    setCurrentPath(prev => {
      const newPath = [...prev, pos];
      console.log('📏 Path length:', newPath.length);
      return newPath;
    });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('🔴 REACT onMouseUp triggered', {
      isDrawing,
      pathLength: currentPath.length,
      hasEditingStructure: structures.some(s => s.isEditing)
    });
    
    // SAVE THE DRAWING STATE IMMEDIATELY - don't let it change
    const wasDrawing = isDrawing;
    const pathLength = currentPath.length;
    const currentPathSnapshot = [...currentPath];
    
    console.log('📸 Snapshot taken:', { wasDrawing, pathLength, snapshotLength: currentPathSnapshot.length });
    
    if (wasDrawing && pathLength > 2) {
      const editingStructure = structures.find(s => s.isEditing);
      console.log('💾 Save condition MET - attempting save:', {
        wasDrawing,
        pathLength,
        structureId: editingStructure?.id,
        sliceIndex: currentSlice,
        hasEditingStructure: !!editingStructure
      });
      
      if (editingStructure) {
        const newContour: DrawnContour = {
          points: currentPathSnapshot.map(p => ({ x: p.x, y: p.y })),
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
      } else {
        console.log('❌ No editing structure found!');
      }
    } else {
      console.log('❌ Save condition failed:', {
        isDrawing,
        pathLength: currentPath.length,
        minimumLength: 2
      });
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
                onMouseDown={(e) => {
                  console.log('🔴 DIRECT onMouseDown triggered!');
                  console.log('🔴 Event details:', { clientX: e.clientX, clientY: e.clientY, button: e.button });
                  handleCanvasMouseDown(e);
                }}
                onMouseMove={(e) => {
                  if (isDrawing) {
                    console.log('🔵 DIRECT onMouseMove triggered while drawing!');
                  }
                  handleCanvasMouseMove(e);
                }}
                onMouseUp={(e) => {
                  console.log('🟡 DIRECT onMouseUp triggered!');
                  handleCanvasMouseUp(e);
                }}
                onPointerDown={(e) => {
                  console.log('👆 POINTER DOWN triggered!', e.clientX, e.clientY);
                  // Fallback for touch devices or if mouse events don't work
                  if (activeTool === "brush") {
                    handleCanvasMouseDown(e as any);
                  }
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