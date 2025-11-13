import { useRef, useEffect, useCallback, useState } from 'react';
import { Point2D, Contour } from '@/lib/contour-utils';
import { DrawingTool } from '@/hooks/useDrawing';

interface SelectedContour {
  contourId: string;
  structureId: string;
  selectedPointIndex: number | null;
}

interface DrawingCanvasProps {
  width: number;
  height: number;
  contours: Contour[];
  currentPath: Point2D[];
  currentTool: DrawingTool;
  isDrawing: boolean;
  brushSize: number;
  eraserSize: number;
  onStartDrawing: (point: Point2D) => void;
  onAddPoint: (point: Point2D) => void;
  onFinishDrawing: () => void;
  onEraseAt: (point: Point2D) => void;
  onWheel?: (e: React.WheelEvent<HTMLCanvasElement>) => void;
  // Selection and editing props
  selectedContour?: SelectedContour | null;
  onSelectContour?: (point: Point2D, selectPoint: boolean) => void;
  onMovePoint?: (contourId: string, pointIndex: number, newPos: Point2D, elastic: boolean) => void;
  onInsertPoint?: (contourId: string, position: Point2D) => void;
  onDeletePoint?: (contourId: string, pointIndex: number) => void;
  className?: string;
  canvasStyle?: React.CSSProperties;
}

