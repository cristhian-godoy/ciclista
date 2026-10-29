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
  /** Whether route intermediate stop placement mode is active */
  isPlacingStop?: boolean;
  /** Callback to set or toggle route intermediate stop placement mode */
  setIsPlacingStop?: (isPlacing: boolean) => void;
  /** Callback to cancel route intermediate stop placement mode */
  onCancelPlacingStop?: () => void;
}

/**
 * Hook to manage map canvas cursor style and Escape cancellation
 * during place pin and route stop placement mode.
 */
export function useMapCursor({
  map,
  isPlacingPlace = false,
  setIsPlacingPlace,
  appMode,
  isPlacingStop = false,
  setIsPlacingStop,
  onCancelPlacingStop,
}: UseMapCursorOptions): void {
  const isInvalidMode =
    appMode === 'edit' || appMode === 'events' || (appMode as string) === 'studio';
  const isCrosshair = (isPlacingPlace || isPlacingStop) && !isInvalidMode;

  // Cancel pin placement if leaked into an invalid mode
  useEffect(() => {
    if (isPlacingPlace && isInvalidMode) {
      setIsPlacingPlace?.(false);
    }
    if (isPlacingStop && isInvalidMode) {
      if (onCancelPlacingStop) {
        onCancelPlacingStop();
      } else {
        setIsPlacingStop?.(false);
      }
    }
  }, [
    isPlacingPlace,
    isPlacingStop,
    isInvalidMode,
    setIsPlacingPlace,
    setIsPlacingStop,
    onCancelPlacingStop,
  ]);

  // Set map canvas cursor to crosshair during pin or stop placement mode
  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas?.();
    if (!canvas) return;

    if (isCrosshair) {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = '';
    }

    return () => {
      if (canvas) {
        canvas.style.cursor = '';
      }
    };
  }, [map, isCrosshair]);

  // Handle Escape key to cancel active placement modes
  useEffect(() => {
    if (!isCrosshair) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPlacingStop) {
          if (onCancelPlacingStop) {
            onCancelPlacingStop();
          } else {
            setIsPlacingStop?.(false);
          }
        }
        if (isPlacingPlace) {
          setIsPlacingPlace?.(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isCrosshair,
    isPlacingPlace,
    isPlacingStop,
    setIsPlacingPlace,
    setIsPlacingStop,
    onCancelPlacingStop,
  ]);
}
