import { useState, useCallback } from 'react';
import { Point2D, Contour, Structure3D, closeContour, smoothContour } from '@/lib/contour-utils';
import { useHistory } from './useHistory';

export type DrawingTool = 'select' | 'brush' | 'eraser' | 'polygon' | 'interpolate';

export interface DrawingState {
  isDrawing: boolean;
  currentTool: DrawingTool;
  currentPath: Point2D[];
  activeStructureId: string | null;
  brushSize: number;
  eraserSize: number;
}

export function useDrawing() {
  // Non-historical state (UI state that doesn't need undo/redo)
  const [state, setState] = useState<DrawingState>({
    isDrawing: false,
    currentTool: 'select',
    currentPath: [],
    activeStructureId: null,
    brushSize: 3,
    eraserSize: 10
  });

  // Historical state (structures that can be undone/redone)
  const {
    state: structures,
    setState: setStructures,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  } = useHistory<Structure3D[]>([], { maxHistorySize: 50 });

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
    if (!state.isDrawing || state.currentPath.length < 2 || !state.activeStructureId) {
      setState(prev => ({ ...prev, isDrawing: false, currentPath: [] }));
      return;
    }

    let finalPath = state.currentPath;

    // Auto-close contours for brush and polygon tools
    if (state.currentTool === 'brush' || state.currentTool === 'polygon') {
      finalPath = closeContour(finalPath);
      finalPath = smoothContour(finalPath, 1); // Light smoothing
    }

    const newContour: Contour = {
      id: `contour_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      points: finalPath,
      sliceIndex,
      structureId: state.activeStructureId,
      isClosed: state.currentTool === 'brush' || state.currentTool === 'polygon',
      color: structures.find(s => s.id === state.activeStructureId)?.color || '#ff0000'
    };

    // Update structures with history
    setStructures(prevStructures =>
      prevStructures.map(structure => {
        if (structure.id === state.activeStructureId) {
          return {
            ...structure,
            contours: [...structure.contours, newContour]
          };
        }
        return structure;
      })
    );

    // Clear drawing state (without history)
    setState(prev => ({
      ...prev,
      isDrawing: false,
      currentPath: []
    }));
  }, [state.isDrawing, state.currentPath, state.activeStructureId, state.currentTool, structures, setStructures]);

  const cancelDrawing = useCallback(() => {
    setState(prev => ({
      ...prev,
      isDrawing: false,
      currentPath: []
    }));
  }, []);

  const eraseAt = useCallback((point: Point2D, sliceIndex: number) => {
    setStructures(prevStructures =>
      prevStructures.map(structure => ({
        ...structure,
        contours: structure.contours.filter(contour => {
          if (contour.sliceIndex !== sliceIndex) return true;

          // Check if any point in the contour is within eraser radius
          return !contour.points.some(p => {
            const distance = Math.sqrt(
              Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)
            );
            return distance <= state.eraserSize;
          });
        })
      }))
    );
  }, [state.eraserSize, setStructures]);

  const addStructure = useCallback((structure: Omit<Structure3D, 'contours'>) => {
    setStructures(prevStructures => [
      ...prevStructures,
      { ...structure, contours: [] }
    ]);
  }, [setStructures]);

  const removeStructure = useCallback((structureId: string) => {
    setStructures(prevStructures =>
      prevStructures.filter(s => s.id !== structureId)
    );

    // Clear active structure if it was removed (without history)
    setState(prev => ({
      ...prev,
      activeStructureId: prev.activeStructureId === structureId ? null : prev.activeStructureId
    }));
  }, [setStructures]);

  const toggleStructureVisibility = useCallback((structureId: string) => {
    // Visibility toggle doesn't need history (it's more of a UI state)
    setStructures(prevStructures =>
      prevStructures.map(s =>
        s.id === structureId ? { ...s, visible: !s.visible } : s
      ),
      false // Don't record in history
    );
  }, [setStructures]);

  const getContoursForSlice = useCallback((sliceIndex: number) => {
    return structures.flatMap(structure =>
      structure.visible
        ? structure.contours.filter(contour => contour.sliceIndex === sliceIndex)
        : []
    );
  }, [structures]);

  const clearSlice = useCallback((sliceIndex: number) => {
    setStructures(prevStructures =>
      prevStructures.map(structure => ({
        ...structure,
        contours: structure.contours.filter(contour => contour.sliceIndex !== sliceIndex)
      }))
    );
  }, [setStructures]);

  return {
    ...state,
    structures,
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
    clearSlice,
    setStructures,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
}