import { useState, useCallback } from 'react';
import { Point2D, Contour, Structure3D, closeContour, smoothContour } from '@/lib/contour-utils';

export type DrawingTool = 'select' | 'brush' | 'eraser' | 'polygon' | 'interpolate';

export interface DrawingState {
  isDrawing: boolean;
  currentTool: DrawingTool;
  currentPath: Point2D[];
  structures: Structure3D[];
  activeStructureId: string | null;
  brushSize: number;
  eraserSize: number;
}

export function useDrawing() {
  const [state, setState] = useState<DrawingState>({
    isDrawing: false,
    currentTool: 'select',
    currentPath: [],
    structures: [],
    activeStructureId: null,
    brushSize: 3,
    eraserSize: 10
  });

  const setTool = useCallback((tool: DrawingTool) => {
    setState(prev => ({ ...prev, currentTool: tool }));
  }, []);

  const setBrushSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, brushSize: size }));
  }, []);

  const setEraserSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, eraserSize: size }));
  }, []);

  const setActiveStructure = useCallback((structureId: string | null) => {
    setState(prev => ({ ...prev, activeStructureId: structureId }));
  }, []);

  const startDrawing = useCallback((point: Point2D) => {
    setState(prev => ({
      ...prev,
      isDrawing: true,
      currentPath: [point]
    }));
  }, []);

  const addPoint = useCallback((point: Point2D) => {
    setState(prev => ({
      ...prev,
      currentPath: [...prev.currentPath, point]
    }));
  }, []);

  const finishDrawing = useCallback((sliceIndex: number) => {
    setState(prev => {
      if (!prev.isDrawing || prev.currentPath.length < 2 || !prev.activeStructureId) {
        return { ...prev, isDrawing: false, currentPath: [] };
      }

      let finalPath = prev.currentPath;
      
      // Auto-close contours for brush and polygon tools
      if (prev.currentTool === 'brush' || prev.currentTool === 'polygon') {
        finalPath = closeContour(finalPath);
        finalPath = smoothContour(finalPath, 1); // Light smoothing
      }

      const newContour: Contour = {
        id: `contour_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        points: finalPath,
        sliceIndex,
        structureId: prev.activeStructureId,
        isClosed: prev.currentTool === 'brush' || prev.currentTool === 'polygon',
        color: prev.structures.find(s => s.id === prev.activeStructureId)?.color || '#ff0000'
      };

      const updatedStructures = prev.structures.map(structure => {
        if (structure.id === prev.activeStructureId) {
          return {
            ...structure,
            contours: [...structure.contours, newContour]
          };
        }
        return structure;
      });

      return {
        ...prev,
        isDrawing: false,
        currentPath: [],
        structures: updatedStructures
      };
    });
  }, []);

  const cancelDrawing = useCallback(() => {
    setState(prev => ({
      ...prev,
      isDrawing: false,
      currentPath: []
    }));
  }, []);

  const eraseAt = useCallback((point: Point2D, sliceIndex: number) => {
    setState(prev => {
      const updatedStructures = prev.structures.map(structure => ({
        ...structure,
        contours: structure.contours.filter(contour => {
          if (contour.sliceIndex !== sliceIndex) return true;
          
          // Check if any point in the contour is within eraser radius
          return !contour.points.some(p => {
            const distance = Math.sqrt(
              Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)
            );
            return distance <= prev.eraserSize;
          });
        })
      }));

      return { ...prev, structures: updatedStructures };
    });
  }, []);

  const addStructure = useCallback((structure: Omit<Structure3D, 'contours'>) => {
    setState(prev => ({
      ...prev,
      structures: [...prev.structures, { ...structure, contours: [] }]
    }));
  }, []);

  const removeStructure = useCallback((structureId: string) => {
    setState(prev => ({
      ...prev,
      structures: prev.structures.filter(s => s.id !== structureId),
      activeStructureId: prev.activeStructureId === structureId ? null : prev.activeStructureId
    }));
  }, []);

  const toggleStructureVisibility = useCallback((structureId: string) => {
    setState(prev => ({
      ...prev,
      structures: prev.structures.map(s =>
        s.id === structureId ? { ...s, visible: !s.visible } : s
      )
    }));
  }, []);

  const getContoursForSlice = useCallback((sliceIndex: number) => {
    return state.structures.flatMap(structure =>
      structure.visible 
        ? structure.contours.filter(contour => contour.sliceIndex === sliceIndex)
        : []
    );
  }, [state.structures]);

  const clearSlice = useCallback((sliceIndex: number) => {
    setState(prev => ({
      ...prev,
      structures: prev.structures.map(structure => ({
        ...structure,
        contours: structure.contours.filter(contour => contour.sliceIndex !== sliceIndex)
      }))
    }));
  }, []);

  return {
    ...state,
    setTool,
    setBrushSize,
    setEraserSize,
    setActiveStructure,
    startDrawing,
    addPoint,
    finishDrawing,
    cancelDrawing,
    eraseAt,
    addStructure,
    removeStructure,
    toggleStructureVisibility,
    getContoursForSlice,
    clearSlice
  };
}