import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface UseMapInstanceOptions {
  selectedPreset: 'munich' | 'amsterdam';
  onMapBoundsChange?: (bbox: [number, number, number, number], zoom: number) => void;
  onContextMenu?: (e: maplibregl.MapMouseEvent) => void;
  onClick?: (e: maplibregl.MapMouseEvent) => void;
  onDragStart?: () => void;
  onZoomStart?: () => void;
}

export const useMapInstance = ({
  selectedPreset,
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

    // Use CartoDB Dark Matter tiles for a premium dark mode style
    const mapInstance = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
          },
        },
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: selectedPreset === 'munich' ? [11.5754, 48.13715] : [4.89, 52.3725],
      zoom: 14.5,
    });

    setMap(mapInstance);

    // Add navigation controls
    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

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

    mapInstance.on('click', (e) => {
      if (onClickRef.current) {
        onClickRef.current(e);
      }
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
      }
      mapInstance.remove();
      setMap(null);
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle fly/ease preset switches
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    if (!map || !mapReady) return;

    const centers = {
      munich: [11.5754, 48.13715] as [number, number],
      amsterdam: [4.89, 52.3725] as [number, number],
    };

    map.easeTo({
      center: centers[selectedPreset],
      zoom: 14.5,
      duration: 800,
    });
  }, [selectedPreset, mapReady, map]);

  return { map, mapContainerRef, mapReady };
};
