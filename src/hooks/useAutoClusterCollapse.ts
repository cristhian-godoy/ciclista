import type * as maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

import { haversineDistance } from '../core/common/geo';
import type { StreetGraph } from '../core/graph/types';

/**
 * Options for useAutoClusterCollapse hook.
 */
export interface UseAutoClusterCollapseOptions {
  /** MapLibre map instance */
  map?: maplibregl.Map | null;
  /** ID of active crossing cluster */
  managedClusterId?: string | null;
  /** IDs of nodes participating in the active crossing cluster */
  managedNodeIds?: string[];
  /** Street network graph */
  graph?: StreetGraph | null;
  /** Callback to clear or update the active cluster ID */
  setManagedClusterId?: (clusterId: string | null) => void;
  /** Callback to clear or update active node IDs */
  setManagedNodeIds?:
    React.Dispatch<React.SetStateAction<string[]>> | ((nodeIds: string[]) => void);
}

/**
 * Hook to automatically collapse expanded crossing clusters when zooming out
 * below threshold (< 15.5) or panning farther than 450 meters from centroid.
 */
export function useAutoClusterCollapse({
  map,
  managedClusterId,
  managedNodeIds = [],
  graph,
  setManagedClusterId,
  setManagedNodeIds,
}: UseAutoClusterCollapseOptions): void {
  const graphRef = useRef(graph);
  const setManagedClusterIdRef = useRef(setManagedClusterId);
  const setManagedNodeIdsRef = useRef(setManagedNodeIds);

  useEffect(() => {
    graphRef.current = graph;
    setManagedClusterIdRef.current = setManagedClusterId;
    setManagedNodeIdsRef.current = setManagedNodeIds;
  }, [graph, setManagedClusterId, setManagedNodeIds]);

  useEffect(() => {
    if (!map || !managedClusterId || managedNodeIds.length === 0) return;

    let clusterLat = 0;
    let clusterLng = 0;
    let foundCount = 0;

    const currentGraph = graphRef.current;
    if (currentGraph) {
      for (const id of managedNodeIds) {
        const nodeEntry = currentGraph.nodes.get(id);
        if (nodeEntry) {
          clusterLat += nodeEntry.node.lat;
          clusterLng += nodeEntry.node.lng;
          foundCount++;
        }
      }
    }

    if (foundCount > 0) {
      clusterLat /= foundCount;
      clusterLng /= foundCount;
    }

    const checkClusterProximity = () => {
      // Check zoom threshold (below 15.5)
      if (typeof map.getZoom === 'function') {
        const currentZoom = map.getZoom();
        if (currentZoom < 15.5) {
          setManagedClusterIdRef.current?.(null);
          setManagedNodeIdsRef.current?.([]);
          return;
        }
      }

      // Check distance threshold if cluster coordinates are resolved
      if (foundCount > 0 && typeof map.getCenter === 'function') {
        const center = map.getCenter();
        if (center && typeof center.lat === 'number' && typeof center.lng === 'number') {
          const dist = haversineDistance(center.lat, center.lng, clusterLat, clusterLng);
          // If camera center has panned farther than 450 meters away from the crossing
          if (dist > 450) {
            setManagedClusterIdRef.current?.(null);
            setManagedNodeIdsRef.current?.([]);
          }
        }
      }
    };

    if (typeof map.on === 'function') {
      map.on('moveend', checkClusterProximity);
    }

    return () => {
      if (typeof map.off === 'function') {
        map.off('moveend', checkClusterProximity);
      }
    };
  }, [map, managedClusterId, managedNodeIds, graph]);
}
