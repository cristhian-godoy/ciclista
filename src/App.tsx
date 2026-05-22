import { useState, useEffect, useMemo } from 'react';

import type { Coordinate, StreetGraph, GraphNode, LocalOverrides } from './core/types';
import { OSMGraphParser } from './core/graph/parser';
import { DijkstraRouter } from './core/router/router';
import { LocalStorageProvider } from './core/storage/storage';
import { standardCost, avoidStoppingCost, avoidBusyRoadsCost } from './core/router/cost';

import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';

// Instantiate core modules (fully decoupled from components)
const parser = new OSMGraphParser();
const router = new DijkstraRouter();
const storage = new LocalStorageProvider();

export default function App() {
  // 1. Core Coordinate Defaults (Munich center commute)
  const [startCoord, setStartCoord] = useState<Coordinate>({ lat: 48.13715, lng: 11.5754 });
  const [endCoord, setEndCoord] = useState<Coordinate>({ lat: 48.1350, lng: 11.5820 });

  // 2. State management
  const [graph, setGraph] = useState<StreetGraph | null>(null);
  const [loadedBBox, setLoadedBBox] = useState<[number, number, number, number] | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isFetchingOSM, setIsFetchingOSM] = useState<boolean>(false);
  const [routingStrategy, setRoutingStrategy] = useState<'standard' | 'avoid-stops' | 'quiet-streets'>('standard');

  // Custom node overrides state loaded from storage
  const [nodeDelays, setNodeDelays] = useState<Map<string, number>>(new Map());
  const [nodeNotes, setNodeNotes] = useState<Map<string, string>>(new Map());
  const [nodeTurns, setNodeTurns] = useState<Map<string, Record<string, unknown>>>(new Map());

  // 3. Load settings from storage on startup
  const loadCustomOverrides = async () => {
    const overrides = await storage.getOverrides();
    setNodeDelays(overrides.nodeDelays);
    setNodeNotes(overrides.nodeNotes);
    setNodeTurns(overrides.nodeTurns);
  };

  // 4. Overpass API fetching implementation
  const handleFetchOSM = async (bbox: [number, number, number, number], silent = false) => {
    setIsFetchingOSM(true);
    setSelectedNode(null); // Clear selected signal node
    setGraph(null); // Clear previous graph during load to prevent "phantom roads" from another city/preset
    setLoadedBBox(null);

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
      setGraph(parsedGraph);
      setLoadedBBox(bbox); // Track loaded bounding box region

      // Reset Start & End coords to the center of the bounding box
      const centerLat = (bbox[0] + bbox[2]) / 2;
      const centerLng = (bbox[1] + bbox[3]) / 2;
      setStartCoord({ lat: centerLat - 0.003, lng: centerLng - 0.003 });
      setEndCoord({ lat: centerLat + 0.003, lng: centerLng + 0.003 });
      
    } catch (e: unknown) {
      console.error('Failed to retrieve OSM network data:', e);
      
      if (graph === null) {
        console.warn('Using mock fallback graph due to initial fetch failure.');
        const mockGraph = parser.parse(null);
        setGraph(mockGraph);
        setLoadedBBox([48.134, 11.574, 48.144, 11.583]);
        // Restoring default mock coords
        setStartCoord({ lat: 48.13715, lng: 11.5754 });
        setEndCoord({ lat: 48.1350, lng: 11.5820 });
      } else {
        // Restore the previous valid graph and bounding box
        setGraph(graph);
        setLoadedBBox(loadedBBox);
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

  useEffect(() => {
    // Load custom settings
    loadCustomOverrides();
    
    // Auto-fetch real Munich network silently on startup
    handleFetchOSM([48.125, 11.555, 48.148, 11.595], true);
  }, []);

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
    if (!graph) return null;

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
        selectedNode={selectedNode}
        customNodeDelays={nodeDelays}
        customNodeNotes={nodeNotes}
        routingStrategy={routingStrategy}
        isFetchingOSM={isFetchingOSM}
        onStrategyChange={setRoutingStrategy}
        onFetchOSM={handleFetchOSM}
        onSaveNodeOverride={handleSaveNodeOverride}
        onClearNodeOverride={handleClearNodeOverride}
        onNodeSelect={setSelectedNode}
      />
      <MapView
        graph={graph}
        loadedBBox={loadedBBox}
        startCoord={startCoord}
        endCoord={endCoord}
        routeResult={routeResult}
        customNodeDelays={nodeDelays}
        onStartDrag={setStartCoord}
        onEndDrag={setEndCoord}
        onNodeSelect={setSelectedNode}
      />
    </div>
  );
}
