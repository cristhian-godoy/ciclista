import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface UseMapInstanceOptions {
  selectedPreset: 'munich' | 'amsterdam';
  theme: 'bright' | 'liberty' | 'dark';
  onMapBoundsChange?: (bbox: [number, number, number, number], zoom: number) => void;
  onContextMenu?: (e: maplibregl.MapMouseEvent) => void;
  onClick?: (e: maplibregl.MapMouseEvent) => void;
  onDragStart?: () => void;
  onZoomStart?: () => void;
}

export const useMapInstance = ({
  selectedPreset,
  theme,
  onMapBoundsChange,
  onContextMenu,
  onClick,
  onDragStart,
  onZoomStart,
}: UseMapInstanceOptions) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Keep handlers in refs to avoid stale closures in event listeners
  const onMapBoundsChangeRef = useRef(onMapBoundsChange);
  const onContextMenuRef = useRef(onContextMenu);
  const onClickRef = useRef(onClick);
  const onDragStartRef = useRef(onDragStart);
  const onZoomStartRef = useRef(onZoomStart);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onMapBoundsChangeRef.current = onMapBoundsChange;
  }, [onMapBoundsChange]);

  useEffect(() => {
    onContextMenuRef.current = onContextMenu;
  }, [onContextMenu]);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    onDragStartRef.current = onDragStart;
  }, [onDragStart]);

  useEffect(() => {
    onZoomStartRef.current = onZoomStart;
  }, [onZoomStart]);

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use OpenFreeMap vector style URL
    const mapInstance = new maplibregl.Map({
      container: mapContainerRef.current,
      style: `https://tiles.openfreemap.org/styles/${theme}`,
      center: selectedPreset === 'munich' ? [11.5754, 48.13715] : [4.89, 52.3725],
      zoom: 14.5,
      dragRotate: false,
      pitchWithRotate: false,
    });

    setMap(mapInstance);

    // Add navigation controls
    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

    const container = mapContainerRef.current;
    const preventDefaultContextMenu = (e: MouseEvent) => e.preventDefault();

    // Middle mouse button rotation/pitch/pan handler
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

    if (container) {
      container.addEventListener('contextmenu', preventDefaultContextMenu);
      container.addEventListener('mousedown', handleMiddleMouseDown);
    }

    // Attach basic map event listeners
    mapInstance.on('contextmenu', (e) => {
      e.originalEvent.preventDefault();
      if (onContextMenuRef.current) {
        onContextMenuRef.current(e);
      }
    });

    mapInstance.on('mousedown', (e) => {
      mouseDownPosRef.current = { x: e.point.x, y: e.point.y };
    });

    mapInstance.on('dblclick', () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
    });

    mapInstance.on('click', (e) => {
      if (mouseDownPosRef.current) {
        const dx = e.point.x - mouseDownPosRef.current.x;
        const dy = e.point.y - mouseDownPosRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          return;
        }
      }

      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
        return;
      }

      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        if (onClickRef.current) {
          onClickRef.current(e);
        }
      }, 200);
    });

    mapInstance.on('dragstart', () => {
      if (onDragStartRef.current) {
        onDragStartRef.current();
      }
    });

    mapInstance.on('zoomstart', () => {
      if (onZoomStartRef.current) {
        onZoomStartRef.current();
      }
    });

    mapInstance.on('moveend', () => {
      const bounds = mapInstance.getBounds();
      const zoom = mapInstance.getZoom();
      const bbox: [number, number, number, number] = [
        bounds.getSouth(),
        bounds.getWest(),
        bounds.getNorth(),
        bounds.getEast(),
      ];
      if (onMapBoundsChangeRef.current) {
        onMapBoundsChangeRef.current(bbox, zoom);
      }
    });

    mapInstance.on('load', () => {
      setMapReady(true);
    });

    return () => {
      if (container) {
        container.removeEventListener('contextmenu', preventDefaultContextMenu);
        container.removeEventListener('mousedown', handleMiddleMouseDown);
      }
      document.removeEventListener('mousemove', handleMiddleMouseMove);
      document.removeEventListener('mouseup', handleMiddleMouseUp);
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      mapInstance.remove();
      setMap(null);
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle fly/ease preset switches
  const lastPresetRef = useRef(selectedPreset);
  useEffect(() => {
    if (!map || !mapReady) return;

    if (lastPresetRef.current !== selectedPreset) {
      lastPresetRef.current = selectedPreset;
      const centers = {
        munich: [11.5754, 48.13715] as [number, number],
        amsterdam: [4.89, 52.3725] as [number, number],
      };

      map.easeTo({
        center: centers[selectedPreset],
        zoom: 14.5,
        duration: 800,
      });
    }
  }, [selectedPreset, mapReady, map]);

  // Handle theme changes
  const isFirstTheme = useRef(true);
  useEffect(() => {
    if (!map) return;

    if (isFirstTheme.current) {
      isFirstTheme.current = false;
      return;
    }

    setMapReady(false);

    const handleStyleLoad = () => {
      setMapReady(true);
    };

    map.on('style.load', handleStyleLoad);
    map.setStyle(`https://tiles.openfreemap.org/styles/${theme}`);

    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [theme, map]);

  return { map, mapContainerRef, mapReady };
};
