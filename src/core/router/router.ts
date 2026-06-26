import { ROUTING_CONFIG } from '../common/constants';
import { haversineDistance } from '../common/geo';
import {
  findNearestEdge,
  findNearestNode,
  getProjectionT,
  projectPointOnSegment,
} from '../common/geometry';
import { logger } from '../common/logger';
import { MinHeap } from '../common/MinHeap';
import type { Coordinate } from '../common/types';
import { DEFAULT_RULES_CONFIG, type LocalOverrides } from '../config';
import type { GraphEdge, GraphNode, StreetGraph } from '../graph/types';
import {
  buildRouteStatistics,
  getEffectiveTurnPenalty,
  type VirtualRoutingConfig,
} from './statistics';
import type { CostFunction, IRouter, RouteResult } from './types';

/**
 * Configuration for out-of-network virtual routing.
 * Defines temporary start/end nodes and their corresponding virtual edges
 * to connect points outside the street graph into the traversable graph structure.
 */
interface VirtualRoutingConfig {
  startNode: GraphNode;
  endNode: GraphNode;
  startEdges: GraphEdge[];
  endVirtualEdges: Map<string, GraphEdge>;
}

/**
 * Router implementation that uses Dijkstra's shortest path algorithm
 * to find optimal bicycle paths, incorporating turn penalties, local delays,
 * and custom safety rules configuration.
 */
export class DijkstraRouter implements IRouter {
  private runDijkstra(
    graph: StreetGraph,
    startId: string,
    endId: string,
    costFn: CostFunction,
    overrides: LocalOverrides,
    virtualConfig?: VirtualRoutingConfig,
  ): { destReached: boolean; previous: Map<string, string> } {
    const rulesConfig = overrides.rulesConfig ?? DEFAULT_RULES_CONFIG;
    const N = graph.nodes.size + (virtualConfig ? 2 : 0);
    const nodeIdToInt = new Map<string, number>();
    const intToNodeId = new Array<string>(N);

    let idx = 0;
    for (const nodeId of graph.nodes.keys()) {
      nodeIdToInt.set(nodeId, idx);
      intToNodeId[idx] = nodeId;
      idx++;
    }

    if (virtualConfig) {
      if (!nodeIdToInt.has(startId)) {
        nodeIdToInt.set(startId, idx);
        intToNodeId[idx] = startId;
        idx++;
      }
      if (!nodeIdToInt.has(endId)) {
        nodeIdToInt.set(endId, idx);
        intToNodeId[idx] = endId;
      }
    }

    const startInt = nodeIdToInt.get(startId);
    const endInt = nodeIdToInt.get(endId);

    if (startInt === undefined || endInt === undefined) {
      return { destReached: false, previous: new Map() };
    }

    const distances = new Float64Array(N);
    distances.fill(Infinity);
    distances[startInt] = 0;

    const previousInt = new Int32Array(N);
    previousInt.fill(-1);

    const visited = new Uint8Array(N);
    const heap = new MinHeap<number>();
    heap.push(startInt, 0);

    let destReached = false;

    while (!heap.isEmpty()) {
      const currentInt = heap.pop();
      if (currentInt === null) break;

      if (currentInt === endInt) {
        destReached = true;
        break;
      }

      if (visited[currentInt] === 1) continue;
      visited[currentInt] = 1;

      const currentId = intToNodeId[currentInt];
      let currentEdges: GraphEdge[] = [];
      let currentNode: GraphNode | undefined;

      if (virtualConfig && currentId === 'virtual-start') {
        currentNode = virtualConfig.startNode;
        currentEdges = virtualConfig.startEdges;
      } else if (virtualConfig && currentId === 'virtual-end') {
        currentNode = virtualConfig.endNode;
        currentEdges = [];
      } else {
        const entry = graph.nodes.get(currentId);
        if (entry) {
          currentNode = entry.node;
          currentEdges = entry.edges;
          if (virtualConfig) {
            const extraEdge = virtualConfig.endVirtualEdges.get(currentId);
            if (extraEdge) {
              currentEdges = [...currentEdges, extraEdge];
            }
          }
        }
      }

      if (!currentNode) continue;

      const currentDist = distances[currentInt];

      for (const edge of currentEdges) {
        const neighborId = edge.target;
        const neighborInt = nodeIdToInt.get(neighborId);
        if (neighborInt === undefined) continue;

        if (visited[neighborInt] === 1) continue;

        let edgeCost = costFn(currentId, edge, neighborId, overrides, graph);

        const parentInt = previousInt[currentInt];
        if (parentInt !== -1) {
          const parentId = intToNodeId[parentInt];
          let parentNode: GraphNode | undefined;
          if (virtualConfig && parentId === 'virtual-start') {
            parentNode = virtualConfig.startNode;
          } else if (virtualConfig && parentId === 'virtual-end') {
            parentNode = virtualConfig.endNode;
          } else {
            parentNode = graph.nodes.get(parentId)?.node;
          }

          let neighborNode: GraphNode | undefined;
          if (virtualConfig && neighborId === 'virtual-start') {
            neighborNode = virtualConfig.startNode;
          } else if (virtualConfig && neighborId === 'virtual-end') {
            neighborNode = virtualConfig.endNode;
          } else {
            neighborNode = graph.nodes.get(neighborId)?.node;
          }

          if (parentNode && neighborNode) {
            edgeCost += getEffectiveTurnPenalty(
              parentNode,
              currentNode,
              neighborNode,
              overrides,
              rulesConfig,
            );
          }
        }

        const altDist = currentDist + edgeCost;

        if (altDist < distances[neighborInt]) {
          distances[neighborInt] = altDist;
          previousInt[neighborInt] = currentInt;
          heap.push(neighborInt, altDist);
        }
      }
    }

    const previous = new Map<string, string>();
    for (let i = 0; i < N; i++) {
      if (previousInt[i] !== -1) {
        previous.set(intToNodeId[i], intToNodeId[previousInt[i]]);
      }
    }

    return { destReached, previous };
  }

