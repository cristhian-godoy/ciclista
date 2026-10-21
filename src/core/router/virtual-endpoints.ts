import { ROUTING_CONFIG } from '../common/constants';
import { haversineDistance } from '../common/geo';
import { findNearestEdge, getProjectionT, projectPointOnSegment } from '../common/geometry';
import { logger } from '../common/logger';
import type { Coordinate } from '../common/types';
import type { LocalOverrides } from '../config';
import type { GraphEdge, GraphNode, StreetGraph } from '../graph/types';
import { buildRouteStatistics, type VirtualRoutingConfig } from './statistics';
import type { RouteResult } from './types';

export const START_VNODE_ID = 'virtual-start';
export const END_VNODE_ID = 'virtual-end';

/**
 * Result structure of setting up temporary virtual start and end nodes on nearest graph edges.
 */
export interface PreparedVirtualEndpoints {
  virtualConfig: VirtualRoutingConfig;
  startProj: Coordinate;
  endProj: Coordinate;
}

/**
 * Creates temporary virtual start and end vertices projected onto the nearest street network edges.
 * Handles bidirectional links and collinear same-edge segments.
 *
 * @param graph - Street network graph.
 * @param start - Starting geographic coordinate.
 * @param end - Destination geographic coordinate.
 * @returns Virtual routing configuration and projected coordinates, or null if edges/nodes are unavailable.
 */
export function setupVirtualEndpoints(
  graph: StreetGraph,
  start: Coordinate,
  end: Coordinate,
): PreparedVirtualEndpoints | null {
  const startEdgeRef = findNearestEdge(graph, start);
  const endEdgeRef = findNearestEdge(graph, end);

  if (!startEdgeRef || !endEdgeRef) {
    return null;
  }

  const startProj = startEdgeRef.projected;
  const startUId = startEdgeRef.uId;
  const startVId = startEdgeRef.vId;
  const startEdge = startEdgeRef.edge;

  const endProj = endEdgeRef.projected;
  const endUId = endEdgeRef.uId;
  const endVId = endEdgeRef.vId;
  const endEdge = endEdgeRef.edge;

  const startU = graph.nodes.get(startUId);
  const startV = graph.nodes.get(startVId);
  const endU = graph.nodes.get(endUId);
  const endV = graph.nodes.get(endVId);

  if (!startU || !startV || !endU || !endV) {
    logger.warn('Virtual routing reference nodes missing from graph. Falling back.');
    return null;
  }

  const startUNode = startU.node;
  const startVNode = startV.node;
  const endUNode = endU.node;
  const endVNode = endV.node;

  const virtualStartNode: GraphNode = {
    id: START_VNODE_ID,
    lat: startProj.lat,
    lng: startProj.lng,
    tags: {},
  };

  const virtualEndNode: GraphNode = {
    id: END_VNODE_ID,
    lat: endProj.lat,
    lng: endProj.lng,
    tags: {},
  };

  const startEdges: GraphEdge[] = [];
  const endVirtualEdges = new Map<string, GraphEdge>();

  const distToVs = haversineDistance(startProj.lat, startProj.lng, startVNode.lat, startVNode.lng);
  const distToUs = haversineDistance(startProj.lat, startProj.lng, startUNode.lat, startUNode.lng);

  startEdges.push({
    target: startVId,
    distance: distToVs,
    name: startEdge.name,
    speedLimit: startEdge.speedLimit,
    tags: startEdge.tags,
  });

  const startEdgeVU = graph.nodes.get(startVId)?.edges.find((e) => e.target === startUId);
  if (startEdgeVU) {
    startEdges.push({
      target: startUId,
      distance: distToUs,
      name: startEdgeVU.name,
      speedLimit: startEdgeVU.speedLimit,
      tags: startEdgeVU.tags,
    });
  }

  const distUToE = haversineDistance(endUNode.lat, endUNode.lng, endProj.lat, endProj.lng);
  const distVToE = haversineDistance(endVNode.lat, endVNode.lng, endProj.lat, endProj.lng);

  endVirtualEdges.set(endUId, {
    target: END_VNODE_ID,
    distance: distUToE,
    name: endEdge.name,
    speedLimit: endEdge.speedLimit,
    tags: endEdge.tags,
  });

  const endEdgeVU = graph.nodes.get(endVId)?.edges.find((e) => e.target === endUId);
  if (endEdgeVU) {
    endVirtualEdges.set(endVId, {
      target: END_VNODE_ID,
      distance: distVToE,
      name: endEdgeVU.name,
      speedLimit: endEdgeVU.speedLimit,
      tags: endEdgeVU.tags,
    });
  }

  const sameEdge =
    (startUId === endUId && startVId === endVId) || (startUId === endVId && startVId === endUId);
  if (sameEdge) {
    const ts = getProjectionT(start, startUNode, startVNode);
    const te = getProjectionT(end, startUNode, startVNode);

    if (ts <= te) {
      startEdges.push({
        target: END_VNODE_ID,
        distance: haversineDistance(startProj.lat, startProj.lng, endProj.lat, endProj.lng),
        name: startEdge.name,
        speedLimit: startEdge.speedLimit,
        tags: startEdge.tags,
      });
    }

    if (ts >= te && startEdgeVU) {
      startEdges.push({
        target: END_VNODE_ID,
        distance: haversineDistance(startProj.lat, startProj.lng, endProj.lat, endProj.lng),
        name: startEdgeVU.name,
        speedLimit: startEdgeVU.speedLimit,
        tags: startEdgeVU.tags,
      });
    }
  }

  const virtualConfig: VirtualRoutingConfig = {
    startNode: virtualStartNode,
    endNode: virtualEndNode,
    startEdges,
    endVirtualEdges,
  };

  return {
    virtualConfig,
    startProj,
    endProj,
  };
}

