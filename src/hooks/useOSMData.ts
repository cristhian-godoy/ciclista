import { useEffect, useRef, useState } from 'react';

import { fetchWithCacheAndFallback } from '../core/api/overpass';
import { MAP_CONFIG } from '../core/common/constants';
import {
  calculateBoundingBox,
  getBBoxForGridCell,
  getGridCellsForBBox,
  isInsideLoadedArea,
} from '../core/common/geo';
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
  const [loadedCells, setLoadedCells] = useState<string[]>([]);
  const [isFetchingOSM, setIsFetchingOSM] = useState<boolean>(false);
  const boundsChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Get cells that intersect the requested bbox
    const intersectingCells = getGridCellsForBBox(bbox);

    // Identify which of these are not yet loaded
    const cellsToFetch = merge
      ? intersectingCells.filter((c) => !loadedCells.includes(`${c.latIdx}_${c.lngIdx}`))
      : intersectingCells;

    // If all cells are already loaded in memory, return early to save network / CPU
    if (cellsToFetch.length === 0) {
      logger.log('All requested grid cells are already loaded in memory.');
      return;
    }

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
      setLoadedCells([]);
    }

    try {
      logger.log(`Fetching ${cellsToFetch.length} grid cells sequentially from Overpass...`);

      const parsedGraphs: StreetGraph[] = [];
      for (const cell of cellsToFetch) {
        const cellBBox = getBBoxForGridCell(cell);
        // Standard, fast, optimized single-cell query conforming to original query structure
        const query = `/* Application: Ciclista Commuter Analyzer - Contact: https://github.com/cristhian-godoy/ciclista */
[out:json][timeout:25];(way["highway"]["highway"!~"motorway|motorway_link|proposed|construction|abandoned|steps"](${cellBBox[0]},${cellBBox[1]},${cellBBox[2]},${cellBBox[3]}););out body;>;out body qt;`;

        const data = await fetchWithCacheAndFallback(query);
        const elements =
          data && typeof data === 'object' && 'elements' in data
            ? (data as Record<string, unknown>).elements
            : null;
        const hasElements = Array.isArray(elements) && elements.length > 0;
        const parsed = hasElements ? parser.parse(data) : { nodes: new Map() };
        parsedGraphs.push(parsed);
      }

      // Merge all fetched graphs
      let combinedNewGraph = parsedGraphs[0];
      for (let i = 1; i < parsedGraphs.length; i++) {
        combinedNewGraph = mergeGraphs(combinedNewGraph, parsedGraphs[i]);
      }

      const newCellKeys = cellsToFetch.map((c) => `${c.latIdx}_${c.lngIdx}`);
      const newCellBBoxes = cellsToFetch.map(getBBoxForGridCell);

      if (merge) {
        setGraph((prev) => (prev ? mergeGraphs(prev, combinedNewGraph) : combinedNewGraph));
        setLoadedCells((prev) => [...prev, ...newCellKeys]);
        setLoadedBBoxes((prev) => [...prev, ...newCellBBoxes]);
      } else {
        setGraph(combinedNewGraph);
        setLoadedCells(newCellKeys);
        setLoadedBBoxes(newCellBBoxes);
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

  // Handler for preset selections
  const handlePresetChange = (preset: 'munich' | 'amsterdam') => {
    setSelectedPreset(preset);
    setLoadedCells([]); // Reset loaded cells cache

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

    if (boundsChangeTimeoutRef.current) {
      clearTimeout(boundsChangeTimeoutRef.current);
    }

    boundsChangeTimeoutRef.current = setTimeout(() => {
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
        // Find cells intersecting the viewport
        const cells = getGridCellsForBBox(viewportBBox);
        const unloaded = cells.filter((c) => !loadedCells.includes(`${c.latIdx}_${c.lngIdx}`));

        // If all intersecting cells are already loaded in memory, no need to trigger handleFetchOSM
        if (unloaded.length === 0) return;

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
