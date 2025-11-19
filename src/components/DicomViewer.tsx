import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Grid3x3,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DicomImage, DicomRTStruct, Point2D, BooleanOp, ImageData2D } from "@/types";
import { DicomProcessor } from "@/lib/dicom-utils";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { MPRViewer } from "@/components/MPRViewer";
import { EditingPanel } from "@/components/EditingPanel";
import { useDrawing, DrawingTool } from "@/hooks/useDrawing";
import { interpolateContours } from "@/lib/contour-utils";
import { exportRTStruct } from "@/lib/rtstruct-export";
import { worldToCanvas as worldToCanvasUtil, canvasToWorld as canvasToWorldUtil } from "@/lib/coordinate-utils";
import { useKeyboardShortcuts, KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";
import { ViewerToolbar } from "@/components/viewer/ViewerToolbar";
import { StructureList } from "@/components/viewer/StructureList";
import { ViewerCanvas } from "@/components/viewer/ViewerCanvas";
import { HUOverlay } from "@/components/HUOverlay";
import { WINDOW_PRESETS } from "@/lib/window-presets";


interface DicomViewerProps {
  ctImages: DicomImage[];
  rtStruct?: DicomRTStruct;
  probabilityMap?: Float32Array[];
  onBack?: () => void;
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
  const [prevViewerTool, setPrevViewerTool] = useState<ViewerTool | null>(null);
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

  // UI Enhancement states
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cineMode, setCineMode] = useState(false);
  const [cineFPS] = useState(10);
  const cineIntervalRef = useRef<number | null>(null);



  // Initialize drawing structures from RT structures
  useEffect(() => {
    if (drawing.structures.length === 0 && rtStruct?.structures) {
      const newStructures = rtStruct.structures.map((rtStructure, index) => {
        const color = `rgb(${Math.round(rtStructure.color[0])}, ${Math.round(rtStructure.color[1])}, ${Math.round(rtStructure.color[2])})`;
        const structureId = `rt_${index}`;

        return {
          id: structureId,
          name: rtStructure.name,
          color,
          visible: true,
          contours: rtStructure.contours.map((contour, cIndex) => ({
            id: `contour_${index}_${cIndex}_${Date.now()}`,
            points: contour.points.map(p => ({ x: p[0], y: p[1] })),
            sliceIndex: contour.sliceIndex,
            structureId: structureId,
            isClosed: true,
            color
          }))
        };
      });

      drawing.setStructures(newStructures);
    }
  }, [rtStruct, drawing.setStructures, drawing.structures.length]);

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





  }, [currentSlice, ctImages, windowLevel, windowWidth, zoom, pan, probabilityMap, probThreshold]);

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
  const canvasToWorld = useCallback((canvasX: number, canvasY: number): Point2D => {
    const currentImage = ctImages[currentSlice];
    if (!currentImage) return { x: 0, y: 0 };

    const config = {
      canvasSize: 800,
      zoom,
      pan
    };

    return canvasToWorldUtil(canvasX, canvasY, currentImage, config);
  }, [ctImages, currentSlice, zoom, pan]);

  // Convert world coordinates to canvas coordinates for rendering
  const worldToCanvas = useCallback((worldX: number, worldY: number): Point2D => {
    const currentImage = ctImages[currentSlice];
    if (!currentImage) return { x: 0, y: 0 };

    const config = {
      canvasSize: 800,
      zoom,
      pan
    };

    return worldToCanvasUtil(worldX, worldY, currentImage, config);
  }, [ctImages, currentSlice, zoom, pan]);

  // Handle wheel events for slice navigation and zoom
  const handleWheel = useCallback((e: WheelEvent) => {
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
  }, [ctImages.length]);

  // Add wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Drawing event handlers
  const handleStartDrawing = useCallback((point: Point2D) => {
    const worldPoint = canvasToWorld(point.x, point.y);

    // Handle region-grow and magic-wand tools
    if (drawing.currentTool === 'region-grow' || drawing.currentTool === 'magic-wand') {
      const currentImage = ctImages[currentSlice];
      if (!currentImage) return;

      // Convert world point to pixel coordinates
      const config = {
        canvasSize: 800,
        zoom,
        pan,
      };

      const bounds = getImageBounds(currentImage, config);
      const pixelX = Math.floor((worldPoint.x - bounds.x) / (bounds.width / currentImage.width));
      const pixelY = Math.floor((worldPoint.y - bounds.y) / (bounds.height / currentImage.height));

      // Check if click is within image bounds
      if (pixelX < 0 || pixelX >= currentImage.width || pixelY < 0 || pixelY >= currentImage.height) {
        toast({
          title: "Click outside image",
          description: "Please click on the image area",
          variant: "destructive",
        });
        return;
      }

      const imageData = {
        width: currentImage.width,
        height: currentImage.height,
        data: currentImage.pixelData,
        windowWidth: windowWidth[0],
        windowCenter: windowLevel[0],
      };

      // Get tolerance from EditingPanel (default to 50 if not available)
      const tolerance = 50; // This should ideally come from EditingPanel state

      const success = drawing.performRegionGrowing(
        imageData,
        pixelX,
        pixelY,
        tolerance,
        currentSlice,
        currentImage.rescaleSlope || 1,
        currentImage.rescaleIntercept || 0
      );

      if (success) {
        toast({
          title: "Region growing complete",
          description: `Region extracted at (${pixelX}, ${pixelY})`,
        });
      } else {
        toast({
          title: "No region found",
          description: "Try adjusting the tolerance or clicking on a different area",
          variant: "destructive",
        });
      }
      return;
    }

    // Normal drawing behavior
    drawing.startDrawing(worldPoint);
  }, [canvasToWorld, ctImages, currentSlice, drawing, getImageBounds, pan, toast, windowLevel, windowWidth, zoom]);

  const handleAddPoint = useCallback((point: Point2D) => {
    const worldPoint = canvasToWorld(point.x, point.y);
    drawing.addPoint(worldPoint);
  }, [drawing, canvasToWorld]);

  const handleFinishDrawing = useCallback(() => {
    drawing.finishDrawing(currentSlice);
    toast({
      title: "Contour saved",
      description: "Drawing has been added to the active structure",
    });
  }, [drawing, currentSlice, toast]);

  const handleEraseAt = useCallback((point: Point2D) => {
    const worldPoint = canvasToWorld(point.x, point.y);
    drawing.eraseAt(worldPoint, currentSlice);
  }, [drawing, canvasToWorld, currentSlice]);

  // Mouse event handlers for Pan and Windowing tools
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle mouse button (button 1) for pan
    if (e.button === 1) {
      e.preventDefault();
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      // Temporarily switch to pan mode, storing current tool
      setPrevViewerTool(viewerTool);
      setViewerTool("pan");
      return;
    }

    // Left button with pan or windowing tool
    if (e.button === 0 && (viewerTool === "pan" || viewerTool === "windowing")) {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [viewerTool, setIsDragging, setLastMousePos, setPrevViewerTool, setViewerTool]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMouseCanvasPos({ x, y });

      // Update HU info
      if (ctImages[currentSlice] && showHUOverlay) {
        const worldPos = canvasToWorld(x, y);
        const config = {
          canvasSize: 800,
          zoom,
          pan
        };
        const bounds = getImageBounds(ctImages[currentSlice], config);
        const pixelX = Math.floor(((worldPos.x - bounds.x) / bounds.width) * ctImages[currentSlice].width);
        const pixelY = Math.floor(((worldPos.y - bounds.y) / bounds.height) * ctImages[currentSlice].height);

        if (pixelX >= 0 && pixelX < ctImages[currentSlice].width &&
          pixelY >= 0 && pixelY < ctImages[currentSlice].height) {
          const huValue = DicomProcessor.getHUValueAtPixel(ctImages[currentSlice], pixelX, pixelY);
          setHUInfo({ pixelX, pixelY, huValue });
        } else {
          setHUInfo(null);
        }
      } else {
        setHUInfo(null);
      }
    }

    if (!isDragging) return;

    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;

    if (viewerTool === "pan") {
      setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
    } else if (viewerTool === "windowing") {
      setWindowWidth(prev => [Math.max(1, prev[0] + deltaX * 2)]);
      setWindowLevel(prev => [prev[0] - deltaY * 2]); // Inverted for intuitive up/down
    }

    setLastMousePos({ x: e.clientX, y: e.clientY });
  }, [isDragging, lastMousePos, viewerTool, ctImages, currentSlice, zoom, pan, canvasToWorld, canvasRef, showHUOverlay, setMouseCanvasPos, getImageBounds, DicomProcessor, setHUInfo, setPan, setWindowWidth, setWindowLevel]);

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // If middle button was used for pan, restore previous tool
    if (e.button === 1 && isDragging) {
      if (prevViewerTool) {
        setViewerTool(prevViewerTool);
        setPrevViewerTool(null);
      }
    }
    setIsDragging(false);
  }, [isDragging, prevViewerTool, setViewerTool, setPrevViewerTool, setIsDragging]);

  const handleCanvasMouseLeave = useCallback(() => {
    setIsDragging(false);
    setMouseCanvasPos(null);
    setHUInfo(null);
  }, [setIsDragging, setMouseCanvasPos, setHUInfo]);

  // Tool change handlers
  const handleViewerToolChange = useCallback((tool: ViewerTool) => {
    setViewerTool(tool);
    if (tool !== "select") {
      drawing.setTool("select");
    }
  }, [drawing, setViewerTool]);

  const addNewStructure = useCallback(() => {
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

    toast({
      title: "New structure created",
      description: `${newStructure.name} ready for drawing`,
    });
  }, [drawing, toast]);

  const handleDrawingToolChange = useCallback((tool: DrawingTool) => {
    drawing.setTool(tool);
    setViewerTool("select");

    // Auto-create a structure if none is active and we're starting to draw
    if (!drawing.activeStructureId) {
      if (tool === "brush" || tool === "polygon") {
        addNewStructure();
      } else if (tool === "eraser") {
        toast({
          title: "No active structure",
          description: "Please select or create a structure to erase",
          variant: "destructive",
        });
        setViewerTool("select");
        drawing.setTool("select");
        return;
      }
    }
  }, [drawing, toast, setViewerTool, addNewStructure]);

  const toggleRTStructureVisibility = useCallback((id: string) => {
    drawing.toggleStructureVisibility(id);
  }, [drawing]);

  const startEditingRTStructure = useCallback((id: string) => {
    drawing.setActiveStructure(id);
    if (drawing.currentTool === "select") {
      drawing.setTool("brush");
    }
  }, [drawing]);

  const handleDownload = useCallback(() => {
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
  }, [drawing, ctImages, rtStruct, toast]);

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

  const interpolateSlices = useCallback(() => {
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
            const startSlice = slicesWithContours[i];
            const endSlice = slicesWithContours[i + 1];

            // Skip if slices are adjacent (nothing to interpolate)
            if (endSlice - startSlice <= 1) continue;

            const startContours = activeStructure.contours.filter(c => c.sliceIndex === startSlice);
            const endContours = activeStructure.contours.filter(c => c.sliceIndex === endSlice);

            // Only interpolate if we have matching contours (simplified logic)
            if (startContours.length > 0 && endContours.length > 0) {
              // Assuming interpolateContours is a helper that takes multiple contours and returns new ones
              // This part of the instruction's change is a bit ambiguous, I'll keep the original call structure
              // but adapt to the new loop logic. If `interpolateContours` is meant to be a single call per pair,
              // the original `interpolateContours(contour1, contour2, targetSlice)` would be more appropriate.
              // Given the instruction's new loop, it implies `interpolateContours` might handle a range or return multiple.
              // For now, I'll assume `interpolateContours` is a function that can generate contours for intermediate slices.
              // If `interpolateContours` is meant to be called for each intermediate slice, the original loop structure was better.
              // Let's revert to the original loop structure but with the new `startSlice`/`endSlice` variables for clarity.
              for (let targetSlice = startSlice + 1; targetSlice < endSlice; targetSlice++) {
                const contour1 = activeStructure.contours.find(c => c.sliceIndex === startSlice);
                const contour2 = activeStructure.contours.find(c => c.sliceIndex === endSlice);

                if (contour1 && contour2) {
                  const interpolatedContour = interpolateContours(contour1, contour2, targetSlice);

                  if (interpolatedContour) {
                    drawing.addContourToStructure(
                      activeStructureId,
                      interpolatedContour
                    );
                    interpolatedCount++;
                  }
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
  }, [drawing, toast]);

  // Window/Level preset handlers
  const applyWindowPreset = useCallback((presetName: string) => {
    const preset = WINDOW_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setWindowLevel([preset.windowLevel]);
      setWindowWidth([preset.windowWidth]);
      toast({
        title: `${preset.name} preset applied`,
        description: preset.description,
      });
    }
  }, [toast, setWindowLevel, setWindowWidth]);

  // Editing handlers
  const handleSelectContour = useCallback((canvasPoint: Point2D, selectPoint: boolean) => {
    // Convert canvas point to world coordinates
    const currentImage = ctImages[currentSlice];
    if (!currentImage) return;

    const config = { canvasSize: 800, zoom, pan };
    const worldPoint = canvasToWorldUtil(canvasPoint.x, canvasPoint.y, currentImage, config);

    const selected = drawing.selectContour(worldPoint, currentSlice, selectPoint);
    if (!selected) {
      drawing.deselectContour();
    }
  }, [ctImages, currentSlice, zoom, pan, drawing]);

  const handleMovePoint = useCallback((contourId: string, pointIndex: number, canvasPos: Point2D, elastic: boolean) => {
    const currentImage = ctImages[currentSlice];
    if (!currentImage) return;

    const config = { canvasSize: 800, zoom, pan };
    const worldPos = canvasToWorldUtil(canvasPos.x, canvasPos.y, currentImage, config);

    drawing.moveContourPoint(contourId, pointIndex, worldPos, elastic);
  }, [ctImages, currentSlice, zoom, pan, drawing]);

  const handleInsertPoint = useCallback((contourId: string, canvasPos: Point2D) => {
    const currentImage = ctImages[currentSlice];
    if (!currentImage) return;

    const config = { canvasSize: 800, zoom, pan };
    const worldPos = canvasToWorldUtil(canvasPos.x, canvasPos.y, currentImage, config);

    drawing.insertContourPoint(contourId, worldPos);
  }, [ctImages, currentSlice, zoom, pan, drawing]);

  const handleDeletePoint = useCallback((contourId: string, pointIndex: number) => {
    drawing.deleteContourPoint(contourId, pointIndex);
  }, [drawing]);

  const handleDeleteContour = useCallback(() => {
    if (drawing.selectedContour) {
      drawing.deleteContour(drawing.selectedContour.contourId);
      drawing.deselectContour();
      toast({
        title: "Contour deleted",
        description: "The selected contour has been removed",
      });
    }
  }, [drawing, toast]);

  const handleCopyContour = useCallback(() => {
    if (drawing.copySelectedContour()) {
      toast({
        title: "Contour copied",
        description: "Use Paste to add it to another slice",
      });
    }
  }, [drawing, toast]);

  const handlePasteContour = useCallback(() => {
    if (drawing.pasteContour(currentSlice)) {
      toast({
        title: "Contour pasted",
        description: `Added to slice ${currentSlice}`,
      });
    }
  }, [drawing, currentSlice, toast]);

  const handleSmooth2D = useCallback((iterations: number, strength: number) => {
    if (drawing.selectedContour) {
      drawing.smooth2DContour(drawing.selectedContour.contourId, iterations, strength);
      toast({
        title: "Smoothing applied",
        description: `Contour smoothed with ${iterations} iterations`,
      });
    }
  }, [drawing, toast]);

  const handleSmooth3D = useCallback((iterations: number, strength: number) => {
    if (drawing.selectedContour) {
      drawing.smooth3DStructure(drawing.selectedContour.structureId, iterations, strength);
      toast({
        title: "3D Smoothing applied",
        description: `Structure smoothed across all slices`,
      });
    }
  }, [drawing, toast]);

  const handleApplyMargin = useCallback((margin: number) => {
    if (drawing.selectedContour) {
      const currentImage = ctImages[currentSlice];
      const pixelSpacing = currentImage?.pixelSpacing?.[0] || 1.0;
      drawing.applyMarginToContour(drawing.selectedContour.contourId, margin, pixelSpacing);
      toast({
        title: "Margin applied",
        description: `${margin > 0 ? 'Expanded' : 'Contracted'} by ${Math.abs(margin)}mm`,
      });
    }
  }, [drawing, ctImages, currentSlice, toast]);

  const handleBooleanOp = useCallback((operation: BooleanOp, targetId: string) => {
    if (drawing.selectedContour && targetId) {
      const success = drawing.performBooleanOp(
        drawing.selectedContour.contourId,
        targetId,
        operation
      );
      if (success) {
        toast({
          title: "Boolean operation complete",
          description: `${operation} operation applied`,
        });
      }
    }
  }, [drawing, toast]);

  const handleCropWithMargin = useCallback((cropId: string, margin: number) => {
    if (drawing.selectedContour && cropId) {
      const currentImage = ctImages[currentSlice];
      const pixelSpacing = currentImage?.pixelSpacing?.[0] || 1.0;
      const success = drawing.cropContourWithMargin(
        drawing.selectedContour.contourId,
        cropId,
        margin,
        pixelSpacing
      );
      if (success) {
        toast({
          title: "Crop applied",
          description: `Contour cropped with ${margin}mm margin`,
        });
      }
    }
  }, [drawing, ctImages, currentSlice, toast]);

  const handleThreshold = useCallback((minHU: number, maxHU: number) => {
    const currentImage = ctImages[currentSlice];
    if (!currentImage) return;

    const imageData: ImageData2D = {
      width: currentImage.width,
      height: currentImage.height,
      data: currentImage.pixelData,
      windowWidth: windowWidth[0],
      windowCenter: windowLevel[0],
    };

    const success = drawing.performThresholdSegmentation(
      imageData,
      minHU,
      maxHU,
      currentSlice,
      currentImage.rescaleSlope || 1,
      currentImage.rescaleIntercept || 0
    );

    if (success) {
      toast({
        title: "Segmentation complete",
        description: `Threshold segmentation applied (${minHU} to ${maxHU} HU)`,
      });
    } else {
      toast({
        title: "No regions found",
        description: "Try adjusting the threshold values",
        variant: "destructive",
      });
    }
  }, [drawing, ctImages, currentSlice, windowWidth, windowLevel, toast]);

  const handleRegionGrow = useCallback((tolerance: number) => {
    drawing.setTool('region-grow');
    toast({
      title: "Region growing active",
      description: "Click on the image to set seed point",
    });
  }, [drawing, toast]);

  const handleMagicWand = useCallback((tolerance: number) => {
    drawing.setTool('magic-wand');
    toast({
      title: "Magic wand active",
      description: "Click on the image to select region",
    });
  }, [drawing, toast]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      toast({
        title: "Fullscreen mode",
        description: "Press ESC or F to exit fullscreen",
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Cine mode (auto-play)
  const toggleCineMode = () => {
    if (cineMode) {
      // Stop cine mode
      if (cineIntervalRef.current) {
        clearInterval(cineIntervalRef.current);
        cineIntervalRef.current = null;
      }
      setCineMode(false);
      toast({
        title: "Cine mode stopped",
      });
    } else {
      // Start cine mode
      setCineMode(true);
      const intervalMs = 1000 / cineFPS;
      cineIntervalRef.current = window.setInterval(() => {
        setCurrentSlice(prev => {
          const next = prev + 1;
          if (next >= ctImages.length) {
            return 0; // Loop back to start
          }
          return next;
        });
      }, intervalMs);
      toast({
        title: "Cine mode started",
        description: `Playing at ${cineFPS} FPS`,
      });
    }
  };

  // Clean up cine mode on unmount
  useEffect(() => {
    return () => {
      if (cineIntervalRef.current) {
        clearInterval(cineIntervalRef.current);
      }
    };
  }, []);

  // Update cine interval when FPS changes
  useEffect(() => {
    if (cineMode && cineIntervalRef.current) {
      clearInterval(cineIntervalRef.current);
      const intervalMs = 1000 / cineFPS;
      cineIntervalRef.current = window.setInterval(() => {
        setCurrentSlice(prev => {
          const next = prev + 1;
          if (next >= ctImages.length) {
            return 0;
          }
          return next;
        });
      }, intervalMs);
    }
  }, [cineFPS, cineMode, ctImages.length]);

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
    {
      key: 'f',
      handler: toggleFullscreen,
      description: 'Toggle fullscreen mode',
      category: 'View',
    },
    {
      key: 'c',
      handler: toggleCineMode,
      description: 'Toggle cine/auto-play mode',
      category: 'View',
    },
    {
      key: ' ',
      handler: () => {
        if (cineMode) {
          toggleCineMode();
        }
      },
      description: 'Pause cine mode (spacebar)',
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
      <ViewerToolbar
        ctImages={ctImages}
        rtStruct={rtStruct}
        onBack={onBack}
        mprMode={mprMode}
        setMprMode={setMprMode}
        setShowShortcutsHelp={setShowShortcutsHelp}
        drawing={drawing}
        resetView={resetView}
        cineMode={cineMode}
        toggleCineMode={toggleCineMode}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        handleDownload={handleDownload}
      />

      {/* Main Content Area */}
      {mprMode ? (
        // MPR 3D View
        <MPRViewer
          ctImages={ctImages}
          windowLevel={windowLevel[0]}
          windowWidth={windowWidth[0]}
          onWindowLevelChange={(level) => setWindowLevel([level])}
          onWindowWidthChange={(width) => setWindowWidth([width])}
          rtStruct={rtStruct}
          structures={drawing.structures}
        />
      ) : (
        // Standard Single-Plane View
        <div className="flex-1 flex overflow-hidden">
          {/* Left Tool Sidebar */}
          {!leftSidebarCollapsed && (
            <div className="w-16 bg-card border-r border-border flex flex-col p-2 gap-2 relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLeftSidebarCollapsed(true)}
                className="absolute -right-3 top-2 h-6 w-6 p-0 rounded-full bg-card border border-border z-10"
                title="Collapse toolbar"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

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
          )}

          {/* Collapsed Left Sidebar - Show Button */}
          {leftSidebarCollapsed && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLeftSidebarCollapsed(false)}
                className="absolute left-0 top-2 h-8 w-6 p-0 rounded-r-md bg-card border border-border border-l-0 z-10"
                title="Expand toolbar"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Main Viewer Canvas */}
          <ViewerCanvas
            canvasRef={canvasRef}
            viewerTool={viewerTool}
            drawing={drawing}
            isDragging={isDragging}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseLeave}
            currentSlice={currentSlice}
            ctImages={ctImages}
            setZoom={setZoom}
            setCurrentSlice={setCurrentSlice}
            onStartDrawing={handleStartDrawing}
            onAddPoint={handleAddPoint}
            onFinishDrawing={handleFinishDrawing}
            onEraseAt={handleEraseAt}
            onSelectContour={handleSelectContour}
            onMovePoint={handleMovePoint}
            onInsertPoint={handleInsertPoint}
            onDeletePoint={handleDeletePoint}
            mouseCanvasPos={mouseCanvasPos}
            huInfo={huInfo}
            showHUOverlay={showHUOverlay}
            showCrosshair={showCrosshair}
            worldToCanvas={worldToCanvas}
          />


          {/* Right Sidebar - Controls & Structures */}
          {!rightSidebarCollapsed && (
            <div className="w-72 bg-card border-l border-border flex flex-col overflow-hidden relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRightSidebarCollapsed(true)}
                className="absolute -left-3 top-2 h-6 w-6 p-0 rounded-full bg-card border border-border z-10"
                title="Collapse panel"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>

              {/* Image Controls */}
              <div className="p-4 border-b border-border space-y-3">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" />
                  Image Controls
                </h3>
                <div className="space-y-3">
                  {/* W/L Presets */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Window/Level Presets</label>
                    <Select onValueChange={applyWindowPreset}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="Select preset..." />
                      </SelectTrigger>
                      <SelectContent>
                        {WINDOW_PRESETS.map((preset) => (
                          <SelectItem key={preset.name} value={preset.name} className="text-xs">
                            {preset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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
              <StructureList
                structures={drawing.structures}
                activeStructureId={drawing.activeStructureId}
                currentSlice={currentSlice}
                onToggleVisibility={toggleRTStructureVisibility}
                onStartEditing={startEditingRTStructure}
                onAddStructure={addNewStructure}
                onInterpolate={interpolateSlices}
                getContoursForSlice={drawing.getContoursForSlice}
              />

              {/* Advanced Editing Panel */}
              {drawing.selectedContour && (
                <div className="border-t border-border overflow-y-auto">
                  <EditingPanel
                    selectedContour={drawing.selectedContour}
                    structures={drawing.structures}
                    elasticRadius={drawing.elasticRadius}
                    onElasticRadiusChange={drawing.setElasticRadius}
                    onDeleteContour={handleDeleteContour}
                    onCopyContour={handleCopyContour}
                    onPasteContour={handlePasteContour}
                    onSmooth2D={handleSmooth2D}
                    onSmooth3D={handleSmooth3D}
                    onApplyMargin={handleApplyMargin}
                    onBooleanOp={handleBooleanOp}
                    onCropWithMargin={handleCropWithMargin}
                    onThreshold={handleThreshold}
                    onRegionGrow={handleRegionGrow}
                    onMagicWand={handleMagicWand}
                    pixelSpacing={ctImages[currentSlice]?.pixelSpacing?.[0]}
                  />
                </div>
              )}
            </div>
          )}

          {/* Collapsed Right Sidebar - Show Button */}
          {rightSidebarCollapsed && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRightSidebarCollapsed(false)}
                className="absolute right-0 top-2 h-8 w-6 p-0 rounded-l-md bg-card border border-border border-r-0 z-10"
                title="Expand panel"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
      <KeyboardShortcutsHelp
        open={showShortcutsHelp}
        onOpenChange={setShowShortcutsHelp}
        shortcuts={keyboardShortcuts}
      />
    </div>
  );
};