/**
 * Builds the final RouteResult from a completed path search between virtual endpoints.
 * Aggregates statistics, interpolates start/end access paths, and deduplicates identical coordinates.
 *
 * @param graph - Street network graph.
 * @param previous - Predecessor node mapping from path search.
 * @param start - Original query starting coordinate.
 * @param end - Original query destination coordinate.
 * @param startProj - Projected coordinate on nearest edge for start point.
 * @param endProj - Projected coordinate on nearest edge for end point.
 * @param overrides - Active user overrides.
 * @param virtualConfig - Active virtual routing configuration.
 * @returns Fully assembled RouteResult.
 */
export function finalizeVirtualRoute(
  graph: StreetGraph,
  previous: Map<string, string>,
  start: Coordinate,
  end: Coordinate,
  startProj: Coordinate,
  endProj: Coordinate,
  overrides: LocalOverrides,
  virtualConfig: VirtualRoutingConfig,
): RouteResult {
  const stats = buildRouteStatistics(graph, previous, END_VNODE_ID, overrides, virtualConfig);

  const rawCoords: Coordinate[] = [start, ...stats.coordinates, end];
  const finalCoords: Coordinate[] = [];
  for (const c of rawCoords) {
    if (finalCoords.length === 0) {
      finalCoords.push(c);
    } else {
      const last = finalCoords[finalCoords.length - 1];
      if (last) {
        const dist2 = Math.pow(c.lat - last.lat, 2) + Math.pow(c.lng - last.lng, 2);
        if (dist2 > 1e-14) {
          finalCoords.push(c);
        }
      }
    }
  }

  const startInterpDist = haversineDistance(start.lat, start.lng, startProj.lat, startProj.lng);
  const endInterpDist = haversineDistance(end.lat, end.lng, endProj.lat, endProj.lng);

  const totalDistanceMeters = stats.totalDistanceMeters + startInterpDist + endInterpDist;

  const startInterpDuration = startInterpDist / ROUTING_CONFIG.INTERPOLATION_SPEED_MS;
  const endInterpDuration = endInterpDist / ROUTING_CONFIG.INTERPOLATION_SPEED_MS;
  const totalDurationSeconds = stats.totalDisplayCost + startInterpDuration + endInterpDuration;

  return {
    pathNodeIds: stats.pathNodeIds,
    coordinates: finalCoords,
    totalDurationSeconds,
    totalDistanceMeters,
    streets: stats.streets,
    trafficSignalsCount: stats.trafficSignalsCount,
    signalCount: stats.signalCount,
    yieldCount: stats.yieldCount,
    crossingCount: stats.crossingCount,
    roadTypeTotals: stats.roadTypeTotals,
    surfaceTotals: stats.surfaceTotals,
    edges: stats.edges,
  };
}

