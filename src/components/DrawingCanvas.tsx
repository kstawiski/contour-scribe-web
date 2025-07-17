import { useRef, useEffect, useCallback } from 'react';
import { Point2D, Contour } from '@/lib/contour-utils';
import { DrawingTool } from '@/hooks/useDrawing';

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
  onWheel?: (e: WheelEvent) => void;
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
  onWheel
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

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
  }, [contours, currentPath, width, height, brushSize]);

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

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (currentTool === 'select') return;

    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    const point = getCanvasPoint(e);

    if (currentTool === 'eraser') {
      onEraseAt(point);
    } else {
      onStartDrawing(point);
    }
  }, [currentTool, getCanvasPoint, onStartDrawing, onEraseAt]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || currentTool === 'select') return;

    e.preventDefault();
    const point = getCanvasPoint(e);

    if (currentTool === 'eraser') {
      onEraseAt(point);
    } else if (isDrawing) {
      onAddPoint(point);
    }
  }, [currentTool, isDrawing, getCanvasPoint, onAddPoint, onEraseAt]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }

    isDrawingRef.current = false;

    if (currentTool !== 'select' && currentTool !== 'eraser' && isDrawing) {
      onFinishDrawing();
    }
  }, [currentTool, isDrawing, onFinishDrawing]);

  // Handle wheel events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onWheel) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      onWheel(e);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [onWheel]);

  // Set cursor based on tool
  const getCursor = (): string => {
    switch (currentTool) {
      case 'brush':
      case 'polygon':
        return 'crosshair';
      case 'eraser':
        return 'crosshair';
      case 'select':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        cursor: getCursor(),
        touchAction: 'none',
        userSelect: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}