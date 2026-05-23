import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, ZoomIn, Check, X } from 'lucide-react';
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
  loadedBBoxes: [number, number, number, number][];
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  routeResult: RouteResult | null;
  selectedPreset: 'munich' | 'amsterdam';
  customNodeDelays: Map<string, number>;
  customNodeNotes: Map<string, string>;
  selectedNode: GraphNode | null;
  onStartDrag: (coord: Coordinate) => void;
  onEndDrag: (coord: Coordinate) => void;
  onNodeSelect: (node: GraphNode | null) => void;
  onSaveNodeOverride: (nodeId: string, delay: number, notes: string) => void;
  onClearNodeOverride: (nodeId: string) => void;
  onMapBoundsChange?: (bbox: [number, number, number, number], zoom: number) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  graph,
  loadedBBoxes,
  startCoord,
  endCoord,
  routeResult,
  selectedPreset,
  customNodeDelays,
  customNodeNotes,
  selectedNode,
  onStartDrag,
  onEndDrag,
  onNodeSelect,
  onSaveNodeOverride,
  onClearNodeOverride,
  onMapBoundsChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const endMarkerRef = useRef<maplibregl.Marker | null>(null);
  const shouldFitBoundsRef = useRef<boolean>(true);

  // Keep callback handlers in refs to prevent stale closures in map listeners
  const onStartDragRef = useRef(onStartDrag);
  const onEndDragRef = useRef(onEndDrag);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onMapBoundsChangeRef = useRef(onMapBoundsChange);

  useEffect(() => {
    onStartDragRef.current = onStartDrag;
  }, [onStartDrag]);

  useEffect(() => {
    onEndDragRef.current = onEndDrag;
  }, [onEndDrag]);

  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  useEffect(() => {
    onMapBoundsChangeRef.current = onMapBoundsChange;
  }, [onMapBoundsChange]);

  const startCoordRef = useRef(startCoord);
  const endCoordRef = useRef(endCoord);

  useEffect(() => {
    startCoordRef.current = startCoord;
  }, [startCoord]);

  useEffect(() => {
    endCoordRef.current = endCoord;
  }, [endCoord]);

  // Track map loaded state to synchronize layer updates after style initialization
  const [mapReady, setMapReady] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    lng: number;
    lat: number;
    crossingId: string | null;
    nodeIds: string | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    lng: 0,
    lat: 0,
    crossingId: null,
    nodeIds: null,
  });

  const [managedClusterId, setManagedClusterId] = useState<string | null>(null);
  const [managedNodeIds, setManagedNodeIds] = useState<string[]>([]);

  // Toggle minor control points visibility (yield, stop, crossing)
  const [showMinorControls, setShowMinorControls] = useState(false);

  // Node delay/note editing states for map popup editor
  const [nodeDelay, setNodeDelay] = useState<number>(30);
  const [nodeNotes, setNodeNotes] = useState<string>('');
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);

  const getDefaultBaseDelay = (tags: Record<string, string>): number => {
    if (tags.highway === 'traffic_signals' || tags.crossing === 'traffic_signals') {
      return 15;
    }
    if (tags.highway === 'give_way') {
      return 3;
    }
    if (tags.highway === 'stop') {
      return 8;
    }
    if (tags.highway === 'crossing' || tags.crossing) {
      return 3;
    }
    return 0;
  };

  const getControlType = (tags: Record<string, string>): 'signal' | 'yield' | 'stop' | 'crossing' => {
    if (tags.highway === 'traffic_signals' || tags.crossing === 'traffic_signals') {
      return 'signal';
    }
    if (tags.highway === 'give_way') {
      return 'yield';
    }
    if (tags.highway === 'stop') {
      return 'stop';
    }
    return 'crossing';
  };

  const getControlTypeLabel = (tags: Record<string, string>) => {
    const type = getControlType(tags);
    switch (type) {
      case 'signal': return '🚦 Traffic Signal';
      case 'yield': return '⚠️ Yield Sign (Give Way)';
      case 'stop': return '🛑 Stop Sign';
      case 'crossing': return '🚶 Pedestrian Crossing';
    }
  };

  const getPresets = (type: 'signal' | 'yield' | 'stop' | 'crossing'): { label: string; value: number }[] => {
    switch (type) {
      case 'signal':
        return [
          { label: 'Always Green', value: 0 },
          { label: 'Standard (15s)', value: 15 },
          { label: 'Slow (30s)', value: 30 },
          { label: 'Major (60s)', value: 60 },
        ];
      case 'yield':
        return [
          { label: 'Clear', value: 0 },
          { label: 'Standard (3s)', value: 3 },
          { label: 'Heavy (15s)', value: 15 },
        ];
      case 'stop':
        return [
          { label: 'Rolling (2s)', value: 2 },
          { label: 'Standard (8s)', value: 8 },
          { label: 'Busy (20s)', value: 20 },
        ];
      case 'crossing':
        return [
          { label: 'Clear', value: 0 },
          { label: 'Standard (3s)', value: 3 },
          { label: 'Busy (15s)', value: 15 },
        ];
    }
  };

  // Sync node delay/notes and update position projection when selectedNode changes
  useEffect(() => {
    if (selectedNode) {
      setNodeDelay(customNodeDelays.get(selectedNode.id) ?? getDefaultBaseDelay(selectedNode.tags));
      setNodeNotes(customNodeNotes.get(selectedNode.id) ?? '');
    }
  }, [selectedNode, customNodeDelays, customNodeNotes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedNode || !mapReady) {
      setPopupPos(null);
      return;
    }

    const updatePosition = () => {
      const pos = map.project([selectedNode.lng, selectedNode.lat]);
      setPopupPos({ x: pos.x, y: pos.y });
    };

    updatePosition();
    map.on('move', updatePosition);
    map.on('zoom', updatePosition);

    return () => {
      map.off('move', updatePosition);
      map.off('zoom', updatePosition);
    };
  }, [selectedNode, mapReady]);

  const handleSaveNode = () => {
    if (selectedNode) {
      onSaveNodeOverride(selectedNode.id, nodeDelay, nodeNotes);
      onNodeSelect(null);
    }
  };

  const handleResetNode = () => {
    if (selectedNode) {
      onClearNodeOverride(selectedNode.id);
      onNodeSelect(null);
    }
  };

  // Handle window clicks to close context menu
  useEffect(() => {
    const handleWindowClick = () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    };
    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  }, []);

  // Helper to update graph line and point layers
  const triggerGraphLayersUpdate = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // A. Generate Line features for all street edges
    const lineFeatures: GeoJSONFeature[] = [];
    const lightFeatures: GeoJSONFeature[] = [];

    if (graph) {
      // Find all control nodes (traffic lights, yield signs, stop signs, pedestrian crossings)
      const controlNodes: {
        id: string;
        lat: number;
        lng: number;
        tags: Record<string, string>;
        customDelay: number | null;
        controlType: 'signal' | 'yield' | 'stop' | 'crossing';
      }[] = [];

      graph.nodes.forEach((entry, sourceId) => {
        const u = entry.node;
        const tags = u.tags || {};
        let controlType: 'signal' | 'yield' | 'stop' | 'crossing' | null = null;

        if (tags.highway === 'traffic_signals' || tags.crossing === 'traffic_signals') {
          controlType = 'signal';
        } else if (tags.highway === 'give_way') {
          controlType = 'yield';
        } else if (tags.highway === 'stop') {
          controlType = 'stop';
        } else if (tags.highway === 'crossing' || tags.crossing) {
          controlType = 'crossing';
        }

        if (controlType) {
          const hasOverride = customNodeDelays.has(sourceId);
          // Hide minor controls (yield, stop, crossing) by default unless showMinorControls is checked OR they have custom overrides
          if (controlType !== 'signal' && !showMinorControls && !hasOverride) {
            return;
          }

          controlNodes.push({
            id: sourceId,
            lat: u.lat,
            lng: u.lng,
            tags: u.tags,
            customDelay: customNodeDelays.get(sourceId) ?? null,
            controlType,
          });
        }
      });

      // Simple Euclidean distance function (in meters)
      const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const dLat = lat1 - lat2;
        const dLng = lng1 - lng2;
        const cosLat = 0.67; // cos of average Munich latitude (~48 deg)
        return Math.sqrt(dLat * dLat + (dLng * cosLat) * (dLng * cosLat)) * 111000;
      };

      // Cluster them (BFS grouping within 35 meters)
      const visited = new Set<string>();
      const crossings: {
        id: string;
        lat: number;
        lng: number;
        nodeIds: string[];
        controlType: 'signal' | 'yield' | 'stop' | 'crossing';
        hasCustomDelay: boolean;
      }[] = [];

      for (const node of controlNodes) {
        if (visited.has(node.id)) continue;

        const clusterNodes = [node];
        visited.add(node.id);

        const queue = [node];
        while (queue.length > 0) {
          const current = queue.shift()!;
          for (const other of controlNodes) {
            if (visited.has(other.id)) continue;
            if (getDistance(current.lat, current.lng, other.lat, other.lng) <= 35) {
              visited.add(other.id);
              clusterNodes.push(other);
              queue.push(other);
            }
          }
        }

        const avgLat = clusterNodes.reduce((sum, n) => sum + n.lat, 0) / clusterNodes.length;
        const avgLng = clusterNodes.reduce((sum, n) => sum + n.lng, 0) / clusterNodes.length;
        const crossingId = `crossing-${node.id}`;

        // Determine dominant controlType for this cluster: signal > stop > yield > crossing
        let clusterControlType: 'signal' | 'yield' | 'stop' | 'crossing' = 'crossing';
        const types = clusterNodes.map((n) => n.controlType);
        if (types.includes('signal')) {
          clusterControlType = 'signal';
        } else if (types.includes('stop')) {
          clusterControlType = 'stop';
        } else if (types.includes('yield')) {
          clusterControlType = 'yield';
        }

        const hasCustomDelay = clusterNodes.some((n) => n.customDelay !== null);

        crossings.push({
          id: crossingId,
          lat: avgLat,
          lng: avgLng,
          nodeIds: clusterNodes.map((n) => n.id),
          controlType: clusterControlType,
          hasCustomDelay,
        });
      }

      // Add crossing features
      crossings.forEach((crossing) => {
        lightFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [crossing.lng, crossing.lat],
          },
          properties: {
            type: 'crossing',
            crossingId: crossing.id,
            nodeIds: JSON.stringify(crossing.nodeIds),
            controlType: crossing.controlType,
            hasCustomDelay: crossing.hasCustomDelay ? 'true' : 'false',
          },
        });
      });

      // Add individual signal features
      controlNodes.forEach((node) => {
        const parentCrossing = crossings.find((c) => c.nodeIds.includes(node.id));
        lightFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [node.lng, node.lat],
          },
          properties: {
            type: 'signal', // Keep 'signal' type to match the unclustered layer filter type check
            controlType: node.controlType,
            id: node.id,
            parentCrossingId: parentCrossing ? parentCrossing.id : '',
            tags: JSON.stringify(node.tags),
            name: node.tags.name || (
              node.controlType === 'signal' ? 'Traffic Signal' :
              node.controlType === 'yield' ? 'Yield Sign' :
              node.controlType === 'stop' ? 'Stop Sign' : 'Pedestrian Crossing'
            ),
            ...(node.customDelay !== null ? { customDelay: node.customDelay } : {}),
          },
        });
      });

      // Draw edges
      graph.nodes.forEach((entry) => {
        const u = entry.node;
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
    }

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
  }, [graph, customNodeDelays, mapReady, showMinorControls]);

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
      center: selectedPreset === 'munich' ? [11.5754, 48.13715] : [4.8900, 52.3725],
      zoom: 14.5,
    });

    mapRef.current = map;

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const container = mapContainerRef.current;
    const preventDefaultContextMenu = (e: MouseEvent) => e.preventDefault();
    if (container) {
      container.addEventListener('contextmenu', preventDefaultContextMenu);
    }

    map.on('contextmenu', (e) => {
      e.originalEvent.preventDefault();

      // Check if right click was on a crossing cluster
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['traffic-lights-cluster'],
      });
      const isCrossing = features.length > 0;
      const crossingId = isCrossing && features[0].properties ? (features[0].properties.crossingId as string) : null;
      const nodeIds = isCrossing && features[0].properties ? (features[0].properties.nodeIds as string) : null;

      setContextMenu({
        visible: true,
        x: e.point.x,
        y: e.point.y,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        crossingId,
        nodeIds,
      });
    });

    map.on('click', (e) => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));

      // If clicked on empty space, deselect active node and re-group signals
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['traffic-lights-cluster', 'traffic-lights-unclustered']
      });
      if (features.length === 0) {
        setManagedClusterId(null);
        setManagedNodeIds([]);
        onNodeSelectRef.current(null);

        // UX: Clicking on map adds start pin, or end pin if start is set, unless both are set
        const sCoord = startCoordRef.current;
        const eCoord = endCoordRef.current;
        const clickedCoord = { lat: e.lngLat.lat, lng: e.lngLat.lng };

        if (!sCoord) {
          onStartDragRef.current(clickedCoord);
        } else if (!eCoord) {
          onEndDragRef.current(clickedCoord);
        }
      }
    });

    map.on('dragstart', () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    });

    map.on('zoomstart', () => {
      setContextMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    });

    map.on('moveend', () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
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
        cluster: false,
      });

      map.addSource('loaded-bbox', {
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

      // Layer: Traffic light clusters (grouped crossings)
      map.addLayer({
        id: 'traffic-lights-cluster',
        type: 'circle',
        source: 'traffic-lights',
        filter: ['==', ['get', 'type'], 'crossing'],
        paint: {
          'circle-color': [
            'match',
            ['get', 'controlType'],
            'signal', '#ef4444',     // Red for signals
            'stop', '#ea580c',       // Orange-Red for stop signs
            'yield', '#f59e0b',      // Amber/Yellow for yield signs
            'crossing', '#3b82f6',   // Blue for pedestrian crossings
            '#9ca3af'                // Grey fallback
          ],
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12, [
              'match',
              ['get', 'controlType'],
              'signal', 3,
              'stop', 3,
              'yield', 1.8,
              'crossing', 1.8,
              3
            ],
            14, [
              'match',
              ['get', 'controlType'],
              'signal', 8,
              'stop', 8,
              'yield', 5,
              'crossing', 5,
              8
            ],
            17, [
              'match',
              ['get', 'controlType'],
              'signal', 16,
              'stop', 16,
              'yield', 10,
              'crossing', 10,
              16
            ]
          ],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'hasCustomDelay'], 'true'], '#14b8a6', // Teal halo for custom delays
            '#ffffff' // White otherwise
          ],
          'circle-stroke-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12, [
              'case',
              ['==', ['get', 'hasCustomDelay'], 'true'], 1.5,
              0.5
            ],
            14, [
              'case',
              ['==', ['get', 'hasCustomDelay'], 'true'], 3.0,
              1.5
            ],
            17, [
              'case',
              ['==', ['get', 'hasCustomDelay'], 'true'], 4.0,
              2.0
            ]
          ],
          'circle-opacity': 0.85,
        },
      });

      // Layer: Traffic light individual markers (ungrouped)
      map.addLayer({
        id: 'traffic-lights-unclustered',
        type: 'circle',
        source: 'traffic-lights',
        filter: ['==', ['get', 'type'], 'signal-hidden'], // Start hidden
        paint: {
          'circle-radius': [
            'case',
            ['has', 'customDelay'], 8,
            [
              'match',
              ['get', 'controlType'],
              'signal', 6,
              'stop', 6,
              'yield', 4,
              'crossing', 4,
              6
            ]
          ],
          'circle-color': [
            'case',
            ['has', 'customDelay'], '#14b8a6',  // Custom delay timed nodes (Teal)
            [
              'match',
              ['get', 'controlType'],
              'signal', '#ef4444',
              'stop', '#ea580c',
              'yield', '#f59e0b',
              'crossing', '#3b82f6',
              '#9ca3af'
            ]
          ],
          'circle-stroke-width': [
            'case',
            ['has', 'customDelay'], 2.5,
            1.5
          ],
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.85,
        },
      });

      // Handle clicking on unclustered traffic signals
      map.on('click', 'traffic-lights-unclustered', (e) => {
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

          // Smoothly pan to center the clicked traffic signal node
          map.easeTo({
            center: [coords[0], coords[1]],
            duration: 400,
          });
        }
      });

      // Handle clicking on crossing clusters to zoom in and manage traffic lights
      map.on('click', 'traffic-lights-cluster', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const geometry = feature.geometry;
        const properties = feature.properties;

        if (geometry && 'coordinates' in geometry && properties) {
          const coords = (geometry as { coordinates: number[] }).coordinates;
          const crossingId = properties.crossingId as string;
          const nodeIds = JSON.parse((properties.nodeIds as string) || '[]');

          setManagedClusterId(crossingId);
          setManagedNodeIds(nodeIds);

          map.easeTo({
            center: [coords[0], coords[1]],
            zoom: 17.5,
          });
        }
      });

      // Change cursor to pointer over traffic lights and clusters
      map.on('mouseenter', 'traffic-lights-unclustered', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'traffic-lights-unclustered', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('mouseenter', 'traffic-lights-cluster', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'traffic-lights-cluster', () => {
        map.getCanvas().style.cursor = '';
      });

      // Set map ready state, triggering downstream style-dependent operations
      setMapReady(true);
    });

    return () => {
      if (container) {
        container.removeEventListener('contextmenu', preventDefaultContextMenu);
      }
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly/ease to preset centers when selectedPreset changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const centers = {
      munich: [11.5754, 48.13715] as [number, number],
      amsterdam: [4.8900, 52.3725] as [number, number],
    };
    map.easeTo({
      center: centers[selectedPreset],
      zoom: 14.5,
      duration: 800,
    });
  }, [selectedPreset, mapReady]);

  // 2. Dynamically create/update/remove Start Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (startCoord) {
      if (!startMarkerRef.current) {
        const startEl = document.createElement('div');
        startEl.style.width = '28px';
        startEl.style.height = '28px';
        startEl.style.borderRadius = '50%';
        startEl.style.backgroundColor = '#10b981'; // Emerald Green
        startEl.style.border = '3px solid #ffffff';
        startEl.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.8)';
        startEl.style.cursor = 'grab';
        startEl.style.display = 'flex';
        startEl.style.alignItems = 'center';
        startEl.style.justifyContent = 'center';
        startEl.style.color = '#ffffff';
        startEl.style.fontWeight = 'bold';
        startEl.style.fontSize = '12px';
        startEl.style.fontFamily = 'inherit';
        startEl.innerHTML = 'A';

        const startMarker = new maplibregl.Marker({ element: startEl, draggable: true })
          .setLngLat([startCoord.lng, startCoord.lat])
          .addTo(map);

        startMarker.on('dragend', () => {
          const lngLat = startMarker.getLngLat();
          onStartDragRef.current({ lat: lngLat.lat, lng: lngLat.lng });
        });
        startMarkerRef.current = startMarker;
        shouldFitBoundsRef.current = true;
      } else {
        const currentMarkerLngLat = startMarkerRef.current.getLngLat();
        const diffLat = Math.abs(startCoord.lat - currentMarkerLngLat.lat);
        const diffLng = Math.abs(startCoord.lng - currentMarkerLngLat.lng);
        startMarkerRef.current.setLngLat([startCoord.lng, startCoord.lat]);
        if (diffLat > 0.0001 || diffLng > 0.0001) {
          shouldFitBoundsRef.current = true;
        }
      }
    } else {
      if (startMarkerRef.current) {
        startMarkerRef.current.remove();
        startMarkerRef.current = null;
      }
    }
  }, [startCoord, mapReady]);

  // 3. Dynamically create/update/remove End Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (endCoord) {
      if (!endMarkerRef.current) {
        const endEl = document.createElement('div');
        endEl.style.width = '28px';
        endEl.style.height = '28px';
        endEl.style.borderRadius = '50%';
        endEl.style.backgroundColor = '#ef4444'; // Red
        endEl.style.border = '3px solid #ffffff';
        endEl.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.8)';
        endEl.style.cursor = 'grab';
        endEl.style.display = 'flex';
        endEl.style.alignItems = 'center';
        endEl.style.justifyContent = 'center';
        endEl.style.color = '#ffffff';
        endEl.style.fontWeight = 'bold';
        endEl.style.fontSize = '12px';
        endEl.style.fontFamily = 'inherit';
        endEl.innerHTML = 'B';

        const endMarker = new maplibregl.Marker({ element: endEl, draggable: true })
          .setLngLat([endCoord.lng, endCoord.lat])
          .addTo(map);

        endMarker.on('dragend', () => {
          const lngLat = endMarker.getLngLat();
          onEndDragRef.current({ lat: lngLat.lat, lng: lngLat.lng });
        });
        endMarkerRef.current = endMarker;
        shouldFitBoundsRef.current = true;
      } else {
        const currentMarkerLngLat = endMarkerRef.current.getLngLat();
        const diffLat = Math.abs(endCoord.lat - currentMarkerLngLat.lat);
        const diffLng = Math.abs(endCoord.lng - currentMarkerLngLat.lng);
        endMarkerRef.current.setLngLat([endCoord.lng, endCoord.lat]);
        if (diffLat > 0.0001 || diffLng > 0.0001) {
          shouldFitBoundsRef.current = true;
        }
      }
    } else {
      if (endMarkerRef.current) {
        endMarkerRef.current.remove();
        endMarkerRef.current = null;
      }
    }
  }, [endCoord, mapReady]);

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
      if (shouldFitBoundsRef.current && coords.length > 1) {
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
        shouldFitBoundsRef.current = false; // Reset so that subsequent panned fetches don't trigger refit
      }
    } else {
      routeSource.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  }, [routeResult, mapReady]);

  // 5. Update loaded bounding box boundary layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const bboxSource = map.getSource('loaded-bbox') as maplibregl.GeoJSONSource;
    if (!bboxSource) return;

    if (loadedBBoxes && loadedBBoxes.length > 0) {
      const features = loadedBBoxes.map((bbox) => {
        const [minLat, minLng, maxLat, maxLng] = bbox;
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              [
                [minLng, minLat],
                [maxLng, minLat],
                [maxLng, maxLat],
                [minLng, maxLat],
                [minLng, minLat],
              ]
            ],
          },
          properties: {},
        };
      });
      bboxSource.setData({
        type: 'FeatureCollection',
        features,
      });
    } else {
      bboxSource.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  }, [loadedBBoxes, mapReady]);
  // Synchronize layer filters when managed states update
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (managedClusterId !== null && managedNodeIds.length > 0) {
      // Hide the managed crossing cluster, keep other crossing clusters visible
      map.setFilter('traffic-lights-cluster', [
        'all',
        ['==', ['get', 'type'], 'crossing'],
        ['!=', ['get', 'crossingId'], managedClusterId]
      ]);
      // Show ONLY the individual signals belonging to the managed crossing
      map.setFilter('traffic-lights-unclustered', [
        'all',
        ['==', ['get', 'type'], 'signal'],
        ['==', ['get', 'parentCrossingId'], managedClusterId]
      ]);
    } else {
      // Show all crossings
      map.setFilter('traffic-lights-cluster', ['==', ['get', 'type'], 'crossing']);
      // Hide all individual signals
      map.setFilter('traffic-lights-unclustered', ['==', ['get', 'type'], 'signal-hidden']);
    }
  }, [managedClusterId, managedNodeIds, mapReady]);

  // Reset managed cluster state if selectedNode becomes null (drawer is closed/saved)
  const prevSelectedNodeRef = useRef<GraphNode | null>(null);
  useEffect(() => {
    if (prevSelectedNodeRef.current !== null && selectedNode === null) {
      setManagedClusterId(null);
      setManagedNodeIds([]);
    }
    prevSelectedNodeRef.current = selectedNode;
  }, [selectedNode]);


  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={mapContainerRef} className="map-container" />

      {/* Floating Toggle for Minor Controls */}
      <button
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 5,
          background: showMinorControls ? 'var(--accent)' : 'rgba(15, 23, 42, 0.85)',
          color: showMinorControls ? '#000000' : 'var(--text-primary)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '0.75rem',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
        }}
        onClick={() => setShowMinorControls((v) => !v)}
      >
        <span style={{ fontSize: '0.9rem' }}>🚦</span>
        <span>{showMinorControls ? 'Hide Minor Controls' : 'Show Minor Controls'}</span>
      </button>
      
      {/* Dynamic Glassmorphic Map Popup */}
      {selectedNode && popupPos && (
        <div
          className="map-popup"
          style={{
            position: 'absolute',
            left: `${popupPos.x}px`,
            top: `${popupPos.y}px`,
            transform: 'translate(-50%, -100%) translateY(-15px)',
            zIndex: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Configure Control Point</h3>
            <button
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
              }}
              onClick={() => onNodeSelect(null)}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.4' }}>
            <strong>Type:</strong> {getControlTypeLabel(selectedNode.tags)}
            <br />
            <strong>ID:</strong> {selectedNode.id}
            <br />
            <strong>OSM Name:</strong> {selectedNode.tags.name || 'Unnamed Crossing'}
          </div>

          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label" style={{ fontSize: '0.65rem' }}>Wait Penalty: {nodeDelay} seconds</label>
            <div className="slider-container">
              <input
                type="range"
                min="0"
                max="180"
                step="5"
                className="slider"
                value={nodeDelay}
                onChange={(e) => setNodeDelay(parseInt(e.target.value))}
              />
            </div>
            {/* Presets buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {getPresets(getControlType(selectedNode.tags)).map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  style={{
                    background: nodeDelay === preset.value ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)',
                    color: nodeDelay === preset.value ? '#000000' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '0.62rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setNodeDelay(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label" style={{ fontSize: '0.65rem' }}>Custom Notes</label>
            <input
              className="input-text"
              type="text"
              placeholder="e.g. Constant bus priority request"
              value={nodeNotes}
              onChange={(e) => setNodeNotes(e.target.value)}
              style={{ padding: '6px 8px', fontSize: '0.8rem' }}
            />
          </div>

          {/* Collapsible/Scrollable OSM Info Section */}
          <div className="osm-tags-title" style={{ fontSize: '0.65rem', marginBottom: '4px' }}>OSM Tags</div>
          <div className="osm-tags-container">
            {Object.entries(selectedNode.tags).length > 0 ? (
              Object.entries(selectedNode.tags).map(([key, val]) => (
                <div key={key} className="osm-tag-row">
                  <span className="osm-tag-key">{key}</span>
                  <span className="osm-tag-val">{String(val)}</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '6px 8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No tags available
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button className="btn btn-primary" style={{ flex: 1, padding: '6px var(--spacing-sm)', fontSize: '0.8rem', height: '32px' }} onClick={handleSaveNode}>
              <Check size={14} style={{ marginRight: '4px' }} />
              Save
            </button>
            {customNodeDelays.has(selectedNode.id) && (
              <button
                className="btn btn-secondary btn-danger"
                style={{ flex: 0.5, padding: '6px var(--spacing-sm)', fontSize: '0.8rem', height: '32px', color: 'var(--text-primary)', background: 'var(--accent-danger)' }}
                onClick={handleResetNode}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
      {contextMenu.visible && (
        <div
          className="map-context-menu"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()} // Prevent closing menu when clicking on it
        >
          {contextMenu.crossingId !== null && (
            <button
              className="map-context-menu-item"
              onClick={() => {
                const map = mapRef.current;
                if (map && contextMenu.crossingId !== null) {
                  const nodeIds = JSON.parse(contextMenu.nodeIds || '[]');
                  setManagedClusterId(contextMenu.crossingId);
                  setManagedNodeIds(nodeIds);
                  
                  // Zoom in to the cluster location so the user can easily see individual signals
                  map.easeTo({
                    center: [contextMenu.lng, contextMenu.lat],
                    zoom: 17.5,
                  });
                }
                setContextMenu((prev) => ({ ...prev, visible: false }));
              }}
            >
              <ZoomIn size={14} style={{ color: '#f59e0b' }} />
              <span>Manage Traffic Lights</span>
            </button>
          )}
          <button
            className="map-context-menu-item"
            onClick={() => {
              onStartDragRef.current({ lat: contextMenu.lat, lng: contextMenu.lng });
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <MapPin size={14} style={{ color: '#10b981' }} />
            <span>Start Route Here</span>
          </button>
          <button
            className="map-context-menu-item"
            onClick={() => {
              onEndDragRef.current({ lat: contextMenu.lat, lng: contextMenu.lng });
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <MapPin size={14} style={{ color: '#ef4444' }} />
            <span>End Route Here</span>
          </button>
        </div>
      )}
    </div>
  );
};