/**
 * Builds a fallback route when the start and destination coordinates snap to the same graph vertex.
 *
 * @param node - Graph vertex matching both endpoints.
 * @returns Zero-duration, single-coordinate RouteResult.
 */
export function buildSingleNodeFallbackRoute(node: GraphNode): RouteResult {
  return {
    pathNodeIds: [node.id],
    coordinates: [{ lat: node.lat, lng: node.lng }],
    totalDurationSeconds: 0,
    totalDistanceMeters: 0,
    streets: [],
    trafficSignalsCount: 0,
    signalCount: 0,
    yieldCount: 0,
    crossingCount: 0,
    roadTypeTotals: {},
    surfaceTotals: { paved: 0, gravel: 0, cobblestone: 0 },
    edges: [],
  };
}

/**
 * Finalizes fallback routing between discrete physical graph vertices with access projections.
 *
 * @param graph - Street network graph.
 * @param previous - Predecessor node mapping.
 * @param start - Starting query coordinate.
 * @param end - Destination query coordinate.
 * @param endNodeId - Destination vertex identifier.
 * @param overrides - Active user overrides.
 * @returns Assembled RouteResult.
 */
export function finalizeFallbackRoute(
  graph: StreetGraph,
  previous: Map<string, string>,
  start: Coordinate,
  end: Coordinate,
  endNodeId: string,
  overrides: LocalOverrides,
): RouteResult {
  const stats = buildRouteStatistics(graph, previous, endNodeId, overrides);
  let finalCoords: Coordinate[] = [];

  if (stats.coordinates.length >= 2) {
    const n0 = stats.coordinates[0];
    const n1 = stats.coordinates[1];
    const nkMinus1 = stats.coordinates[stats.coordinates.length - 2];
    const nk = stats.coordinates[stats.coordinates.length - 1];

    if (n0 && n1 && nkMinus1 && nk) {
      const projectedStart = projectPointOnSegment(start, n0, n1);
      const projectedEnd = projectPointOnSegment(end, nkMinus1, nk);

      const adjusted: Coordinate[] = [
        start,
        projectedStart,
        ...stats.coordinates.slice(1, -1),
        projectedEnd,
        end,
      ];

      for (const c of adjusted) {
        if (finalCoords.length === 0) {
          finalCoords.push(c);
        } else {
          const last = finalCoords[finalCoords.length - 1];
          if (last) {
            const dist2 = Math.pow(c.lat - last.lat, 2) + Math.pow(c.lng - last.lng, 2);
            if (dist2 > 1e-14) {
              finalCoords.push(c);
            }
          }
        }
      }
    }
  } else if (stats.coordinates.length === 1) {
    const single = stats.coordinates[0];
    if (single) {
      finalCoords = [start, single, end];
    }
  }

  return {
    pathNodeIds: stats.pathNodeIds,
    coordinates: finalCoords,
    totalDurationSeconds: stats.totalDisplayCost,
    totalDistanceMeters: stats.totalDistanceMeters,
    streets: stats.streets,
    trafficSignalsCount: stats.trafficSignalsCount,
    signalCount: stats.signalCount,
    yieldCount: stats.yieldCount,
    crossingCount: stats.crossingCount,
    roadTypeTotals: stats.roadTypeTotals,
    surfaceTotals: stats.surfaceTotals,
    edges: stats.edges,
  };
}
