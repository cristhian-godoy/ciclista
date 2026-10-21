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
}

/**
 * Hook to manage map canvas cursor style and Escape cancellation
 * during pin placement mode.
 */
export function useMapCursor({
  map,
  isPlacingPlace = false,
  setIsPlacingPlace,
}: UseMapCursorOptions): void {
  // Set map canvas cursor to crosshair during pin placement mode
  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas?.();
    if (!canvas) return;

    if (isPlacingPlace) {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = '';
    }

    return () => {
      if (canvas) {
        canvas.style.cursor = '';
      }
    };
  }, [map, isPlacingPlace]);

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
