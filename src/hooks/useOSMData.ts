import { useEffect, useState } from 'react';

import { fetchWithCacheAndFallback } from '../core/api/overpass';
import { MAP_CONFIG } from '../core/common/constants';
import { calculateBoundingBox, isInsideLoadedArea } from '../core/common/geo';
import { logger } from '../core/common/logger';
import type { Coordinate } from '../core/common/types';
import { OSMGraphParser } from '../core/graph/parser';
import type { GraphNode, StreetGraph } from '../core/graph/types';
import { mergeGraphs } from '../core/graph/utils';

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

  // Overpass API fetching implementation
  const handleFetchOSM = async (
    bbox: [number, number, number, number],
    merge = false,
    silent = false,
  ) => {
    setIsFetchingOSM(true);
    if (!merge) {
      setSelectedNode(null); // Clear selected signal node
      setGraph(null); // Clear previous graph during load to prevent "phantom roads"
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
        if (onFetchFallback) {
          onFetchFallback();
        }
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

  // Handler for preset selections
  const handlePresetChange = (preset: 'munich' | 'amsterdam') => {
    setSelectedPreset(preset);

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

  return {
    graph,
    loadedBBoxes,
    isFetchingOSM,
    handlePresetChange,
    handleMapBoundsChange,
  };
}
