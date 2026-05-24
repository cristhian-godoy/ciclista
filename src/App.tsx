import { useState, useEffect, useMemo } from 'react';

import type { Coordinate } from './core/common/types';
import type { StreetGraph, GraphNode } from './core/graph/types';
import type { LocalOverrides, BikeProfile } from './core/storage/types';
import type { RulesConfiguration, RouteAlternative } from './core/router/types';
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
      const targets = new Set(existing.edges.map((e) => e.target));
      const newEdges = val.edges.filter((e) => !targets.has(e.target));
      existing.edges.push(...newEdges);
    } else {
      merged.nodes.set(key, val);
    }
  });
  return merged;
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

  // Custom node overrides state loaded from storage
  const [nodeDelays, setNodeDelays] = useState<Map<string, number>>(new Map());
  const [nodeNotes, setNodeNotes] = useState<Map<string, string>>(new Map());
  const [nodeTurns, setNodeTurns] = useState<Map<string, Record<string, unknown>>>(new Map());
  const [rulesConfig, setRulesConfig] = useState<RulesConfiguration>(() => {
    const saved = storage.loadRulesConfig();
    if (!saved) return DEFAULT_RULES_CONFIG;

    // Deep merge signs and roads to gracefully handle schema upgrades (e.g. comfort field).
    const mergedSigns = { ...DEFAULT_RULES_CONFIG.signs };
    if (saved.signs) {
      for (const k of Object.keys(saved.signs) as Array<keyof typeof saved.signs>) {
        if (mergedSigns[k]) {
          mergedSigns[k] = { ...mergedSigns[k], ...saved.signs[k] };
        }
      }
    }

    const mergedRoads = { ...DEFAULT_RULES_CONFIG.roads };
    if (saved.roads) {
      for (const k of Object.keys(saved.roads) as Array<keyof typeof saved.roads>) {
        if (mergedRoads[k]) {
          mergedRoads[k] = { ...mergedRoads[k], ...saved.roads[k] };
        }
      }
    }

    return {
      ...DEFAULT_RULES_CONFIG,
      ...saved,
      signs: mergedSigns,
      roads: mergedRoads,
      nodeDelays: { ...DEFAULT_RULES_CONFIG.nodeDelays, ...(saved.nodeDelays ?? {}) },
    };
  });
  const [bikeProfile, setBikeProfile] = useState<BikeProfile>('normal');

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
    return loadedBBoxes.some((bbox) => {
      const [minLat, minLng, maxLat, maxLng] = bbox;
      return (
        coord.lat >= minLat && coord.lat <= maxLat && coord.lng >= minLng && coord.lng <= maxLng
      );
    });
  };

  const OVERPASS_MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
  ];

  const CACHE_NAME = 'overpass-cache-v1';

  async function fetchWithCacheAndFallback(query: string): Promise<unknown> {
    const cacheKey = new Request(
      `https://overpass-interpreter-cache/?query=${encodeURIComponent(query)}`,
    );

    // Try loading from client-side CacheStorage
    try {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        console.log('Serving Overpass query from client-side CacheStorage.');
        return await cachedResponse.json();
      }
    } catch (e) {
      console.warn('CacheStorage not available or query matching failed:', e);
    }

    // Iterate over available public mirrors to fetch the data
    let lastError: Error | null = null;
    for (const baseUrl of OVERPASS_MIRRORS) {
      try {
        const url = `${baseUrl}?data=${encodeURIComponent(query)}`;
        console.log(`Fetching Overpass query from mirror: ${baseUrl}`);
        const response = await fetch(url);

        if (response.status === 429) {
          throw new Error(`Mirror ${baseUrl} returned HTTP 429 Too Many Requests (Rate Limited).`);
        }
        if (!response.ok) {
          throw new Error(`Mirror ${baseUrl} returned error status: ${response.status}`);
        }

        const data = await response.json();

        // Put successful response into client-side CacheStorage
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(
            cacheKey,
            new Response(JSON.stringify(data), {
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        } catch (cacheErr) {
          console.warn('Failed to cache successful Overpass response:', cacheErr);
        }

        return data;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.warn(`Failed to fetch from ${baseUrl}:`, errorMsg);
        lastError = err instanceof Error ? err : new Error(errorMsg);
      }
    }

    throw lastError || new Error('All Overpass mirrors failed or returned rate limits.');
  }

  // 4. Overpass API fetching implementation
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
      console.error('Failed to retrieve OSM network data:', e);

      if (graph === null && !merge) {
        console.warn('Using mock fallback graph due to initial fetch failure.');
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

  // Helper to compute a bounding box enclosing two coordinates with padding
  const calculateBoundingBox = (
    c1: Coordinate | null,
    c2: Coordinate | null,
  ): [number, number, number, number] => {
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

    return [minLat - latMargin, minLng - lngMargin, maxLat + latMargin, maxLng + lngMargin];
  };

  useEffect(() => {
    setTimeout(() => {
      // Load custom settings
      loadCustomOverrides();

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

      console.log(
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
    const center =
      preset === 'munich' ? { lat: 48.13715, lng: 11.5754 } : { lat: 52.3725, lng: 4.89 };
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

  const handleStartDrag = (coord: Coordinate | null) => {
    setStartCoord(coord ? snapCoordinateToEdge(coord) : null);
  };

  const handleEndDrag = (coord: Coordinate | null) => {
    setEndCoord(coord ? snapCoordinateToEdge(coord) : null);
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
      rulesConfig,
      bikeProfile,
    };
  }, [nodeDelays, nodeNotes, nodeTurns, rulesConfig, bikeProfile]);

  // 6. Reactive Routing Calculation (Derived State)
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
