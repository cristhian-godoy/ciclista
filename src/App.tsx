import { useState, useEffect, useMemo } from 'react';

import type { Coordinate, StreetGraph, RouteResult, GraphNode, LocalOverrides } from './core/types';
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
  // 1. Core Coordinate Defaults (Amsterdam center commute)
  const [startCoord, setStartCoord] = useState<Coordinate>({ lat: 52.3702, lng: 4.8952 });
  const [endCoord, setEndCoord] = useState<Coordinate>({ lat: 52.3725, lng: 4.9015 });

  // 2. State management
  const [graph, setGraph] = useState<StreetGraph | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isFetchingOSM, setIsFetchingOSM] = useState<boolean>(false);
  const [routingStrategy, setRoutingStrategy] = useState<'standard' | 'avoid-stops' | 'quiet-streets'>('standard');

  // Custom node overrides state loaded from storage
  const [nodeDelays, setNodeDelays] = useState<Map<string, number>>(new Map());
  const [nodeNotes, setNodeNotes] = useState<Map<string, string>>(new Map());
  const [nodeTurns, setNodeTurns] = useState<Map<string, Record<string, any>>>(new Map());

  // 3. Load settings from storage on startup
  const loadCustomOverrides = async () => {
    const overrides = await storage.getOverrides();
    setNodeDelays(overrides.nodeDelays);
    setNodeNotes(overrides.nodeNotes);
    setNodeTurns(overrides.nodeTurns);
  };

  useEffect(() => {
    // Load custom settings
    loadCustomOverrides();
    // Load default mock graph initially
    const mockGraph = parser.parse(null);
    setGraph(mockGraph);
  }, []);

  // Pack overrides together for the routing functions
  const currentOverrides: LocalOverrides = useMemo(() => {
    return {
      nodeDelays,
      nodeNotes,
      nodeTurns,
    };
  }, [nodeDelays, nodeNotes, nodeTurns]);

  // 4. Overpass API fetching implementation
  const handleFetchOSM = async (bbox: [number, number, number, number]) => {
    setIsFetchingOSM(true);
    setSelectedNode(null); // Clear selected signal node
    try {
      // Overpass QL query template for bikeable paths (highways) within bounding box
      const query = `[out:json][timeout:25];(way["highway"](${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}););out body;>;out skel qt;`;
      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Overpass API server returned error status: ${response.status}`);
      }

      const data = await response.json();
      const parsedGraph = parser.parse(data);
      setGraph(parsedGraph);

      // Reset Start & End coords to the center of the bounding box
      const centerLat = (bbox[0] + bbox[2]) / 2;
      const centerLng = (bbox[1] + bbox[3]) / 2;
      setStartCoord({ lat: centerLat - 0.003, lng: centerLng - 0.003 });
      setEndCoord({ lat: centerLat + 0.003, lng: centerLng + 0.003 });
      
    } catch (e: any) {
      console.error('Failed to retrieve OSM network data:', e);
      alert(`Error fetching map area: ${e.message}. Please check bounding box values.`);
    } finally {
      setIsFetchingOSM(false);
    }
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

  // 6. Reactive Routing Calculation
  useEffect(() => {
    if (!graph) return;

    // Pick active cost function based on strategy selected
    let costFn = standardCost;
    if (routingStrategy === 'avoid-stops') {
      costFn = avoidStoppingCost;
    } else if (routingStrategy === 'quiet-streets') {
      costFn = avoidBusyRoadsCost;
    }

    const route = router.findRoute(
      graph,
      startCoord,
      endCoord,
      costFn,
      currentOverrides
    );

    setRouteResult(route);
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
