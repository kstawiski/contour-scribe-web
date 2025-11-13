import { useState, useRef, useEffect, useMemo } from "react";
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
  RotateCw,
  Keyboard,
  Undo,
  Redo,
  Maximize2,
  Grid3x3
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DicomImage, DicomRTStruct, DicomProcessor } from "@/lib/dicom-utils";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { MPRViewer } from "@/components/MPRViewer";
import { useDrawing, DrawingTool } from "@/hooks/useDrawing";
import { Point2D, interpolateContours } from "@/lib/contour-utils";
import { exportRTStruct } from "@/lib/rtstruct-export";
import { worldToCanvas as worldToCanvasUtil, canvasToWorld as canvasToWorldUtil } from "@/lib/coordinate-utils";
import { useKeyboardShortcuts, KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { HUOverlay } from "@/components/HUOverlay";

interface DicomViewerProps {
  ctImages: DicomImage[];
  rtStruct?: DicomRTStruct;
  probabilityMap?: Float32Array[];
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

export const DicomViewer = ({ ctImages, rtStruct, probabilityMap, onBack }: DicomViewerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const [probThreshold, setProbThreshold] = useState([0.5]);
  const [mprMode, setMprMode] = useState(false);

  // Mouse interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Keyboard shortcuts help modal
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // HU value display state
  const [showHUOverlay, setShowHUOverlay] = useState(true);
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);
  const [huInfo, setHUInfo] = useState<{
    pixelX: number;
    pixelY: number;
    huValue: number;
  } | null>(null);
  
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
      // Reuse temporary canvas if possible
      if (!tempCanvasRef.current) {
        tempCanvasRef.current = document.createElement('canvas');
      }
      const tempCanvas = tempCanvasRef.current;
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

    // Render probability map overlay if available
    if (probabilityMap && probabilityMap[currentSlice]) {
      const slice = probabilityMap[currentSlice];

      // Reuse overlay canvas if possible
      if (!overlayCanvasRef.current) {
        overlayCanvasRef.current = document.createElement('canvas');
      }
      const overlayCanvas = overlayCanvasRef.current;
      overlayCanvas.width = currentImage.width;
      overlayCanvas.height = currentImage.height;
      const octx = overlayCanvas.getContext('2d');

      if (octx) {
        const imageData = octx.createImageData(currentImage.width, currentImage.height);
        for (let i = 0; i < slice.length; i++) {
          const p = slice[i];
          if (p >= probThreshold[0]) {
            const idx = i * 4;
            imageData.data[idx] = 255;
            imageData.data[idx + 1] = 0;
            imageData.data[idx + 2] = 0;
            imageData.data[idx + 3] = Math.round(p * 255);
          }
        }
        octx.putImageData(imageData, 0, 0);
        ctx.drawImage(overlayCanvas, imageX, imageY, drawWidth, drawHeight);
      }
    }

    // Coordinate transformation functions
    const config = {
      canvasSize,
      zoom,
      pan
    };

    const worldToCanvas = (worldX: number, worldY: number) => {
      return worldToCanvasUtil(worldX, worldY, currentImage, config);
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


  }, [currentSlice, rtStructures, ctImages, windowLevel, windowWidth, zoom, pan, rtStruct, drawing, probabilityMap, probThreshold]);

  // Note: Canvas refs are automatically cleaned up by React on unmount

  // Helper function to get image bounds on canvas
  const getImageBounds = (image: DicomImage, config: { canvasSize: number; zoom: number; pan: { x: number; y: number } }) => {
    const imageAspect = image.width / image.height;
    let drawWidth, drawHeight;

    const maxSize = config.canvasSize * 0.95;
    if (imageAspect > 1) {
      drawWidth = maxSize;
      drawHeight = drawWidth / imageAspect;
    } else {
      drawHeight = maxSize;
      drawWidth = drawHeight * imageAspect;
    }

    drawWidth *= config.zoom;
    drawHeight *= config.zoom;

    const x = (config.canvasSize - drawWidth) / 2 + config.pan.x;
    const y = (config.canvasSize - drawHeight) / 2 + config.pan.y;

    return { x, y, width: drawWidth, height: drawHeight };
  };

  // Convert canvas coordinates to world coordinates for drawing
  const canvasToWorld = (canvasX: number, canvasY: number): Point2D => {
    const currentImage = ctImages[currentSlice];
    if (!currentImage) return { x: 0, y: 0 };

    const config = {
      canvasSize: 800,
      zoom,
      pan
    };

    return canvasToWorldUtil(canvasX, canvasY, currentImage, config);
  };

  // Handle wheel events for slice navigation and zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    // Ctrl+scroll for zoom (works in any tool mode)
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
    } else {
      // Regular scroll for slice navigation (works in any tool mode)
      const delta = e.deltaY > 0 ? 1 : -1;
      setCurrentSlice(prev => {
        const newSlice = prev + delta;
        return Math.max(0, Math.min(ctImages.length - 1, newSlice));
      });
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

  // Mouse event handlers for Pan and Windowing tools
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle mouse button (button 1) for pan
    if (e.button === 1) {
      e.preventDefault();
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      // Temporarily switch to pan mode
      setViewerTool("pan");
      return;
    }

    // Left button with pan or windowing tool
    if (e.button === 0 && (viewerTool === "pan" || viewerTool === "windowing")) {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Update HU overlay position and value
    const canvas = canvasRef.current;
    if (canvas && showHUOverlay) {
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;

      setMouseCanvasPos({ x: canvasX, y: canvasY });

      // Convert canvas coordinates to pixel coordinates in the image
      const currentImage = ctImages[currentSlice];
      if (currentImage) {
        const config = {
          canvasSize: 800,
          zoom,
          pan,
        };

        const bounds = getImageBounds(currentImage, config);

        // Check if mouse is within image bounds
        if (
          canvasX >= bounds.x &&
          canvasX <= bounds.x + bounds.width &&
          canvasY >= bounds.y &&
          canvasY <= bounds.y + bounds.height
        ) {
          // Convert to pixel coordinates
          const pixelX = ((canvasX - bounds.x) / bounds.width) * currentImage.width;
          const pixelY = ((canvasY - bounds.y) / bounds.height) * currentImage.height;

          // Get HU value
          const huValue = DicomProcessor.getHUValueAtPixel(
            currentImage,
            pixelX,
            pixelY
          );

          if (huValue !== null) {
            setHUInfo({
              pixelX: Math.floor(pixelX),
              pixelY: Math.floor(pixelY),
              huValue,
            });
          } else {
            setHUInfo(null);
          }
        } else {
          setHUInfo(null);
        }
      }
    }

    // Handle pan and windowing drag
    if (!isDragging) return;

    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;

    if (viewerTool === "pan") {
      setPan((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
    } else if (viewerTool === "windowing") {
      // Horizontal movement adjusts window width
      // Vertical movement adjusts window level
      setWindowWidth((prev) => {
        const newWidth = Math.max(1, prev[0] + deltaX * 2);
        return [newWidth];
      });
      setWindowLevel((prev) => {
        const newLevel = prev[0] - deltaY * 2; // Inverted for intuitive up/down
        return [newLevel];
      });
    }

    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If middle button was used for pan, restore previous tool
    if (e.button === 1 && isDragging) {
      setViewerTool("select");
    }
    setIsDragging(false);
  };

  const handleCanvasMouseLeave = () => {
    setIsDragging(false);
    setMouseCanvasPos(null);
    setHUInfo(null);
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
    try {
      if (drawing.structures.length === 0) {
        toast({
          title: "No structures to export",
          description: "Please create at least one structure before exporting",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Export initiated",
        description: "Generating DICOM RT Structure file...",
      });

      // Export as JSON format (DICOM-RT representation)
      exportRTStruct(drawing.structures, ctImages, 'json', rtStruct);

      toast({
        title: "Export complete",
        description: "RT Structure file downloaded successfully",
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
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
      const activeStructureId = drawing.activeStructureId;
      const activeStructure = drawing.structures.find(s => s.id === activeStructureId);
      if (activeStructure && activeStructure.contours.length >= 2) {
        // Find slices with contours
        const slicesWithContours = [...new Set(activeStructure.contours.map(c => c.sliceIndex))].sort((a, b) => a - b);

        if (slicesWithContours.length >= 2) {
          let interpolatedCount = 0;

          // Interpolate between consecutive pairs of slices with contours
          for (let i = 0; i < slicesWithContours.length - 1; i++) {
            const slice1 = slicesWithContours[i];
            const slice2 = slicesWithContours[i + 1];

            // Find the contours for these slices
            const contour1 = activeStructure.contours.find(c => c.sliceIndex === slice1);
            const contour2 = activeStructure.contours.find(c => c.sliceIndex === slice2);

            if (contour1 && contour2) {
              // Interpolate for all slices between slice1 and slice2
              for (let targetSlice = slice1 + 1; targetSlice < slice2; targetSlice++) {
                const interpolatedContour = interpolateContours(contour1, contour2, targetSlice);

                if (interpolatedContour) {
                  // Add the interpolated contour to the drawing
                  drawing.addContourToStructure(
                    activeStructureId,
                    interpolatedContour
                  );
                  interpolatedCount++;
                }
              }
            }
          }

          if (interpolatedCount > 0) {
            toast({
              title: "Interpolation complete",
              description: `Added ${interpolatedCount} interpolated contours`,
            });
          } else {
            toast({
              title: "No interpolation needed",
              description: "All intermediate slices already have contours",
            });
          }
        }
      } else {
        toast({
          title: "Cannot interpolate",
          description: "Need at least 2 contours to interpolate",
          variant: "destructive"
        });
      }
    } else {
      toast({
        title: "No structure selected",
        description: "Please select a structure first",
        variant: "destructive"
      });
    }
  };

  // Define keyboard shortcuts
  const keyboardShortcuts: KeyboardShortcut[] = useMemo(() => [
    // Help
    {
      key: '?',
      handler: () => setShowShortcutsHelp((prev) => !prev),
      description: 'Show keyboard shortcuts help',
      category: 'Help',
    },
    {
      key: 'h',
      handler: () => setShowShortcutsHelp((prev) => !prev),
      description: 'Show keyboard shortcuts help',
      category: 'Help',
    },

    // Tool Selection
    {
      key: 's',
      handler: () => handleViewerToolChange('select'),
      description: 'Select tool',
      category: 'Tools',
    },
    {
      key: 'b',
      handler: () => handleDrawingToolChange('brush'),
      description: 'Brush tool',
      category: 'Tools',
    },
    {
      key: 'e',
      handler: () => handleDrawingToolChange('eraser'),
      description: 'Eraser tool',
      category: 'Tools',
    },
    {
      key: 'p',
      handler: () => handleViewerToolChange('pan'),
      description: 'Pan tool',
      category: 'Tools',
    },
    {
      key: 'w',
      handler: () => handleViewerToolChange('windowing'),
      description: 'Window/Level tool',
      category: 'Tools',
    },

    // Navigation
    {
      key: '[',
      handler: () => {
        setCurrentSlice((prev) => Math.max(0, prev - 1));
      },
      description: 'Previous slice',
      category: 'Navigation',
    },
    {
      key: ']',
      handler: () => {
        setCurrentSlice((prev) => Math.min(ctImages.length - 1, prev + 1));
      },
      description: 'Next slice',
      category: 'Navigation',
    },

    // Zoom
    {
      key: '+',
      handler: () => {
        setZoom((prev) => Math.min(5, prev * 1.2));
      },
      description: 'Zoom in',
      category: 'View',
    },
    {
      key: '=',
      handler: () => {
        setZoom((prev) => Math.min(5, prev * 1.2));
      },
      description: 'Zoom in (alternate)',
      category: 'View',
    },
    {
      key: '-',
      handler: () => {
        setZoom((prev) => Math.max(0.1, prev * 0.8));
      },
      description: 'Zoom out',
      category: 'View',
    },
    {
      key: 'r',
      handler: resetView,
      description: 'Reset view',
      category: 'View',
    },
    {
      key: 'h',
      ctrl: true,
      handler: () => {
        setShowHUOverlay((prev) => !prev);
      },
      description: 'Toggle HU value overlay',
      category: 'View',
    },
    {
      key: 'x',
      handler: () => {
        setShowCrosshair((prev) => !prev);
      },
      description: 'Toggle crosshair',
      category: 'View',
    },

    // Actions
    {
      key: 'z',
      ctrl: true,
      handler: () => {
        if (drawing.canUndo) {
          drawing.undo();
          toast({
            title: 'Undo',
            description: 'Last action has been undone',
          });
        }
      },
      description: 'Undo last action',
      category: 'Actions',
    },
    {
      key: 'y',
      ctrl: true,
      handler: () => {
        if (drawing.canRedo) {
          drawing.redo();
          toast({
            title: 'Redo',
            description: 'Last action has been redone',
          });
        }
      },
      description: 'Redo last action',
      category: 'Actions',
    },
    {
      key: 'z',
      ctrl: true,
      shift: true,
      handler: () => {
        if (drawing.canRedo) {
          drawing.redo();
          toast({
            title: 'Redo',
            description: 'Last action has been redone',
          });
        }
      },
      description: 'Redo last action (alternate)',
      category: 'Actions',
    },
    {
      key: 's',
      ctrl: true,
      handler: () => {
        handleDownload();
      },
      description: 'Export structures',
      category: 'Actions',
    },
    {
      key: 'escape',
      handler: () => {
        if (drawing.currentTool === 'polygon' && drawing.isDrawing) {
          drawing.cancelDrawing();
          toast({
            title: 'Drawing cancelled',
            description: 'Polygon drawing has been cancelled',
          });
        }
      },
      description: 'Cancel current drawing',
      category: 'Actions',
    },
    {
      key: 'i',
      handler: interpolateSlices,
      description: 'Interpolate contours',
      category: 'Actions',
    },
    {
      key: 'm',
      handler: () => {
        const newMprMode = !mprMode;
        setMprMode(newMprMode);
        toast({
          title: newMprMode ? "MPR View" : "Single View",
          description: newMprMode
            ? "Switched to multi-planar reconstruction view"
            : "Switched to standard single-plane view",
        });
      },
      description: 'Toggle MPR 3D view',
      category: 'View',
    },

    // Quick structure selection (1-9)
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => ({
      key: num.toString(),
      handler: () => {
        const structures = drawing.structures;
        if (structures[num - 1]) {
          drawing.setActiveStructure(structures[num - 1].id);
          if (drawing.currentTool === 'select') {
            drawing.setTool('brush');
          }
        }
      },
      description: `Select structure ${num}`,
      category: 'Quick Selection',
    })),
  ], [
    drawing,
    handleViewerToolChange,
    handleDrawingToolChange,
    handleDownload,
    resetView,
    interpolateSlices,
    ctImages.length,
    toast,
    mprMode,
  ]);

  // Use keyboard shortcuts
  useKeyboardShortcuts(keyboardShortcuts, { enabled: true });

  return (
    <div className="h-screen bg-background flex flex-col animate-fade-in overflow-hidden">
      {/* Compact Header */}
      <div className="bg-card border-b border-border px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} title="Back to file selection">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-foreground">DicomEdit</h2>
              <p className="text-muted-foreground text-xs">
                {ctImages.length} slices {rtStruct ? "• RT Structure loaded" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={mprMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMprMode(!mprMode);
                toast({
                  title: mprMode ? "Single View" : "MPR View",
                  description: mprMode
                    ? "Switched to standard single-plane view"
                    : "Switched to multi-planar reconstruction view",
                });
              }}
              title="Toggle MPR 3D view (M)"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowShortcutsHelp(true)}
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                drawing.undo();
                toast({
                  title: 'Undo',
                  description: 'Last action has been undone',
                });
              }}
              disabled={!drawing.canUndo}
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                drawing.redo();
                toast({
                  title: 'Redo',
                  description: 'Last action has been redone',
                });
              }}
              disabled={!drawing.canRedo}
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={resetView} title="Reset view (R)">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="medical" size="sm" onClick={handleDownload} title="Export structures (Ctrl+S)">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {mprMode ? (
        // MPR 3D View
        <MPRViewer
          ctImages={ctImages}
          windowLevel={windowLevel[0]}
          windowWidth={windowWidth[0]}
          onWindowLevelChange={(level) => setWindowLevel([level])}
          onWindowWidthChange={(width) => setWindowWidth([width])}
        />
      ) : (
        // Standard Single-Plane View
      <div className="flex-1 flex overflow-hidden">
        {/* Left Tool Sidebar */}
        <div className="w-16 bg-card border-r border-border flex flex-col p-2 gap-2">
          <div className="text-xs text-muted-foreground text-center mb-2 font-medium">Tools</div>

          {/* Viewer Tools */}
          <Button
            variant={viewerTool === "select" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewerToolChange("select")}
            className="w-full h-12 flex flex-col items-center gap-1 p-1"
            title="Select tool (S) - Default navigation"
          >
            <MousePointer className="w-5 h-5" />
            <span className="text-xs">Select</span>
          </Button>
          <Button
            variant={viewerTool === "pan" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewerToolChange("pan")}
            className="w-full h-12 flex flex-col items-center gap-1 p-1"
            title="Pan tool (P) - Drag to move image"
          >
            <Move className="w-5 h-5" />
            <span className="text-xs">Pan</span>
          </Button>
          <Button
            variant={viewerTool === "windowing" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewerToolChange("windowing")}
            className="w-full h-12 flex flex-col items-center gap-1 p-1"
            title="Window/Level tool (W) - Drag to adjust brightness/contrast"
          >
            <Settings className="w-5 h-5" />
            <span className="text-xs">W/L</span>
          </Button>

          <Separator className="my-2" />

          {/* Drawing Tools */}
          <Button
            variant={drawing.currentTool === "brush" ? "medical" : "ghost"}
            size="sm"
            onClick={() => handleDrawingToolChange("brush")}
            className="w-full h-12 flex flex-col items-center gap-1 p-1"
            title="Brush tool (B) - Draw contours"
          >
            <Paintbrush className="w-5 h-5" />
            <span className="text-xs">Brush</span>
          </Button>
          <Button
            variant={drawing.currentTool === "polygon" ? "medical" : "ghost"}
            size="sm"
            onClick={() => handleDrawingToolChange("polygon")}
            className="w-full h-12 flex flex-col items-center gap-1 p-1"
            title="Polygon tool - Click to add points"
          >
            <Scissors className="w-5 h-5" />
            <span className="text-xs">Polygon</span>
          </Button>
          <Button
            variant={drawing.currentTool === "eraser" ? "destructive" : "ghost"}
            size="sm"
            onClick={() => handleDrawingToolChange("eraser")}
            className="w-full h-12 flex flex-col items-center gap-1 p-1"
            title="Eraser tool (E) - Remove contours"
          >
            <Eraser className="w-5 h-5" />
            <span className="text-xs">Erase</span>
          </Button>
        </div>

        {/* Main Viewer Canvas */}
        <div className="flex-1 bg-black flex flex-col">
          <div className="flex-1 flex items-center justify-center p-2">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="shadow-elevation block"
                style={{
                  imageRendering: "pixelated",
                  width: "800px",
                  height: "800px",
                  maxWidth: "100%",
                  maxHeight: "100%",
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
                onWheel={handleWheel}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseLeave}
                onContextMenu={(e) => e.preventDefault()}
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

        {/* Right Sidebar - Controls & Structures */}
        <div className="w-72 bg-card border-l border-border flex flex-col overflow-hidden">
          {/* Image Controls */}
          <div className="p-4 border-b border-border space-y-3">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Image Controls
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-muted-foreground">Window Level</label>
                  <span className="text-xs text-muted-foreground font-mono">{windowLevel[0]}</span>
                </div>
                <Slider
                  value={windowLevel}
                  onValueChange={setWindowLevel}
                  min={-1000}
                  max={3000}
                  step={10}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-muted-foreground">Window Width</label>
                  <span className="text-xs text-muted-foreground font-mono">{windowWidth[0]}</span>
                </div>
                <Slider
                  value={windowWidth}
                  onValueChange={setWindowWidth}
                  min={1}
                  max={4000}
                  step={10}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-muted-foreground">Zoom</label>
                  <span className="text-xs text-muted-foreground font-mono">{(zoom * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[zoom]}
                  onValueChange={([value]) => setZoom(value)}
                  min={0.1}
                  max={5}
                  step={0.1}
                />
              </div>
            </div>
          </div>

          {/* Drawing Settings */}
          <div className="p-4 border-b border-border space-y-3">
            <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Paintbrush className="w-4 h-4 text-primary" />
              Drawing Settings
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-muted-foreground">Brush Size</label>
                  <span className="text-xs text-muted-foreground font-mono">{drawing.brushSize}px</span>
                </div>
                <Slider
                  value={[drawing.brushSize]}
                  onValueChange={([value]) => drawing.setBrushSize(value)}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-muted-foreground">Eraser Size</label>
                  <span className="text-xs text-muted-foreground font-mono">{drawing.eraserSize}px</span>
                </div>
                <Slider
                  value={[drawing.eraserSize]}
                  onValueChange={([value]) => drawing.setEraserSize(value)}
                  min={5}
                  max={50}
                  step={5}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => drawing.clearSlice(currentSlice)}
                className="w-full"
              >
                Clear Current Slice
              </Button>
            </div>
          </div>

          {/* Structures List */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Structures ({drawing.structures.length})
                </h3>
                <Button variant="medical" size="sm" onClick={addNewStructure} title="Create new structure">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 p-3 space-y-2 overflow-y-auto">
              {[...rtStructures, ...drawing.structures.filter(s => !s.id.startsWith('rt_'))].map((structure) => {
                const isActive = drawing.activeStructureId === structure.id;
                return (
                  <Card
                    key={structure.id}
                    className={`p-2 cursor-pointer transition-all ${
                      isActive ? "border-primary shadow-glow bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => startEditingRTStructure(structure.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className="w-3 h-3 rounded border flex-shrink-0"
                          style={{ backgroundColor: structure.color }}
                        />
                        <span className="text-xs font-medium text-foreground truncate">
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
                        className="flex-shrink-0 h-6 w-6 p-0"
                      >
                        {structure.visible ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </Card>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={interpolateSlices}
                className="w-full mt-4"
                title="Interpolate contours between slices (I)"
              >
                <Copy className="w-3 h-3 mr-2" />
                Interpolate
              </Button>
            </div>

            <div className="p-3 border-t border-border bg-muted/30">
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div className="flex justify-between">
                  <span>Visible:</span>
                  <span className="font-mono">{drawing.structures.filter(s => s.visible).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Contours here:</span>
                  <span className="font-mono">{drawing.getContoursForSlice(currentSlice).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        open={showShortcutsHelp}
        onOpenChange={setShowShortcutsHelp}
        shortcuts={keyboardShortcuts}
      />
    </div>
  );
};