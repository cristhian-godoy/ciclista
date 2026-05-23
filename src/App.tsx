import { useState, useEffect, useMemo } from 'react';

import type { Coordinate, StreetGraph, GraphNode, LocalOverrides, RulesConfiguration } from './core/types';
import { OSMGraphParser } from './core/graph/parser';
import { DijkstraRouter, findNearestEdge } from './core/router/router';
import { LocalStorageProvider } from './core/storage/storage';
import { standardCost, avoidStoppingCost, avoidBusyRoadsCost } from './core/router/cost';
import { DEFAULT_RULES_CONFIG } from './components/RulesConfigPanel';

import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';

// Instantiate core modules (fully decoupled from components)
const parser = new OSMGraphParser();
const router = new DijkstraRouter();
const storage = new LocalStorageProvider();

const mergeGraphs = (g1: StreetGraph, g2: StreetGraph): StreetGraph => {
  const merged: StreetGraph = { nodes: new Map(g1.nodes) };
  g2.nodes.forEach((val, key) => {
    if (merged.nodes.has(key)) {
      const existing = merged.nodes.get(key)!;
      const targets = new Set(existing.edges.map(e => e.target));
      const newEdges = val.edges.filter(e => !targets.has(e.target));
      existing.edges.push(...newEdges);
    } else {
      merged.nodes.set(key, val);
    }
  });
  return merged;
};

