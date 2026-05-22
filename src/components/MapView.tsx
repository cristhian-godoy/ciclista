import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Coordinate, StreetGraph, RouteResult, GraphNode } from '../core/types';

type GeoJSONFeature = 
  | {
      type: 'Feature';
      geometry: {
        type: 'Point';
        coordinates: number[];
      };
      properties: Record<string, unknown>;
    }
  | {
      type: 'Feature';
      geometry: {
        type: 'LineString';
        coordinates: number[][];
      };
      properties: Record<string, unknown>;
    };

interface MapViewProps {
  graph: StreetGraph | null;
  startCoord: Coordinate;
  endCoord: Coordinate;
  routeResult: RouteResult | null;
  customNodeDelays: Map<string, number>;
  onStartDrag: (coord: Coordinate) => void;
  onEndDrag: (coord: Coordinate) => void;
  onNodeSelect: (node: GraphNode | null) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  graph,
  startCoord,
  endCoord,
  routeResult,
  customNodeDelays,
  onStartDrag,
  onEndDrag,
  onNodeSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const endMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Keep callback handlers in refs to prevent stale closures in map listeners
  const onStartDragRef = useRef(onStartDrag);
  const onEndDragRef = useRef(onEndDrag);
  const onNodeSelectRef = useRef(onNodeSelect);

  useEffect(() => {
    onStartDragRef.current = onStartDrag;
  }, [onStartDrag]);

  useEffect(() => {
    onEndDragRef.current = onEndDrag;
  }, [onEndDrag]);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  // Track map loaded state to synchronize layer updates after style initialization
  const [mapReady, setMapReady] = useState(false);

