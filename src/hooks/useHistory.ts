import { useCallback, useRef, useState } from 'react';

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface UseHistoryOptions {
  maxHistorySize?: number;
}

export interface UseHistoryReturn<T> {
  state: T;
  setState: (newState: T | ((prev: T) => T), recordHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  historySize: number;
}

/**
 * A hook for managing undo/redo history for any state.
 *
 * @param initialState - The initial state value
 * @param options - Configuration options for history management
 * @returns An object with state, setState, undo, redo, and history info
 *
 * @example
 * ```tsx
 * const { state, setState, undo, redo, canUndo, canRedo } = useHistory(initialStructures, {
 *   maxHistorySize: 50
 * });
 *
 * // Update state and record in history
 * setState(newStructures);
 *
 * // Update state without recording (e.g., for temporary changes)
 * setState(tempStructures, false);
 *
 * // Undo/redo
 * if (canUndo) undo();
 * if (canRedo) redo();
 * ```
 */
export function useHistory<T>(
  initialState: T,
  options: UseHistoryOptions = {}
): UseHistoryReturn<T> {
  const { maxHistorySize = 50 } = options;

  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  // Keep track of whether we're in the middle of an undo/redo operation
  const isUndoRedoRef = useRef(false);

  /**
   * Set the current state, optionally recording it in history
   */
  const setState = useCallback((
    newState: T | ((prev: T) => T),
    recordHistory = true
  ) => {
    setHistory(prev => {
      const resolvedState = typeof newState === 'function'
        ? (newState as (prev: T) => T)(prev.present)
        : newState;

      // If we're not recording history (e.g., for temporary UI updates),
      // just update the present state
      if (!recordHistory) {
        return {
          ...prev,
          present: resolvedState,
        };
      }

      // If we're in an undo/redo operation, don't record in history
      if (isUndoRedoRef.current) {
        return {
          ...prev,
          present: resolvedState,
        };
      }

      // Record the current state in history
      const newPast = [...prev.past, prev.present];

      // Limit history size (remove oldest entries if needed)
      const trimmedPast = newPast.length > maxHistorySize
        ? newPast.slice(newPast.length - maxHistorySize)
        : newPast;

      return {
        past: trimmedPast,
        present: resolvedState,
        future: [], // Clear future when new state is added
      };
    });
  }, [maxHistorySize]);

  /**
   * Undo the last state change
   */
  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) {
        return prev;
      }

      isUndoRedoRef.current = true;

      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);

      // Use setTimeout to reset the flag after the state update
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 0);

      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  /**
   * Redo the last undone state change
   */
  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) {
        return prev;
      }

      isUndoRedoRef.current = true;

      const next = prev.future[0];
      const newFuture = prev.future.slice(1);

      // Use setTimeout to reset the flag after the state update
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 0);

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  /**
   * Clear all history (useful when loading new data)
   */
  const clearHistory = useCallback(() => {
    setHistory(prev => ({
      past: [],
      present: prev.present,
      future: [],
    }));
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const historySize = history.past.length + history.future.length + 1;

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    historySize,
  };
}
