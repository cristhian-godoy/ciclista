import 'maplibre-gl/dist/maplibre-gl.css';

import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import { fetchFilteredStyle } from '../../core/api/style';
import { MAP_CONFIG } from '../../core/common/constants';
import { logger } from '../../core/common/logger';
import { CustomNavigationControl } from './CustomNavigationControl';
import { useCustomMapControls } from './useCustomMapControls';

interface UseMapInstanceOptions {
  theme: 'bright' | 'liberty' | 'dark';
  tileless?: boolean;
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
  theme,
  tileless = false,
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
  const isInteractingRef = useRef(false);
  const interactionEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Use an empty style object initially to prevent downloading sprites/resources early
    const mapInstance = new maplibregl.Map({
      container: mapContainerRef.current,
      style: { version: 8, sources: {}, layers: [] },
      center: [MAP_CONFIG.DEFAULT_CENTER.lng, MAP_CONFIG.DEFAULT_CENTER.lat],
      zoom: 14.5,
      dragRotate: false,
      pitchWithRotate: false,
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
      if (!isInteractingRef.current && interactionEndTimeoutRef.current) {
        clearTimeout(interactionEndTimeoutRef.current);
        interactionEndTimeoutRef.current = null;
      }
    });

    mapInstance.on('dblclick', () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
    });

    const handleInteractionStart = () => {
      isInteractingRef.current = true;
      if (interactionEndTimeoutRef.current) {
        clearTimeout(interactionEndTimeoutRef.current);
        interactionEndTimeoutRef.current = null;
      }
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
    };

    const handleInteractionEnd = () => {
      if (interactionEndTimeoutRef.current) {
        clearTimeout(interactionEndTimeoutRef.current);
      }
      interactionEndTimeoutRef.current = setTimeout(() => {
        isInteractingRef.current = false;
        interactionEndTimeoutRef.current = null;
      }, 100);
    };

    mapInstance.on('dragstart', () => {
      handleInteractionStart();
      if (onDragStartRef.current) {
        onDragStartRef.current();
      }
    });
    mapInstance.on('dragend', handleInteractionEnd);

    mapInstance.on('rotatestart', handleInteractionStart);
    mapInstance.on('rotateend', handleInteractionEnd);

    mapInstance.on('pitchstart', handleInteractionStart);
    mapInstance.on('pitchend', handleInteractionEnd);

    mapInstance.on('zoomstart', () => {
      handleInteractionStart();
      if (onZoomStartRef.current) {
        onZoomStartRef.current();
      }
    });
    mapInstance.on('zoomend', handleInteractionEnd);

    mapInstance.on('click', (e) => {
      if (isInteractingRef.current) {
        return;
      }
      const mapWithDrag = mapInstance as unknown as { isDragging?: () => boolean };
      if (typeof mapWithDrag.isDragging === 'function' && mapWithDrag.isDragging()) {
        return;
      }

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
        if (!isInteractingRef.current && onClickRef.current) {
          onClickRef.current(e);
        }
      }, 200);
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

    let isCancelled = false;

    const loadInitialStyle = async () => {
      try {
        if (tileless) {
          mapInstance.once('style.load', () => {
            if (isCancelled) return;
            setMapReady(true);

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

          mapInstance.setStyle({
            version: 8,
            sources: {},
            layers: [
              {
                id: 'background',
                type: 'background',
                paint: {
                  'background-color': theme === 'bright' ? '#f8fafc' : '#0b0f19',
                },
              },
            ],
          });
          return;
        }

        const cleanStyle = await fetchFilteredStyle(theme);
        if (isCancelled) return;

        mapInstance.once('style.load', () => {
          if (isCancelled) return;
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

        mapInstance.setStyle(cleanStyle);
      } catch (err) {
        logger.error('Failed to load initial filtered map style:', err);
      }
    };

    loadInitialStyle();

    return () => {
      isCancelled = true;
      if (container) {
        container.removeEventListener('contextmenu', preventDefaultContextMenu);
      }
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      if (interactionEndTimeoutRef.current) {
        clearTimeout(interactionEndTimeoutRef.current);
      }
      mapInstance.remove();
      setMap(null);
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle theme changes
  const isFirstTheme = useRef(true);
  useEffect(() => {
    if (!map) return;

    if (isFirstTheme.current) {
      isFirstTheme.current = false;
      return;
    }

    setMapReady(false);
    let isCancelled = false;

    const updateThemeStyle = async () => {
      try {
        if (tileless) {
          map.once('style.load', () => {
            setMapReady(true);
          });
          map.setStyle({
            version: 8,
            sources: {},
            layers: [
              {
                id: 'background',
                type: 'background',
                paint: {
                  'background-color': theme === 'bright' ? '#f8fafc' : '#0b0f19',
                },
              },
            ],
          });
          return;
        }

        const cleanStyle = await fetchFilteredStyle(theme);
        if (isCancelled) return;

        const handleStyleLoad = () => {
          setMapReady(true);
        };

        map.once('style.load', handleStyleLoad);
        map.setStyle(cleanStyle);
      } catch (err) {
        logger.error('Failed to update map style for theme:', err);
      }
    };

    updateThemeStyle();

    return () => {
      isCancelled = true;
    };
  }, [theme, map, tileless]);

  return { map, mapContainerRef, mapReady };
};
