import { useState, useEffect, useMemo } from 'react';

import type { Coordinate } from './core/common/types';
import type { StreetGraph, GraphNode } from './core/graph/types';
import type { RouteAlternative } from './core/router/types';
import { OSMGraphParser } from './core/graph/parser';
import { DijkstraRouter } from './core/router/router';
import { standardCost, avoidStoppingCost, avoidBusyRoadsCost } from './core/router/cost';
import { fetchWithCacheAndFallback } from './core/api/overpass';
import { calculateBoundingBox, isInsideLoadedArea, snapCoordinateToEdge } from './core/common/geo';
import { useOverrides } from './hooks/useOverrides';
import { MAP_CONFIG } from './core/common/constants';
import { logger } from './core/common/logger';

import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';

// Instantiate core modules (fully decoupled from components)
const parser = new OSMGraphParser();
const router = new DijkstraRouter();

const mergeGraphs = (g1: StreetGraph, g2: StreetGraph): StreetGraph => {
  const mergedNodes = new Map(g1.nodes);

  for (const [key, val] of g2.nodes.entries()) {
    const existing = mergedNodes.get(key);
    if (existing) {
      const targets = new Set<string>();
      const existingEdges = existing.edges;
      for (let i = 0; i < existingEdges.length; i++) {
        targets.add(existingEdges[i].target);
      }

      const newEdges = val.edges.filter((e) => !targets.has(e.target));
      if (newEdges.length > 0) {
        mergedNodes.set(key, {
          ...existing,
          edges: [...existingEdges, ...newEdges],
        });
      }
    } else {
      mergedNodes.set(key, val);
    }
  }
  return { nodes: mergedNodes };
};