export function DrawingCanvas({
  width,
  height,
  contours,
  currentPath,
  currentTool,
  isDrawing,
  brushSize,
  eraserSize,
  onStartDrawing,
  onAddPoint,
  onFinishDrawing,
  onEraseAt,
  onWheel,
  selectedContour,
  onSelectContour,
  onMovePoint,
  onInsertPoint,
  onDeletePoint,
  className = '',
  canvasStyle = {}
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);
  const [hoverPointIndex, setHoverPointIndex] = useState<number | null>(null);

  // Render contours and current path
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Render saved contours
    contours.forEach(contour => {
      if (contour.points.length < 2) return;

      ctx.strokeStyle = contour.color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (contour.isClosed) {
        ctx.fillStyle = contour.color + '20'; // 20% opacity
        ctx.beginPath();
        ctx.moveTo(contour.points[0].x, contour.points[0].y);
        contour.points.slice(1).forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fill();
      }

      ctx.beginPath();
      ctx.moveTo(contour.points[0].x, contour.points[0].y);
      contour.points.slice(1).forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      
      if (contour.isClosed) {
        ctx.closePath();
      }
      
      ctx.stroke();
    });

    // Render current drawing path
    if (currentPath.length > 1) {
      ctx.strokeStyle = '#00ff00'; // Bright green for current drawing
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      currentPath.slice(1).forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }

    // Show single point if just started drawing
    if (currentPath.length === 1) {
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(currentPath[0].x, currentPath[0].y, brushSize / 2, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Render control points for selected contour
    if (selectedContour && currentTool === 'select') {
      const selectedContourData = contours.find(c => c.id === selectedContour.contourId);
      if (selectedContourData) {
        // Highlight selected contour
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        if (selectedContourData.points.length > 0) {
          ctx.moveTo(selectedContourData.points[0].x, selectedContourData.points[0].y);
          selectedContourData.points.slice(1).forEach(point => {
            ctx.lineTo(point.x, point.y);
          });
          if (selectedContourData.isClosed) {
            ctx.closePath();
          }
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // Draw control points
        selectedContourData.points.forEach((point, index) => {
          const isSelected = selectedContour.selectedPointIndex === index;
          const isHovered = hoverPointIndex === index;
          const isDragging = draggingPointIndex === index;

          // Control point
          ctx.beginPath();
          ctx.arc(point.x, point.y, isDragging ? 8 : isHovered ? 7 : 5, 0, 2 * Math.PI);

          if (isSelected) {
            ctx.fillStyle = '#ff00ff';
          } else if (isHovered) {
            ctx.fillStyle = '#ffff00';
          } else {
            ctx.fillStyle = '#00ffff';
          }
          ctx.fill();

          // Outline
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Point number (for small contours)
          if (selectedContourData.points.length < 50) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(index), point.x, point.y);
          }
        });
      }
    }
  }, [contours, currentPath, width, height, brushSize, selectedContour, currentTool, hoverPointIndex, draggingPointIndex]);

  // Handle pointer events
  const getCanvasPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point2D => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  const findPointAtPosition = useCallback((pos: Point2D, contour: Contour, threshold: number = 10): number | null => {
    for (let i = 0; i < contour.points.length; i++) {
      const p = contour.points[i];
      const dist = Math.sqrt(Math.pow(p.x - pos.x, 2) + Math.pow(p.y - pos.y, 2));
      if (dist <= threshold) {
        return i;
      }
    }
    return null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    const point = getCanvasPoint(e);

    if (currentTool === 'select') {
      // Handle selection mode
      if (selectedContour && onMovePoint) {
        const contour = contours.find(c => c.id === selectedContour.contourId);
        if (contour) {
          // Check if clicking on a control point
          const pointIndex = findPointAtPosition(point, contour, 10);
          if (pointIndex !== null) {
            setDraggingPointIndex(pointIndex);
            isDrawingRef.current = true;
            return;
          }
        }
      }

      // Select contour or point
      if (onSelectContour) {
        const shiftPressed = e.shiftKey;
        onSelectContour(point, shiftPressed);
      }
      return;
    }

    isDrawingRef.current = true;

    if (currentTool === 'eraser') {
      onEraseAt(point);
    } else {
      onStartDrawing(point);
    }
  }, [currentTool, selectedContour, contours, getCanvasPoint, onStartDrawing, onEraseAt, onSelectContour, onMovePoint, findPointAtPosition]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);

    // Handle select tool hover
    if (currentTool === 'select' && selectedContour) {
      const contour = contours.find(c => c.id === selectedContour.contourId);
      if (contour) {
        const hoverIndex = findPointAtPosition(point, contour, 10);
        setHoverPointIndex(hoverIndex);

        // Handle dragging
        if (isDrawingRef.current && draggingPointIndex !== null && onMovePoint) {
          e.preventDefault();
          const elasticMode = e.ctrlKey || e.metaKey;
          onMovePoint(selectedContour.contourId, draggingPointIndex, point, elasticMode);
          return;
        }
      }
      return;
    }

    if (!isDrawingRef.current) return;

    e.preventDefault();

    if (currentTool === 'eraser') {
      onEraseAt(point);
    } else if (isDrawing) {
      onAddPoint(point);
    }
  }, [currentTool, isDrawing, selectedContour, contours, draggingPointIndex, getCanvasPoint, onAddPoint, onEraseAt, onMovePoint, findPointAtPosition]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }

    isDrawingRef.current = false;
    setDraggingPointIndex(null);

    if (currentTool !== 'select' && currentTool !== 'eraser' && isDrawing) {
      onFinishDrawing();
    }
  }, [currentTool, isDrawing, onFinishDrawing]);

  // Handle keyboard shortcuts for selected contour
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!selectedContour) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedContour.selectedPointIndex !== null && onDeletePoint) {
        e.preventDefault();
        onDeletePoint(selectedContour.contourId, selectedContour.selectedPointIndex);
      }
    } else if (e.key === 'Insert' && onInsertPoint) {
      // Insert point (would need mouse position)
      e.preventDefault();
    }
  }, [selectedContour, onDeletePoint, onInsertPoint]);

  // Handle wheel events would be handled by parent component
  // Remove this effect as we'll handle wheel on the main canvas

  // Set cursor based on tool
  const getCursor = (): string => {
    if (currentTool === 'select') {
      if (hoverPointIndex !== null) {
        return 'grab';
      }
      if (draggingPointIndex !== null) {
        return 'grabbing';
      }
      return 'pointer';
    }

    switch (currentTool) {
      case 'brush':
      case 'polygon':
        return 'crosshair';
      case 'eraser':
        return 'crosshair';
      case 'threshold':
      case 'region-grow':
      case 'magic-wand':
        return 'crosshair';
      default:
        return 'default';
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        cursor: getCursor(),
        touchAction: 'none',
        userSelect: 'none',
        pointerEvents: 'auto', // Always enable for selection
        ...canvasStyle
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={onWheel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    />
  );
}