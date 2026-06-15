import 'maplibre-gl/dist/maplibre-gl.css';

import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import { CustomNavigationControl } from './CustomNavigationControl';
import { useCustomMapControls } from './useCustomMapControls';

interface UseMapInstanceOptions {
  selectedPreset: 'munich' | 'amsterdam';
  theme: 'bright' | 'liberty' | 'dark';
  onMapBoundsChange?: (bbox: [number, number, number, number], zoom: number) => void;
  onContextMenu?: (e: maplibregl.MapMouseEvent) => void;
  onClick?: (e: maplibregl.MapMouseEvent) => void;
  onDragStart?: () => void;
  onZoomStart?: () => void;
}

/**
 * React hook that manages the lifecycle of the MapLibre GL map instance,
 * initializes container attachments, and binds viewport or click event callbacks.
 */
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

  // Apply custom middle-mouse controls
  useCustomMapControls(map, mapContainerRef);

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Parse initial coordinates/zoom from query parameters or hash
    let initialCenter: [number, number] | undefined;
    let initialZoom = 14.5;

    const params = new URLSearchParams(window.location.search);
    const queryLat = parseFloat(params.get('lat') || '');
    const queryLng = parseFloat(params.get('lng') || params.get('lon') || '');
    const queryZoom = parseFloat(params.get('zoom') || '');

    if (!isNaN(queryLat) && !isNaN(queryLng)) {
      initialCenter = [queryLng, queryLat];
      if (!isNaN(queryZoom)) {
        initialZoom = queryZoom;
      }
    } else {
      const hash = window.location.hash;
      if (hash.startsWith('#')) {
        const parts = hash.substring(1).split('/');
        if (parts.length >= 3) {
          const hashZoom = parseFloat(parts[0]);
          const hashLat = parseFloat(parts[1]);
          const hashLng = parseFloat(parts[2]);
          if (!isNaN(hashLat) && !isNaN(hashLng)) {
            initialCenter = [hashLng, hashLat];
            if (!isNaN(hashZoom)) {
              initialZoom = hashZoom;
            }
          }
        }
      }
    }

    // Use OpenFreeMap vector style URL
    const mapInstance = new maplibregl.Map({
      container: mapContainerRef.current,
      style: `https://tiles.openfreemap.org/styles/${theme}`,
      center:
        initialCenter || (selectedPreset === 'munich' ? [11.5754, 48.13715] : [4.89, 52.3725]),
      zoom: initialZoom,
      dragRotate: false,
      pitchWithRotate: false,
      hash: true,
    });

    setMap(mapInstance);

    // Add custom navigation controls
    mapInstance.addControl(new CustomNavigationControl(), 'top-right');

    const container = mapContainerRef.current;
    const preventDefaultContextMenu = (e: MouseEvent) => e.preventDefault();

    if (container) {
      container.addEventListener('contextmenu', preventDefaultContextMenu);
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
      // Trigger initial bounds change dynamically on startup to populate paths based on actual viewport
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

    return () => {
      if (container) {
        container.removeEventListener('contextmenu', preventDefaultContextMenu);
      }
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