  // Helper to update graph line and point layers
  const triggerGraphLayersUpdate = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !graph) return;

    // A. Generate Line features for all street edges
    const lineFeatures: GeoJSONFeature[] = [];
    const lightFeatures: GeoJSONFeature[] = [];

    graph.nodes.forEach((entry, sourceId) => {
      const u = entry.node;
      
      // Check if it is a traffic light
      if (
        u.tags.highway === 'traffic_signals' ||
        u.tags.crossing === 'traffic_signals'
      ) {
        const customDelay = customNodeDelays.get(sourceId);
        lightFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [u.lng, u.lat],
          },
          properties: {
            id: sourceId,
            tags: JSON.stringify(u.tags),
            name: u.tags.name || 'Traffic Signal',
            customDelay: customDelay || null,
          },
        });
      }

      // Draw edges
      entry.edges.forEach((edge) => {
        const vEntry = graph.nodes.get(edge.target);
        if (!vEntry) return;
        const v = vEntry.node;

        lineFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [u.lng, u.lat],
              [v.lng, v.lat],
            ],
          },
          properties: {
            name: edge.name,
            highway: edge.tags.highway,
          },
        });
      });
    });

    const streetSource = map.getSource('network-streets') as maplibregl.GeoJSONSource;
    if (streetSource) {
      streetSource.setData({
        type: 'FeatureCollection',
        features: lineFeatures,
      });
    }

    const lightSource = map.getSource('traffic-lights') as maplibregl.GeoJSONSource;
    if (lightSource) {
      lightSource.setData({
        type: 'FeatureCollection',
        features: lightFeatures,
      });
    }
  }, [graph, customNodeDelays, mapReady]);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use CartoDB Dark Matter tiles for a premium dark mode
    const map = new maplibregl.Map({
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
            attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
          },
        },
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
      center: [startCoord.lng, startCoord.lat],
      zoom: 14.5,
    });

    mapRef.current = map;

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // Initialize sources
      map.addSource('network-streets', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('route-path', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('traffic-lights', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Layer: All parsed network streets (cool techy overlay)
      map.addLayer({
        id: 'network-streets-layer',
        type: 'line',
        source: 'network-streets',
        paint: {
          'line-color': 'rgba(99, 102, 241, 0.15)',
          'line-width': 1.5,
        },
      });

      // Layer: Glowing Computed Route Path
      map.addLayer({
        id: 'route-path-layer',
        type: 'line',
        source: 'route-path',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#6366f1',
          'line-width': 5,
        },
      });

      // Layer: Glow outline for route
      map.addLayer({
        id: 'route-path-glow',
        type: 'line',
        source: 'route-path',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#14b8a6',
          'line-width': 9,
          'line-opacity': 0.3,
        },
      }, 'route-path-layer');

      // Layer: Traffic light interactive markers
      map.addLayer({
        id: 'traffic-lights-layer',
        type: 'circle',
        source: 'traffic-lights',
        paint: {
          'circle-radius': [
            'case',
            ['has', 'customDelay'], 7,
            5
          ],
          'circle-color': [
            'case',
            ['has', 'customDelay'], '#14b8a6',  // Custom delay timed nodes (Teal)
            '#ef4444'                           // Default OSM traffic signals (Red)
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.85,
        },
      });

      // Handle clicking on traffic signals
      map.on('click', 'traffic-lights-layer', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const properties = feature.properties;
        const geometry = feature.geometry;

        if (geometry && 'coordinates' in geometry && properties && properties.id) {
          const coords = (geometry as { coordinates: number[] }).coordinates;
          onNodeSelectRef.current({
            id: properties.id,
            lat: coords[1],
            lng: coords[0],
            tags: JSON.parse((properties.tags as string) || '{}'),
          });
        }
      });

      // Change cursor to pointer over traffic lights
      map.on('mouseenter', 'traffic-lights-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'traffic-lights-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      // Set map ready state, triggering downstream style-dependent operations
      setMapReady(true);
    });

    // Create Draggable Markers
    // Start Pin (Greenish Indigo)
    const startEl = document.createElement('div');
    startEl.style.width = '20px';
    startEl.style.height = '20px';
    startEl.style.borderRadius = '50%';
    startEl.style.backgroundColor = '#14b8a6';
    startEl.style.border = '3px solid #ffffff';
    startEl.style.boxShadow = '0 0 10px rgba(20, 184, 166, 0.8)';
    startEl.style.cursor = 'grab';

    const startMarker = new maplibregl.Marker({ element: startEl, draggable: true })
      .setLngLat([startCoord.lng, startCoord.lat])
      .addTo(map);

    startMarker.on('dragend', () => {
      const lngLat = startMarker.getLngLat();
      onStartDragRef.current({ lat: lngLat.lat, lng: lngLat.lng });
    });
    startMarkerRef.current = startMarker;

    // End Pin (Neon Pink / Indigo)
    const endEl = document.createElement('div');
    endEl.style.width = '20px';
    endEl.style.height = '20px';
    endEl.style.borderRadius = '50%';
    endEl.style.backgroundColor = '#6366f1';
    endEl.style.border = '3px solid #ffffff';
    endEl.style.boxShadow = '0 0 10px rgba(99, 102, 241, 0.8)';
    endEl.style.cursor = 'grab';

    const endMarker = new maplibregl.Marker({ element: endEl, draggable: true })
      .setLngLat([endCoord.lng, endCoord.lat])
      .addTo(map);

    endMarker.on('dragend', () => {
      const lngLat = endMarker.getLngLat();
      onEndDragRef.current({ lat: lngLat.lat, lng: lngLat.lng });
    });
    endMarkerRef.current = endMarker;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // 2. Track changes to Start and End coordinates from Sidebar Inputs
  useEffect(() => {
    if (startMarkerRef.current) {
      startMarkerRef.current.setLngLat([startCoord.lng, startCoord.lat]);
    }
  }, [startCoord]);

  useEffect(() => {
    if (endMarkerRef.current) {
      endMarkerRef.current.setLngLat([endCoord.lng, endCoord.lat]);
    }
  }, [endCoord]);

  // 3. Update layers when graph data or custom settings change, or when map style is loaded
  useEffect(() => {
    triggerGraphLayersUpdate();
  }, [triggerGraphLayersUpdate]);

  // 4. Update computed route layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const routeSource = map.getSource('route-path') as maplibregl.GeoJSONSource;
    if (!routeSource) return;

    if (routeResult && routeResult.coordinates.length > 0) {
      const coords = routeResult.coordinates.map((c) => [c.lng, c.lat]);
      routeSource.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coords,
            },
            properties: {},
          },
        ],
      });

      // Fit map bounds to show full route path smoothly
      if (coords.length > 1) {
        const bounds = coords.reduce(
          (acc, val) => acc.extend(val as [number, number]),
          new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
        );
        const isMobile = window.innerWidth <= 768;
        const padding = isMobile
          ? {
              top: 40,
              bottom: window.innerHeight * 0.45 + 40,
              left: 20,
              right: 20,
            }
          : 50;
        map.fitBounds(bounds, { padding, maxZoom: 16 });
      }
    } else {
      routeSource.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  }, [routeResult, mapReady]);

  return <div ref={mapContainerRef} className="map-container" />;
};
