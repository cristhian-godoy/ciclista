import { useMemo } from 'react';

import {
  buildCrossingSubgraph,
  type CrossingCluster,
  type CrossingSubgraph,
  extractCrossingClusters,
  findCrossingTurnPath,
} from '../core/graph/crossing';
import type { StreetGraph } from '../core/graph/types';

/**
 * Options for configuring crossing editor data extraction.
 */
export interface UseCrossingEditorDataOptions {
  /** The active street graph */
  graph: StreetGraph | null;
  /** Optional custom node delay values */
  customNodeDelays?: Map<string, number>;
  /** Whether minor controls (stop/yield/pedestrian) are enabled */
  showMinorControls?: boolean;
  /** Currently selected crossing identifier */
  activeCrossingId?: string | null;
  /** Active turn selection endpoints and waypoints */
  activeTurnSelection?: {
    fromNodeId: string | null;
    toNodeId: string | null;
    waypointNodeIds: string[];
  };
  /** Whether crossing data calculations are enabled */
  enabled?: boolean;
}

/**
 * Result structure providing crossing clusters, active subgraph, and computed turn paths.
 */
export interface UseCrossingEditorDataResult {
  /** All extracted crossing clusters in the graph */
  clusters: CrossingCluster[];
  /** The currently active crossing cluster */
  activeCluster: CrossingCluster | null;
  /** Subgraph extracted for the active cluster */
  crossingSubgraph: CrossingSubgraph | null;
  /** Path node IDs resolved for active from/to/waypoint turn selection */
  computedTurnPath: string[] | null;
}

/**
 * Custom React hook that extracts crossing clusters, resolves active subgraphs,
 * and computes crossing turn paths.
 *
 * @param options - Configuration options for crossing graph extraction.
 * @returns Object containing clusters, active cluster, subgraph, and computed turn path.
 */
export function useCrossingEditorData({
  graph,
  customNodeDelays,
  showMinorControls = true,
  activeCrossingId = null,
  activeTurnSelection,
  enabled = true,
}: UseCrossingEditorDataOptions): UseCrossingEditorDataResult {
  const clusters = useMemo(() => {
    if (!graph || !enabled) return [];
    return extractCrossingClusters(graph, customNodeDelays, showMinorControls);
  }, [graph, enabled, customNodeDelays, showMinorControls]);

  const activeCluster = useMemo(() => {
    if (!activeCrossingId || !enabled) return null;
    return clusters.find((c) => c.id === activeCrossingId) ?? null;
  }, [clusters, activeCrossingId, enabled]);

  const crossingSubgraph = useMemo(() => {
    if (!graph || !activeCluster) return null;
    return buildCrossingSubgraph(graph, activeCluster);
  }, [graph, activeCluster]);

  const fromNodeId = activeTurnSelection?.fromNodeId;
  const toNodeId = activeTurnSelection?.toNodeId;
  const waypointNodeIds = activeTurnSelection?.waypointNodeIds;

  const computedTurnPath = useMemo(() => {
    if (!crossingSubgraph || !fromNodeId || !toNodeId) {
      return null;
    }
    return findCrossingTurnPath(crossingSubgraph, fromNodeId, toNodeId, waypointNodeIds ?? []);
  }, [crossingSubgraph, fromNodeId, toNodeId, waypointNodeIds]);

  return {
    clusters,
    activeCluster,
    crossingSubgraph,
    computedTurnPath,
  };
}
