import { findNearestNode } from '../common/geometry';
import { logger } from '../common/logger';
import { MinHeap } from '../common/MinHeap';
import type { Coordinate } from '../common/types';
import { DEFAULT_RULES_CONFIG, type LocalOverrides } from '../config';
import type { GraphEdge, GraphNode, StreetGraph } from '../graph/types';
import { getCrossingTurnEffect } from './crossing-turns';
import { getEffectiveTurnPenalty, type VirtualRoutingConfig } from './statistics';
import type { CostFunction, IRouter, RouteResult } from './types';
import {
  buildSingleNodeFallbackRoute,
  END_VNODE_ID,
  finalizeFallbackRoute,
  finalizeVirtualRoute,
  setupVirtualEndpoints,
  START_VNODE_ID,
} from './virtual-endpoints';

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

        const parentId = parentInt !== -1 ? intToNodeId[parentInt] : null;
        const crossingEffect = getCrossingTurnEffect(parentId, currentId, neighborId, overrides);
        if (crossingEffect.isBanned) continue;
        edgeCost += crossingEffect.timeDelta;

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
    const virtualSetup = setupVirtualEndpoints(graph, start, end);
    if (!virtualSetup) {
      return this.findRouteNodeFallback(graph, start, end, costFn, overrides);
    }

    const { virtualConfig, startProj, endProj } = virtualSetup;

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

    return finalizeVirtualRoute(
      graph,
      previous,
      start,
      end,
      startProj,
      endProj,
      overrides,
      virtualConfig,
    );
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
      return buildSingleNodeFallbackRoute(startNodeEntry.node);
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

    return finalizeFallbackRoute(graph, previous, start, end, endNodeId, overrides);
  }
}
