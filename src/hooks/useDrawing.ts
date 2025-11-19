import { useState, useCallback } from 'react';
import { Structure3D, Contour, Point2D, BooleanOp, ImageData2D } from "@/types";
import { closeContour, smoothContour } from '@/lib/contour-utils';
import { useHistory } from './useHistory';
import * as EditUtils from '@/lib/editing-utils';

export type DrawingTool = 'select' | 'brush' | 'eraser' | 'polygon' | 'interpolate' | 'threshold' | 'region-grow' | 'magic-wand';

export interface SelectedContour {
  contourId: string;
  structureId: string;
  selectedPointIndex: number | null;
}

export interface DrawingState {
  isDrawing: boolean;
  currentTool: DrawingTool;
  currentPath: Point2D[];
  activeStructureId: string | null;
  brushSize: number;
  eraserSize: number;
  selectedContour: SelectedContour | null;
  elasticRadius: number;
}

export function useDrawing() {
  // Non-historical state (UI state that doesn't need undo/redo)
  const [state, setState] = useState<DrawingState>({
    isDrawing: false,
    currentTool: 'select',
    currentPath: [],
    activeStructureId: null,
    brushSize: 3,
    eraserSize: 10,
    selectedContour: null,
    elasticRadius: 50
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

  const addContourToStructure = useCallback(
    (structureId: string, contour: Contour) => {
      setStructures(prevStructures =>
        prevStructures.map(structure =>
          structure.id === structureId
            ? {
              ...structure,
              contours: [...structure.contours, contour],
            }
            : structure
        )
      );
    },
    [setStructures]
  );

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

  // Selection Operations
  const selectContour = useCallback((position: Point2D, sliceIndex: number, selectPoint: boolean = false) => {
    const contoursOnSlice = getContoursForSlice(sliceIndex);

    if (selectPoint) {
      const selection = EditUtils.findClosestPoint(position, contoursOnSlice, 15);
      if (selection) {
        setState(prev => ({
          ...prev,
          selectedContour: {
            contourId: selection.contour.id,
            structureId: selection.contour.structureId,
            selectedPointIndex: selection.pointIndex!
          }
        }));
        return true;
      }
    } else {
      const selection = EditUtils.findClosestContour(position, contoursOnSlice, 15);
      if (selection) {
        setState(prev => ({
          ...prev,
          selectedContour: {
            contourId: selection.contour.id,
            structureId: selection.contour.structureId,
            selectedPointIndex: null
          }
        }));
        return true;
      }
    }

    return false;
  }, [getContoursForSlice]);

  const deselectContour = useCallback(() => {
    setState(prev => ({ ...prev, selectedContour: null }));
  }, []);

  const setElasticRadius = useCallback((radius: number) => {
    setState(prev => ({ ...prev, elasticRadius: radius }));
  }, []);

  // Point Editing Operations
  const moveContourPoint = useCallback((
    contourId: string,
    pointIndex: number,
    newPosition: Point2D,
    elastic: boolean = false
  ) => {
    setStructures(prevStructures =>
      prevStructures.map(structure => ({
        ...structure,
        contours: structure.contours.map(contour => {
          if (contour.id === contourId) {
            if (elastic) {
              return EditUtils.elasticDrag(
                contour,
                pointIndex,
                {
                  x: newPosition.x - contour.points[pointIndex].x,
                  y: newPosition.y - contour.points[pointIndex].y
                },
                state.elasticRadius
              );
            } else {
              return EditUtils.movePoint(contour, pointIndex, newPosition);
            }
          }
          return contour;
        })
      }))
    );
  }, [setStructures, state.elasticRadius]);

  const insertContourPoint = useCallback((contourId: string, position: Point2D) => {
    setStructures(prevStructures =>
      prevStructures.map(structure => ({
        ...structure,
        contours: structure.contours.map(contour =>
          contour.id === contourId
            ? EditUtils.insertPoint(contour, position)
            : contour
        )
      }))
    );
  }, [setStructures]);

  const deleteContourPoint = useCallback((contourId: string, pointIndex: number) => {
    setStructures(prevStructures =>
      prevStructures.map(structure => ({
        ...structure,
        contours: structure.contours.map(contour => {
          if (contour.id === contourId) {
            const result = EditUtils.deletePoint(contour, pointIndex, 3);
            return result || contour;
          }
          return contour;
        })
      }))
    );
  }, [setStructures]);

  const deleteContour = useCallback((contourId: string) => {
    setStructures(prevStructures =>
      prevStructures.map(structure => ({
        ...structure,
        contours: structure.contours.filter(c => c.id !== contourId)
      }))
    );
  }, [setStructures]);

  const smoothContourSection = useCallback((
    contourId: string,
    startIndex: number,
    endIndex: number,
    iterations: number = 2
  ) => {
    setStructures(prevStructures =>
      prevStructures.map(structure => ({
        ...structure,
        contours: structure.contours.map(contour =>
          contour.id === contourId
            ? EditUtils.smoothSection(contour, startIndex, endIndex, iterations)
            : contour
        )
      }))
    );
  }, [setStructures]);

  // Copy/Paste Operations
  const copySelectedContour = useCallback(() => {
    if (!state.selectedContour) return false;

    const contour = structures
      .flatMap(s => s.contours)
      .find(c => c.id === state.selectedContour!.contourId);

    if (contour) {
      EditUtils.copyContour(contour);
      return true;
    }
    return false;
  }, [state.selectedContour, structures]);

  const pasteContour = useCallback((sliceIndex: number) => {
    const pasted = EditUtils.pasteContour(sliceIndex, state.activeStructureId || undefined);
    if (pasted) {
      setStructures(prevStructures =>
        prevStructures.map(structure =>
          structure.id === pasted.structureId
            ? { ...structure, contours: [...structure.contours, pasted] }
            : structure
        )
      );
      return true;
    }
    return false;
  }, [state.activeStructureId, setStructures]);

  // 3D Operations
  const smooth2DContour = useCallback((contourId: string, iterations: number = 3, strength: number = 0.5) => {
    setStructures(prevStructures =>
      prevStructures.map(structure => ({
        ...structure,
        contours: structure.contours.map(contour =>
          contour.id === contourId
            ? EditUtils.smooth2D(contour, iterations, strength)
            : contour
        )
      }))
    );
  }, [setStructures]);

  const smooth3DStructure = useCallback((structureId: string, iterations: number = 2, strength: number = 0.5) => {
    setStructures(prevStructures =>
      prevStructures.map(structure =>
        structure.id === structureId
          ? EditUtils.smooth3D(structure, iterations, strength)
          : structure
      )
    );
  }, [setStructures]);

  // Margin Operations
  const applyMarginToContour = useCallback((
    contourId: string,
    margin: number,
    pixelSpacing: number = 1.0
  ) => {
    setStructures(prevStructures =>
      prevStructures.map(structure => ({
        ...structure,
        contours: structure.contours.map(contour => {
          if (contour.id === contourId) {
            const result = EditUtils.applyMargin(contour, margin, pixelSpacing);
            return result || contour;
          }
          return contour;
        })
      }))
    );
  }, [setStructures]);

  const applyMarginToStructure = useCallback((
    structureId: string,
    margin: number,
    pixelSpacing: number = 1.0
  ) => {
    setStructures(prevStructures =>
      prevStructures.map(structure => {
        if (structure.id === structureId) {
          return {
            ...structure,
            contours: structure.contours.map(contour => {
              const result = EditUtils.applyMargin(contour, margin, pixelSpacing);
              return result || contour;
            }).filter(Boolean)
          };
        }
        return structure;
      })
    );
  }, [setStructures]);

  // Boolean Operations
  const performBooleanOp = useCallback((
    contourId1: string,
    contourId2: string,
    operation: EditUtils.BooleanOp,
    targetStructureId?: string
  ) => {
    const contour1 = structures.flatMap(s => s.contours).find(c => c.id === contourId1);
    const contour2 = structures.flatMap(s => s.contours).find(c => c.id === contourId2);

    if (!contour1 || !contour2) return false;

    const resultContours = EditUtils.booleanOperation(contour1, contour2, operation);

    if (resultContours.length > 0) {
      setStructures(prevStructures =>
        prevStructures.map(structure => {
          if (structure.id === (targetStructureId || contour1.structureId)) {
            return {
              ...structure,
              contours: [...structure.contours, ...resultContours]
            };
          }
          return structure;
        })
      );
      return true;
    }

    return false;
  }, [structures, setStructures]);

  const cropContourWithMargin = useCallback((
    targetContourId: string,
    cropContourId: string,
    margin: number = 0,
    pixelSpacing: number = 1.0
  ) => {
    const targetContour = structures.flatMap(s => s.contours).find(c => c.id === targetContourId);
    const cropContour = structures.flatMap(s => s.contours).find(c => c.id === cropContourId);

    if (!targetContour || !cropContour) return false;

    const result = EditUtils.cropWithMargin(targetContour, cropContour, margin, pixelSpacing);

    if (result) {
      setStructures(prevStructures =>
        prevStructures.map(structure => ({
          ...structure,
          contours: structure.contours.map(c =>
            c.id === targetContourId ? result : c
          )
        }))
      );
      return true;
    }

    return false;
  }, [structures, setStructures]);

  // Segmentation Operations
  const performThresholdSegmentation = useCallback((
    imageData: ImageData2D,
    minHU: number,
    maxHU: number,
    sliceIndex: number,
    rescaleSlope: number = 1,
    rescaleIntercept: number = 0
  ) => {
    if (!state.activeStructureId) return false;

    const contourPoints = EditUtils.thresholdSegmentation(
      imageData,
      minHU,
      maxHU,
      rescaleSlope,
      rescaleIntercept
    );

    const newContours: Contour[] = contourPoints.map((points, idx) => ({
      id: `threshold_${Date.now()}_${idx}`,
      points,
      sliceIndex,
      structureId: state.activeStructureId!,
      isClosed: true,
      color: structures.find(s => s.id === state.activeStructureId)?.color || '#ff0000'
    }));

    setStructures(prevStructures =>
      prevStructures.map(structure =>
        structure.id === state.activeStructureId
          ? { ...structure, contours: [...structure.contours, ...newContours] }
          : structure
      )
    );

    return newContours.length > 0;
  }, [state.activeStructureId, structures, setStructures]);

  const performRegionGrowing = useCallback((
    imageData: ImageData2D,
    seedPoint: Point2D,
    tolerance: number,
    sliceIndex: number,
    rescaleSlope: number = 1,
    rescaleIntercept: number = 0
  ) => {
    if (!state.activeStructureId) return false;

    const points = EditUtils.regionGrowing(
      imageData,
      seedPoint,
      tolerance,
      rescaleSlope,
      rescaleIntercept
    );

    if (points.length >= 3) {
      const newContour: Contour = {
        id: `region_grow_${Date.now()}`,
        points,
        sliceIndex,
        structureId: state.activeStructureId,
        isClosed: true,
        color: structures.find(s => s.id === state.activeStructureId)?.color || '#ff0000'
      };

      setStructures(prevStructures =>
        prevStructures.map(structure =>
          structure.id === state.activeStructureId
            ? { ...structure, contours: [...structure.contours, newContour] }
            : structure
        )
      );

      return true;
    }

    return false;
  }, [state.activeStructureId, structures, setStructures]);

  const performMagicWand = useCallback((
    imageData: ImageData2D,
    seedPoint: Point2D,
    tolerance: number,
    sliceIndex: number,
    rescaleSlope: number = 1,
    rescaleIntercept: number = 0
  ) => {
    // Magic wand is essentially the same as region growing
    return performRegionGrowing(imageData, seedPoint, tolerance, sliceIndex, rescaleSlope, rescaleIntercept);
  }, [performRegionGrowing]);

  // Helper to get a specific contour
  const getContour = useCallback((contourId: string): Contour | null => {
    for (const structure of structures) {
      const contour = structure.contours.find(c => c.id === contourId);
      if (contour) return contour;
    }
    return null;
  }, [structures]);

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
    addContourToStructure,
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
    // Selection
    selectContour,
    deselectContour,
    setElasticRadius,
    // Point editing
    moveContourPoint,
    insertContourPoint,
    deleteContourPoint,
    deleteContour,
    smoothContourSection,
    // Copy/paste
    copySelectedContour,
    pasteContour,
    // 3D operations
    smooth2DContour,
    smooth3DStructure,
    // Margin operations
    applyMarginToContour,
    applyMarginToStructure,
    // Boolean operations
    performBooleanOp,
    cropContourWithMargin,
    // Segmentation
    performThresholdSegmentation,
    performRegionGrowing,
    performMagicWand,
    // Helpers
    getContour,
  };
}