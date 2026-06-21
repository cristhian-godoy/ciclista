import { useEffect, useRef, useState } from 'react';

import { OSMCacheReader } from '../core/api/OSMCacheReader';
import { OSMNetworkQueue } from '../core/api/OSMNetworkQueue';
import { MAP_CONFIG } from '../core/common/constants';
import {
  calculateBoundingBox,
  getChunkBBox,
  getChunksInBBox,
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
  const [loadedChunkIds, setLoadedChunkIds] = useState<Set<string>>(new Set());
  const [isFetchingOSM, setIsFetchingOSM] = useState<boolean>(false);
  const boundsChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (boundsChangeTimeoutRef.current) {
        clearTimeout(boundsChangeTimeoutRef.current);
      }
    };
  }, []);

  // Listen to the network queue status and data events
  useEffect(() => {
    const handleQueueStatus = (fetching: boolean) => {
      setIsFetchingOSM(fetching);
    };

    const handleQueueData = (result: { graph: StreetGraph; loadedChunkIds: string[] }) => {
      setGraph((prev) => (prev ? mergeGraphs(prev, result.graph) : result.graph));
      setLoadedChunkIds((prev) => {
        const next = new Set(prev);
        result.loadedChunkIds.forEach((id) => next.add(id));
        return next;
      });
      setLoadedBBoxes((prev) => {
        const next = [...prev];
        result.loadedChunkIds.forEach((id) => {
          const chunkBBox = getChunkBBox(id);
          if (!prev.some((b) => b[0] === chunkBBox[0] && b[1] === chunkBBox[1])) {
            next.push(chunkBBox);
          }
        });
        return next;
      });
    };

    const handleQueueError = (err: unknown) => {
      logger.error('Error in OSM network queue:', err);
    };

    OSMNetworkQueue.addStatusListener(handleQueueStatus);
    OSMNetworkQueue.addDataListener(handleQueueData);
    OSMNetworkQueue.addErrorListener(handleQueueError);

    return () => {
      OSMNetworkQueue.removeStatusListener(handleQueueStatus);
      OSMNetworkQueue.removeDataListener(handleQueueData);
      OSMNetworkQueue.removeErrorListener(handleQueueError);
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
          const fallbackBBox: [number, number, number, number] = [48.134, 11.574, 48.144, 11.583];
          setLoadedBBoxes([fallbackBBox]);
          setLoadedChunkIds(new Set(getChunksInBBox(fallbackBBox)));
        }
        return;
      }
      setCellularDownloadAllowed(true);
    }

    if (!merge) {
      setSelectedNode(null); // Clear selected signal node
      setGraph(null); // Clear previous graph during load to prevent "phantom roads"
      setLoadedBBoxes([]);
      setLoadedChunkIds(new Set());
    }

    const requiredChunks = getChunksInBBox(bbox);
    if (requiredChunks.length === 0) {
      if (!merge) {
        setGraph({ nodes: new Map() });
      }
      return;
    }

    const activeChunks = merge ? loadedChunkIds : new Set<string>();
    const neededChunks = requiredChunks.filter((chunkId) => !activeChunks.has(chunkId));
    if (neededChunks.length === 0) {
      return;
    }

    try {
      // 1. Immediately resolve cached chunks
      const cacheResult = await OSMCacheReader.readChunks(neededChunks);
      if (cacheResult.graph) {
        setGraph((prev) => (prev ? mergeGraphs(prev, cacheResult.graph!) : cacheResult.graph));
        setLoadedChunkIds((prev) => {
          const next = new Set(prev);
          cacheResult.loadedChunkIds.forEach((id) => next.add(id));
          return next;
        });
        setLoadedBBoxes((prev) => {
          const next = [...prev];
          cacheResult.loadedChunkIds.forEach((id) => {
            const chunkBBox = getChunkBBox(id);
            if (!prev.some((b) => b[0] === chunkBBox[0] && b[1] === chunkBBox[1])) {
              next.push(chunkBBox);
            }
          });
          return next;
        });
      }

      // 2. Queue remaining missing chunks for network fetching after 500ms debounce
      if (cacheResult.missingChunkIds.length > 0) {
        if (boundsChangeTimeoutRef.current) {
          clearTimeout(boundsChangeTimeoutRef.current);
        }
        boundsChangeTimeoutRef.current = setTimeout(() => {
          logger.log('Queueing missing chunks for network fetch:', cacheResult.missingChunkIds);
          OSMNetworkQueue.enqueue(cacheResult.missingChunkIds);
        }, 500);
      } else if (!merge && !cacheResult.graph) {
        setGraph({ nodes: new Map() });
      }
    } catch (e: unknown) {
      logger.error('Failed to retrieve cached/network OSM data:', e);

      if (graph === null && !merge) {
        logger.warn('Using mock fallback graph due to initial fetch failure.');
        const mockGraph = parser.parse(null);
        setGraph(mockGraph);
        const fallbackBBox: [number, number, number, number] = [48.134, 11.574, 48.144, 11.583];
        setLoadedBBoxes([fallbackBBox]);
        setLoadedChunkIds(new Set(getChunksInBBox(fallbackBBox)));
        if (onFetchFallback) {
          onFetchFallback();
        }
      } else {
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
    }
  };

  // Monitor coordinate changes to dynamically expand loaded area
  useEffect(() => {
    if (!startCoord || !endCoord) return;
    if (loadedBBoxes.length === 0) return;

    const startInside = isInsideLoadedArea(startCoord, loadedBBoxes);
    const endInside = isInsideLoadedArea(endCoord, loadedBBoxes);

    if (!startInside || !endInside) {
      const newBBox = calculateBoundingBox(startCoord, endCoord);

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
  }, [startCoord, endCoord, loadedBBoxes]);

  // Handler for preset selections
  const handlePresetChange = (preset: 'munich' | 'amsterdam') => {
    setSelectedPreset(preset);
    setGraph(null);
    setLoadedBBoxes([]);
    setLoadedChunkIds(new Set());
  };

  // Handler to load OSM data as one moves through the map
  const handleMapBoundsChange = (viewportBBox: [number, number, number, number], zoom: number) => {
    if (zoom < 13) return;

    logger.log('Map moved. Checking for immediate cached load or debounced network fetch.');
    handleFetchOSM(viewportBBox, true, true);
  };

  return {
    graph,
    loadedBBoxes,
    isFetchingOSM,
    handlePresetChange,
    handleMapBoundsChange,
  };
}
