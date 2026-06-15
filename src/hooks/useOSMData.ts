import { useEffect, useRef, useState } from 'react';

import { fetchWithCacheAndFallback } from '../core/api/overpass';
import { API_CONFIG, MAP_CONFIG } from '../core/common/constants';
import { calculateBoundingBox, isInsideLoadedArea } from '../core/common/geo';
import { logger } from '../core/common/logger';
import type { Coordinate } from '../core/common/types';
import { OSMGraphParser } from '../core/graph/parser';
import type { GraphNode, StreetGraph } from '../core/graph/types';
import { mergeGraphs } from '../core/graph/utils';
import {
  getConnectionType,
  isCellularDownloadAllowed,
  isDataSaverActive,
  setCellularDownloadAllowed,
} from '../core/storage/dataUsage';

const parser = new OSMGraphParser();

interface UseOSMDataProps {
  startCoord: Coordinate | null;
  endCoord: Coordinate | null;
  setSelectedPreset: (preset: 'munich' | 'amsterdam') => void;
  setSelectedNode: (node: GraphNode | null) => void;
  onFetchFallback?: () => void;
}

/**
 * Hook to manage OSM fetching, loading bounds, and graph construction.
 */
export function useOSMData({
  startCoord,
  endCoord,
  setSelectedPreset,
  setSelectedNode,
  onFetchFallback,
}: UseOSMDataProps) {
  const [graph, setGraph] = useState<StreetGraph | null>(null);
  const [loadedBBoxes, setLoadedBBoxes] = useState<[number, number, number, number][]>([]);
  const [isFetchingOSM, setIsFetchingOSM] = useState<boolean>(false);
  const boundsChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedBBoxesRef = useRef<[number, number, number, number][]>([]);

  useEffect(() => {
    loadedBBoxesRef.current = loadedBBoxes;
  }, [loadedBBoxes]);

  useEffect(() => {
    return () => {
      if (boundsChangeTimeoutRef.current) {
        clearTimeout(boundsChangeTimeoutRef.current);
      }
    };
  }, []);

  // Overpass API fetching implementation
  const handleFetchOSM = async (
    bbox: [number, number, number, number],
    merge = false,
    silent = false,
  ) => {
    // Cellular data saving check
    if (getConnectionType() === 'cellular' && isDataSaverActive() && !isCellularDownloadAllowed()) {
      if (silent) {
        logger.log('Silent auto-fetch skipped to save cellular data (Data Saver active).');
        return;
      }
      const confirmed = window.confirm(
        'Ciclista is running on cellular data with Data Saver active. Loading the street network will use mobile data. Do you want to download?',
      );
      if (!confirmed) {
        if (graph === null && !merge) {
          logger.warn('Initial download declined. Loading mock fallback graph.');
          const mockGraph = parser.parse(null);
          setGraph(mockGraph);
          setLoadedBBoxes([[48.134, 11.574, 48.144, 11.583]]);
        }
        return;
      }
      setCellularDownloadAllowed(true);
    }

    setIsFetchingOSM(true);
    if (!merge) {
      setSelectedNode(null); // Clear selected signal node
      setGraph(null); // Clear previous graph during load to prevent "phantom roads"
      setLoadedBBoxes([]);
    }

    try {
      // Standard, fast, optimized bounding box query.
      // DESIGN DECISIONS & OPTIMIZATIONS:
      // 1. Bandwidth Savings: By fetching ways with 'out geom' (inline geometries) and requesting
      //    only tagged nodes of interest, the node payload drops from 6,000+ to ~500 nodes per viewport.
      //    Untagged nodes are resolved directly from way geometry, saving 75-80% of data.
      // 2. Path Filtering: Motorways, trunks, proposed, construction, and steps are blacklisted.
      //    General access 'no' and 'private' are blacklisted. We do not blacklist 'bicycle=no' because
      //    cyclists can legally push or dismount their bikes on footways/pedestrian areas.
      // 3. Node Filtering: Keeps only nodes representing controls (traffic signals, stops, yields, crossings),
      //    micro-frictions (bollards, cycle barriers, gates, blocks, kerbs), and railway tram crossings.
      const query = `/* Application: Ciclista Commuter Analyzer - Contact: https://github.com/cristhian-godoy/ciclista */
[out:json][timeout:${API_CONFIG.QUERY_TIMEOUT_SECONDS}];
way["highway"]["highway"!~"motorway|motorway_link|trunk|trunk_link|proposed|construction|abandoned|steps"]
   ["access"!~"no|private"]
   (${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]})->.ways;
(.ways;);
out geom;
(
  node(w.ways)["highway"~"traffic_signals|stop|give_way|crossing"];
  node(w.ways)["crossing"];
  node(w.ways)["barrier"~"bollard|cycle_barrier|gate|block|kerb"];
  node(w.ways)["railway"~"tram_crossing|tram_level_crossing"];
);
out body;`;

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
        if (onFetchFallback) {
          onFetchFallback();
        }
      } else {
        // Restore the previous valid graph
        setGraph(graph);
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
      const timer = setTimeout(() => {
        handleFetchOSM(newBBox, true, false);
      }, 0);
      return () => {
        clearTimeout(timer);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCoord, endCoord, loadedBBoxes, isFetchingOSM]);

  // Handler for preset selections
  const handlePresetChange = (preset: 'munich' | 'amsterdam') => {
    setSelectedPreset(preset);
    // Clear graph and loaded bounds. Once the map transitions to the new center,
    // the map's moveend event will automatically trigger dynamic fetch of the viewport.
    setGraph(null);
    setLoadedBBoxes([]);
  };

  // Handler to load OSM data as one moves through the map
  const handleMapBoundsChange = (viewportBBox: [number, number, number, number], zoom: number) => {
    if (zoom < 13 || isFetchingOSM) return;

    if (boundsChangeTimeoutRef.current) {
      clearTimeout(boundsChangeTimeoutRef.current);
    }

    boundsChangeTimeoutRef.current = setTimeout(() => {
      // Check if the current viewport is fully contained within our already loaded bounds
      const isContained = loadedBBoxesRef.current.some((bbox) => {
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
    }, 1000);
  };

  return {
    graph,
    loadedBBoxes,
    isFetchingOSM,
    handlePresetChange,
    handleMapBoundsChange,
  };
}