export default function App() {
  // 1. Core Coordinate Defaults (initially null for a clean pinless map startup)
  const [startCoord, setStartCoord] = useState<Coordinate | null>(null);
  const [endCoord, setEndCoord] = useState<Coordinate | null>(null);

  // 2. State management
  const [graph, setGraph] = useState<StreetGraph | null>(null);
  const [loadedBBoxes, setLoadedBBoxes] = useState<[number, number, number, number][]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isFetchingOSM, setIsFetchingOSM] = useState<boolean>(false);
  const [routingStrategy, setRoutingStrategy] = useState<
    'standard' | 'avoid-stops' | 'quiet-streets'
  >('standard');
  const [selectedPreset, setSelectedPreset] = useState<'munich' | 'amsterdam'>('munich');

  // Load custom storage overrides state and rules config using the custom hook
  const {
    nodeDelays,
    nodeNotes,
    rulesConfig,
    setRulesConfig,
    bikeProfile,
    setBikeProfile,
    currentOverrides,
    handleSaveNodeOverride,
    handleClearNodeOverride,
  } = useOverrides();

  // 3. Overpass API fetching implementation
  const handleFetchOSM = async (
    bbox: [number, number, number, number],
    merge = false,
    silent = false,
  ) => {
    setIsFetchingOSM(true);
    if (!merge) {
      setSelectedNode(null); // Clear selected signal node
      setGraph(null); // Clear previous graph during load to prevent "phantom roads" from another city/preset
      setLoadedBBoxes([]);
    }

    try {
      // Overpass QL query template for bikeable paths (highways) within bounding box
      const query = `[out:json][timeout:25];(way["highway"](${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}););out body;>;out body qt;`;

      const data = await fetchWithCacheAndFallback(query);
      const parsedGraph = parser.parse(data);
      if (merge) {
        setGraph((prev) => (prev ? mergeGraphs(prev, parsedGraph) : parsedGraph));
        setLoadedBBoxes((prev) => [...prev, bbox]);
      } else {
        setGraph(parsedGraph);
        setLoadedBBoxes([bbox]);
      }
    } catch (e: unknown) {
      logger.error('Failed to retrieve OSM network data:', e);

      if (graph === null && !merge) {
        logger.warn('Using mock fallback graph due to initial fetch failure.');
        const mockGraph = parser.parse(null);
        setGraph(mockGraph);
        setLoadedBBoxes([[48.134, 11.574, 48.144, 11.583]]);
        // Keep coordinates null or cleared in case of fallback graph
        setStartCoord(null);
        setEndCoord(null);
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
          }`,
        );
      }
    } finally {
      setIsFetchingOSM(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      // Auto-fetch map area matching default start/end pins on startup
      const initialBBox = calculateBoundingBox(startCoord, endCoord);
      handleFetchOSM(initialBBox, false, true);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Monitor coordinate changes to dynamically expand loaded area
  useEffect(() => {
    if (!startCoord || !endCoord) return;
    if (loadedBBoxes.length === 0 || isFetchingOSM) return;

    const startInside = isInsideLoadedArea(startCoord, loadedBBoxes);
    const endInside = isInsideLoadedArea(endCoord, loadedBBoxes);

    if (!startInside || !endInside) {
      const newBBox = calculateBoundingBox(startCoord, endCoord);

      // Limit bounding box size to prevent Overpass query timeouts (max ~35km span)
      if (
        newBBox[2] - newBBox[0] > MAP_CONFIG.MAX_LAT_SPAN ||
        newBBox[3] - newBBox[1] > MAP_CONFIG.MAX_LNG_SPAN
      ) {
        logger.warn('Auto-fetch map bounds exceeded limit parameters. Skipping auto-fetch.');
        return;
      }

      logger.log(
        'Coordinates changed outside current map bounds. Fetching expanded region:',
        newBBox,
      );
      setTimeout(() => {
        handleFetchOSM(newBBox, true, false);
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCoord, endCoord, loadedBBoxes, isFetchingOSM]);

  // Handler for preset selections (clears coordinates and forces downstream auto-fetch for the new city center)
  const handlePresetChange = (preset: 'munich' | 'amsterdam') => {
    setSelectedPreset(preset);
    setStartCoord(null);
    setEndCoord(null);

    // Fetch fresh non-merged area for the new preset city center
    const presetConfig = MAP_CONFIG.PRESETS[preset];
    const newBBox: [number, number, number, number] = [
      presetConfig.center.lat - presetConfig.latMargin,
      presetConfig.center.lng - presetConfig.lngMargin,
      presetConfig.center.lat + presetConfig.latMargin,
      presetConfig.center.lng + presetConfig.lngMargin,
    ];
    handleFetchOSM(newBBox, false, false);
  };

  // Handler to load OSM data as one moves through the map
  const handleMapBoundsChange = (viewportBBox: [number, number, number, number], zoom: number) => {
    if (zoom < 13 || isFetchingOSM) return;

    // Check if the current viewport is fully contained within our already loaded bounds
    const isContained = loadedBBoxes.some((bbox) => {
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

      logger.log('Map moved to unloaded area. Fetching OSM data for viewport:', paddedBBox);
      handleFetchOSM(paddedBBox, true, true); // merge = true, silent = true
    }
  };

  const handleStartDrag = (coord: Coordinate | null) => {
    setStartCoord(coord ? snapCoordinateToEdge(coord, graph) : null);
  };

  const handleEndDrag = (coord: Coordinate | null) => {
    setEndCoord(coord ? snapCoordinateToEdge(coord, graph) : null);
  };

  // 4. Reactive Routing Calculation (Derived State)
  const routeAlternatives = useMemo<RouteAlternative[]>(() => {
    if (!graph || !startCoord || !endCoord) return [];

    const standardResult = router.findRoute(
      graph,
      startCoord,
      endCoord,
      standardCost,
      currentOverrides,
    );
    const avoidStopsResult = router.findRoute(
      graph,
      startCoord,
      endCoord,
      avoidStoppingCost,
      currentOverrides,
    );
    const quietResult = router.findRoute(
      graph,
      startCoord,
      endCoord,
      avoidBusyRoadsCost,
      currentOverrides,
    );

    const alts: RouteAlternative[] = [];
    if (standardResult) {
      alts.push({ label: 'standard', result: standardResult });
    }
    if (avoidStopsResult) {
      alts.push({ label: 'avoid-stops', result: avoidStopsResult });
    }
    if (quietResult) {
      alts.push({ label: 'quiet-streets', result: quietResult });
    }
    return alts;
  }, [graph, startCoord, endCoord, currentOverrides]);

  const routeResult = useMemo(() => {
    const active = routeAlternatives.find((alt) => alt.label === routingStrategy);
    return active ? active.result : null;
  }, [routeAlternatives, routingStrategy]);

  return (
    <div className="app-container">
      <Sidebar
        startCoord={startCoord}
        endCoord={endCoord}
        routeResult={routeResult}
        routeAlternatives={routeAlternatives}
        routingStrategy={routingStrategy}
        isFetchingOSM={isFetchingOSM}
        onStrategyChange={setRoutingStrategy}
        selectedPreset={selectedPreset}
        onPresetChange={handlePresetChange}
        rulesConfig={rulesConfig}
        onRulesChange={setRulesConfig}
        bikeProfile={bikeProfile}
        onBikeProfileChange={setBikeProfile}
      />
      <MapView
        graph={graph}
        loadedBBoxes={loadedBBoxes}
        startCoord={startCoord}
        endCoord={endCoord}
        routeAlternatives={routeAlternatives}
        activeAlternativeLabel={routingStrategy}
        onSelectAlternative={setRoutingStrategy}
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