export default function App() {
  // 1. Core Coordinate Defaults (initialized to null for user-placed pins)
  const [startCoord, setStartCoord] = useState<Coordinate | null>(null);
  const [endCoord, setEndCoord] = useState<Coordinate | null>(null);

  // 2. State management
  const [graph, setGraph] = useState<StreetGraph | null>(null);
  const [loadedBBoxes, setLoadedBBoxes] = useState<[number, number, number, number][]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isFetchingOSM, setIsFetchingOSM] = useState<boolean>(false);
  const [routingStrategy, setRoutingStrategy] = useState<'standard' | 'avoid-stops' | 'quiet-streets'>('standard');
  const [selectedPreset, setSelectedPreset] = useState<'munich' | 'amsterdam'>('munich');

  // Custom node overrides state loaded from storage
  const [nodeDelays, setNodeDelays] = useState<Map<string, number>>(new Map());
  const [nodeNotes, setNodeNotes] = useState<Map<string, string>>(new Map());
  const [nodeTurns, setNodeTurns] = useState<Map<string, Record<string, unknown>>>(new Map());
  const [rulesConfig, setRulesConfig] = useState<RulesConfiguration>(
    () => storage.loadRulesConfig() ?? DEFAULT_RULES_CONFIG
  );

  // 3. Load settings from storage on startup
  const loadCustomOverrides = async () => {
    const overrides = await storage.getOverrides();
    setNodeDelays(overrides.nodeDelays);
    setNodeNotes(overrides.nodeNotes);
    setNodeTurns(overrides.nodeTurns);
  };

  // Persist rules config whenever it changes
  useEffect(() => {
    storage.saveRulesConfig(rulesConfig);
  }, [rulesConfig]);

  // Helper to check if coordinate is inside any loaded bounding boxes
  const isInsideLoadedArea = (coord: Coordinate) => {
    return loadedBBoxes.some(bbox => {
      const [minLat, minLng, maxLat, maxLng] = bbox;
      return (
        coord.lat >= minLat &&
        coord.lat <= maxLat &&
        coord.lng >= minLng &&
        coord.lng <= maxLng
      );
    });
  };

  // 4. Overpass API fetching implementation
  const handleFetchOSM = async (bbox: [number, number, number, number], merge = false, silent = false) => {
    setIsFetchingOSM(true);
    if (!merge) {
      setSelectedNode(null); // Clear selected signal node
      setGraph(null); // Clear previous graph during load to prevent "phantom roads" from another city/preset
      setLoadedBBoxes([]);
    }

    try {
      // Overpass QL query template for bikeable paths (highways) within bounding box
      const query = `[out:json][timeout:25];(way["highway"](${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}););out body;>;out body qt;`;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Overpass API server returned error status: ${response.status}`);
      }

      const data = await response.json();
      const parsedGraph = parser.parse(data);
      if (merge) {
        setGraph(prev => prev ? mergeGraphs(prev, parsedGraph) : parsedGraph);
        setLoadedBBoxes(prev => [...prev, bbox]);
      } else {
        setGraph(parsedGraph);
        setLoadedBBoxes([bbox]);
      }
      
    } catch (e: unknown) {
      console.error('Failed to retrieve OSM network data:', e);
      
      if (graph === null && !merge) {
        console.warn('Using mock fallback graph due to initial fetch failure.');
        const mockGraph = parser.parse(null);
        setGraph(mockGraph);
        setLoadedBBoxes([[48.134, 11.574, 48.144, 11.583]]);
        // Restoring default mock coords
        setStartCoord({ lat: 48.13715, lng: 11.5754 });
        setEndCoord({ lat: 48.1350, lng: 11.5820 });
      } else {
        // Restore the previous valid graph and bounding box
        setGraph(graph);
        setLoadedBBoxes(loadedBBoxes);
      }

      if (!silent) {
        const message = e instanceof Error ? e.message : String(e);
        alert(
          `Error fetching map area: ${message}. ${
            graph === null
              ? 'Using fallback offline demo map.'
              : 'Restoring previously loaded map area.'
          }`
        );
      }
    } finally {
      setIsFetchingOSM(false);
    }
  };

  // Helper to compute a bounding box enclosing two coordinates with padding
  const calculateBoundingBox = (c1: Coordinate | null, c2: Coordinate | null): [number, number, number, number] => {
    if (!c1 || !c2) {
      // Default bounding box for Munich center
      const center = { lat: 48.13715, lng: 11.5754 };
      const latMargin = 0.015;
      const lngMargin = 0.02;
      return [
        center.lat - latMargin,
        center.lng - lngMargin,
        center.lat + latMargin,
        center.lng + lngMargin,
      ];
    }

    const minLat = Math.min(c1.lat, c2.lat);
    const maxLat = Math.max(c1.lat, c2.lat);
    const minLng = Math.min(c1.lng, c2.lng);
    const maxLng = Math.max(c1.lng, c2.lng);

    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;

    // Generous padding: 30% of route span, or at least ~1.5km to allow alternate paths
    const latMargin = Math.max(latSpan * 0.3, 0.015);
    const lngMargin = Math.max(lngSpan * 0.3, 0.02);

    return [
      minLat - latMargin,
      minLng - lngMargin,
      maxLat + latMargin,
      maxLng + lngMargin,
    ];
  };

  useEffect(() => {
    // Load custom settings
    loadCustomOverrides();
    
    // Auto-fetch map area matching default start/end pins on startup
    const initialBBox = calculateBoundingBox(startCoord, endCoord);
    handleFetchOSM(initialBBox, false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Monitor coordinate changes to dynamically expand loaded area
  useEffect(() => {
    if (!startCoord || !endCoord) return;
    if (loadedBBoxes.length === 0 || isFetchingOSM) return;

    const startInside = isInsideLoadedArea(startCoord);
    const endInside = isInsideLoadedArea(endCoord);

    if (!startInside || !endInside) {
      const newBBox = calculateBoundingBox(startCoord, endCoord);

      // Limit bounding box size to prevent Overpass query timeouts (max ~35km span)
      const maxLatSpan = 0.32;
      const maxLngSpan = 0.42;
      if (newBBox[2] - newBBox[0] > maxLatSpan || newBBox[3] - newBBox[1] > maxLngSpan) {
        console.warn('Auto-fetch map bounds exceeded limit parameters. Skipping auto-fetch.');
        return;
      }

      console.log('Coordinates changed outside current map bounds. Fetching expanded region:', newBBox);
      handleFetchOSM(newBBox, true, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCoord, endCoord, loadedBBoxes, isFetchingOSM]);

  // Handler for preset selections (forces coordinates update and downstream auto-fetch)
  const handlePresetChange = (preset: 'munich' | 'amsterdam') => {
    setSelectedPreset(preset);
    setStartCoord(null);
    setEndCoord(null);

    // Fetch fresh non-merged area for the new preset city center
    const center = preset === 'munich' ? { lat: 48.13715, lng: 11.5754 } : { lat: 52.3725, lng: 4.8900 };
    const latMargin = 0.015;
    const lngMargin = 0.02;
    const newBBox: [number, number, number, number] = [
      center.lat - latMargin,
      center.lng - lngMargin,
      center.lat + latMargin,
      center.lng + lngMargin,
    ];
    handleFetchOSM(newBBox, false, false);
  };

  // Handler to load OSM data as one moves through the map
  const handleMapBoundsChange = (viewportBBox: [number, number, number, number], zoom: number) => {
    if (zoom < 13 || isFetchingOSM) return;

    // Check if the current viewport is fully contained within our already loaded bounds
    const isContained = loadedBBoxes.some(bbox => {
      return (
        viewportBBox[0] >= bbox[0] &&
        viewportBBox[1] >= bbox[1] &&
        viewportBBox[2] <= bbox[2] &&
        viewportBBox[3] <= bbox[3]
      );
    });

    if (!isContained) {
      // Calculate a padded bounding box around the viewport to make queries less frequent
      const latSpan = viewportBBox[2] - viewportBBox[0];
      const lngSpan = viewportBBox[3] - viewportBBox[1];

      // Pad by 20% on all sides
      const paddedBBox: [number, number, number, number] = [
        viewportBBox[0] - latSpan * 0.2,
        viewportBBox[1] - lngSpan * 0.2,
        viewportBBox[2] + latSpan * 0.2,
        viewportBBox[3] + lngSpan * 0.2,
      ];

      console.log('Map moved to unloaded area. Fetching OSM data for viewport:', paddedBBox);
      handleFetchOSM(paddedBBox, true, true); // merge = true, silent = true
    }
  };

  // Helper to snap coordinates to the nearest edge if within 3 meters (house-pinning safety)
  const snapCoordinateToEdge = (coord: Coordinate): Coordinate => {
    if (!graph) return coord;
    const nearestEdge = findNearestEdge(graph, coord);
    if (nearestEdge && nearestEdge.distance < 3) {
      return nearestEdge.projected;
    }
    return coord;
  };

  const handleStartDrag = (coord: Coordinate) => {
    setStartCoord(snapCoordinateToEdge(coord));
  };

  const handleEndDrag = (coord: Coordinate) => {
    setEndCoord(snapCoordinateToEdge(coord));
  };

  // 5. Save and delete overrides handlers
  const handleSaveNodeOverride = async (nodeId: string, delay: number, notes: string) => {
    await storage.saveNodeDelay(nodeId, delay);
    await storage.saveNodeNotes(nodeId, notes);
    await loadCustomOverrides(); // Reload active states
  };

  const handleClearNodeOverride = async (nodeId: string) => {
    await storage.clearNodeOverrides(nodeId);
    await loadCustomOverrides(); // Reload active states
  };

  // Pack overrides together for the routing functions
  const currentOverrides: LocalOverrides = useMemo(() => {
    return {
      nodeDelays,
      nodeNotes,
      nodeTurns,
    };
  }, [nodeDelays, nodeNotes, nodeTurns]);

  // 6. Reactive Routing Calculation (Derived State)
  const routeResult = useMemo(() => {
    if (!graph || !startCoord || !endCoord) return null;

    // Pick active cost function based on strategy selected
    let costFn = standardCost;
    if (routingStrategy === 'avoid-stops') {
      costFn = avoidStoppingCost;
    } else if (routingStrategy === 'quiet-streets') {
      costFn = avoidBusyRoadsCost;
    }

    return router.findRoute(
      graph,
      startCoord,
      endCoord,
      costFn,
      currentOverrides
    );
  }, [graph, startCoord, endCoord, routingStrategy, currentOverrides]);

  return (
    <div className="app-container">
      <Sidebar
        startCoord={startCoord}
        endCoord={endCoord}
        routeResult={routeResult}
        routingStrategy={routingStrategy}
        isFetchingOSM={isFetchingOSM}
        onStrategyChange={setRoutingStrategy}
        selectedPreset={selectedPreset}
        onPresetChange={handlePresetChange}
        rulesConfig={rulesConfig}
        onRulesChange={setRulesConfig}
      />
      <MapView
        graph={graph}
        loadedBBoxes={loadedBBoxes}
        startCoord={startCoord}
        endCoord={endCoord}
        routeResult={routeResult}
        selectedPreset={selectedPreset}
        customNodeDelays={nodeDelays}
        customNodeNotes={nodeNotes}
        selectedNode={selectedNode}
        onStartDrag={handleStartDrag}
        onEndDrag={handleEndDrag}
        onNodeSelect={setSelectedNode}
        onSaveNodeOverride={handleSaveNodeOverride}
        onClearNodeOverride={handleClearNodeOverride}
        onMapBoundsChange={handleMapBoundsChange}
      />
    </div>
  );
}
