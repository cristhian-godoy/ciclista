import type maplibregl from 'maplibre-gl';
import { useEffect } from 'react';

/**
 * Hook to apply custom map controls.
 * Implements middle-mouse button panning and rotating.
 * This is implemented as a custom hook rather than using native MapLibre controls
 * because MapLibre hardcodes right-click for rotation, but middle-click is preferred here
 * to match 3D software (e.g., Blender) muscle memory.
 */
export const useCustomMapControls = (
  mapInstance: maplibregl.Map | null,
  containerRef: React.RefObject<HTMLDivElement | null>,
) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!mapInstance || !container) return;

    let isMiddleDragging = false;
    let lastX = 0;
    let lastY = 0;

    const handleMiddleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        isMiddleDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        document.addEventListener('mousemove', handleMiddleMouseMove);
        document.addEventListener('mouseup', handleMiddleMouseUp);
      }
    };

    const handleMiddleMouseMove = (e: MouseEvent) => {
      if (!isMiddleDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (e.shiftKey) {
        // Pan map
        mapInstance.panBy([-dx, -dy], { animate: false });
      } else {
        // Rotate & Pitch map
        const newBearing = mapInstance.getBearing() + dx * 0.5;
        const newPitch = Math.max(0, Math.min(85, mapInstance.getPitch() - dy * 0.5));
        mapInstance.setBearing(newBearing);
        mapInstance.setPitch(newPitch);
      }
    };

    const handleMiddleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        isMiddleDragging = false;
        document.removeEventListener('mousemove', handleMiddleMouseMove);
        document.removeEventListener('mouseup', handleMiddleMouseUp);
      }
    };

    container.addEventListener('mousedown', handleMiddleMouseDown);

    return () => {
      container.removeEventListener('mousedown', handleMiddleMouseDown);
      document.removeEventListener('mousemove', handleMiddleMouseMove);
      document.removeEventListener('mouseup', handleMiddleMouseUp);
    };
  }, [mapInstance, containerRef]);
};