  /**
   * Evaluates shortest/most-comfortable path routing using Dijkstra's algorithm.
   * Leverages start/end snapping and falls back to nearest node searches if snapping fails.
   */
  findRoute(
    graph: StreetGraph,
    start: Coordinate,
    end: Coordinate,
    costFn: CostFunction,
    overrides: LocalOverrides,
  ): RouteResult | null {
    const startEdgeRef = findNearestEdge(graph, start);
    const endEdgeRef = findNearestEdge(graph, end);

    if (!startEdgeRef || !endEdgeRef) {
      return this.findRouteNodeFallback(graph, start, end, costFn, overrides);
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
      return this.findRouteNodeFallback(graph, start, end, costFn, overrides);
    }

    const startUNode = startU.node;
    const startVNode = startV.node;
    const endUNode = endU.node;
    const endVNode = endV.node;

    const START_VNODE_ID = 'virtual-start';
    const END_VNODE_ID = 'virtual-end';

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

    const distToVs = haversineDistance(
      startProj.lat,
      startProj.lng,
      startVNode.lat,
      startVNode.lng,
    );
    const distToUs = haversineDistance(
      startProj.lat,
      startProj.lng,
      startUNode.lat,
      startUNode.lng,
    );

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

    const { destReached, previous } = this.runDijkstra(
      graph,
      START_VNODE_ID,
      END_VNODE_ID,
      costFn,
      overrides,
      virtualConfig,
    );

    if (!destReached) {
      logger.warn('Destination node is unreachable from source node');
      return null;
    }

    const stats = buildRouteStatistics(
      graph,
      previous,
      END_VNODE_ID,
      costFn,
      overrides,
      virtualConfig,
    );

    const rawCoords: Coordinate[] = [start, ...stats.coordinates, end];
    const finalCoords: Coordinate[] = [];
    for (const c of rawCoords) {
      if (finalCoords.length === 0) {
        finalCoords.push(c);
      } else {
        const last = finalCoords[finalCoords.length - 1];
        const dist2 = Math.pow(c.lat - last.lat, 2) + Math.pow(c.lng - last.lng, 2);
        if (dist2 > 1e-14) {
          finalCoords.push(c);
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

  private findRouteNodeFallback(
    graph: StreetGraph,
    start: Coordinate,
    end: Coordinate,
    costFn: CostFunction,
    overrides: LocalOverrides,
  ): RouteResult | null {
    const startNodeId = findNearestNode(graph, start);
    const endNodeId = findNearestNode(graph, end);

    if (!startNodeId || !endNodeId) {
      logger.error('Could not find start or end nodes in graph');
      return null;
    }

    if (startNodeId === endNodeId) {
      const startNodeEntry = graph.nodes.get(startNodeId);
      if (!startNodeEntry) return null;
      const singleNode = startNodeEntry.node;
      return {
        pathNodeIds: [startNodeId],
        coordinates: [{ lat: singleNode.lat, lng: singleNode.lng }],
        totalDurationSeconds: 0,
        totalDistanceMeters: 0,
        streets: [],
        trafficSignalsCount: 0,
        signalCount: 0,
        yieldCount: 0,
        crossingCount: 0,
        roadTypeTotals: {
          cycleway: 0,
          residential: 0,
          primary: 0,
          other: 0,
        },
        surfaceTotals: {
          paved: 0,
          gravel: 0,
          cobblestone: 0,
        },
      };
    }

    const { destReached, previous } = this.runDijkstra(
      graph,
      startNodeId,
      endNodeId,
      costFn,
      overrides,
    );

    if (!destReached) {
      logger.warn('Destination node is unreachable from source node');
      return null;
    }

    const stats = buildRouteStatistics(graph, previous, endNodeId, costFn, overrides);

    let finalCoords: Coordinate[] = [];
    if (stats.coordinates.length >= 2) {
      const n0 = stats.coordinates[0];
      const n1 = stats.coordinates[1];
      const nk_1 = stats.coordinates[stats.coordinates.length - 2];
      const nk = stats.coordinates[stats.coordinates.length - 1];

      const projectedStart = projectPointOnSegment(start, n0, n1);
      const projectedEnd = projectPointOnSegment(end, nk_1, nk);

      const adjusted: Coordinate[] = [start, projectedStart];
      for (let i = 1; i < stats.coordinates.length - 1; i++) {
        adjusted.push(stats.coordinates[i]);
      }
      adjusted.push(projectedEnd);
      adjusted.push(end);

      for (const c of adjusted) {
        if (finalCoords.length === 0) {
          finalCoords.push(c);
        } else {
          const last = finalCoords[finalCoords.length - 1];
          const dist2 = Math.pow(c.lat - last.lat, 2) + Math.pow(c.lng - last.lng, 2);
          if (dist2 > 1e-14) {
            finalCoords.push(c);
          }
        }
      }
    } else if (stats.coordinates.length === 1) {
      finalCoords = [start, stats.coordinates[0], end];
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
}
