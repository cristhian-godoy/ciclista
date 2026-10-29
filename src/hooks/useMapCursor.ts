import type * as maplibregl from 'maplibre-gl';
import { useEffect } from 'react';

/**
 * Configuration options for useMapCursor hook.
 */
export interface UseMapCursorOptions {
  /** MapLibre map instance */
  map?: maplibregl.Map | null;
  /** Whether pin placement mode is active */
  isPlacingPlace?: boolean;
  /** Callback to set or toggle pin placement mode */
  setIsPlacingPlace?: (isPlacing: boolean) => void;
  /** Active application mode */
  appMode?: string;
}

/**
 * Hook to manage map canvas cursor style and Escape cancellation
 * during pin placement mode.
 */
export function useMapCursor({
  map,
  isPlacingPlace = false,
  setIsPlacingPlace,
  appMode,
}: UseMapCursorOptions): void {
  const isInvalidMode =
    appMode === 'edit' || appMode === 'events' || (appMode as string) === 'studio';
  const isPlacementActive = isPlacingPlace && !isInvalidMode;

  // Cancel pin placement if leaked into an invalid mode
  useEffect(() => {
    if (isPlacingPlace && isInvalidMode) {
      setIsPlacingPlace?.(false);
    }
  }, [isPlacingPlace, isInvalidMode, setIsPlacingPlace]);

  // Set map canvas cursor to crosshair during pin placement mode
  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas?.();
    if (!canvas) return;

    if (isPlacementActive) {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = '';
    }

    return () => {
      if (canvas) {
        canvas.style.cursor = '';
      }
    };
  }, [map, isPlacementActive]);

  // Handle Escape key to cancel pin placement mode
  useEffect(() => {
    if (!isPlacingPlace) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPlacingPlace?.(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlacingPlace, setIsPlacingPlace]);
}
