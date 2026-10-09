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
import { getCrossingTurnEffect } from './crossing-turns';
import {
  buildRouteStatistics,
  getEffectiveTurnPenalty,
  type VirtualRoutingConfig,
} from './statistics';
import type { CostFunction, IRouter, RouteResult } from './types';

/**
 * Computes an upper bound on maximum possible bicycle travel speed in meters per second
 * under the active local overrides and configuration rules, guaranteeing admissibility
 * and consistency of the bidirectional heuristic across all strategies.
 *
 * @param overrides - Local overrides containing bike and rule configurations.
 * @returns Maximum potential speed in m/s scaled by comfort and safety factors.
 */
export function computeMaxTravelSpeedMs(overrides: LocalOverrides): number {
  const bikeId = overrides.bikeConfig?.id ?? 'normal';
  const customSpeed = overrides.bikeConfig?.customSpeedKmh;
  const defaultSpeed =
    bikeId === 'road' ? 30 : bikeId === 'ebike' ? 25 : bikeId === 'slow' ? 15 : 18;
  const bikeSpeedKmh = customSpeed ?? defaultSpeed;
  let maxSpeedKmh = Math.max(bikeSpeedKmh, 30);

  if (overrides.rulesConfig) {
    for (const sign of Object.values(overrides.rulesConfig.signs)) {
      if (sign.baseSpeedKmh > maxSpeedKmh) {
        maxSpeedKmh = sign.baseSpeedKmh;
      }
    }
    for (const road of Object.values(overrides.rulesConfig.roads)) {
      if (road.baseSpeedKmh > maxSpeedKmh) {
        maxSpeedKmh = road.baseSpeedKmh;
      }
    }
  }

  // Quiet streets strategy has comfort multiplier as low as 0.6 (cost = base * 0.6),
  // which effectively scales speed by 1 / 0.6 = 1.6667.
  // Adding an extra safety factor guarantees admissibility and consistency:
  const peakSpeedMs = (maxSpeedKmh / 3.6) * 1.35;
  const minCostMultiplier = 0.6;
  return (peakSpeedMs / minCostMultiplier) * 1.1;
}

interface IncomingEdge {
  sourceInt: number;
  edge: GraphEdge;
}

type MeetingPoint = { type: 'node'; node: number } | { type: 'edge'; u: number; v: number };

/**
 * Router implementation using Bidirectional A* ("Meet in the middle") search algorithm.
 * Concurrently expands from origin and destination with balanced consistent heuristics
 * derived from geodesic haversine distance, satisfying strict optimality bounds.
 */
export class AStarRouter implements IRouter {
  private getForwardEdges(
    uId: string,
    graph: StreetGraph,
    virtualConfig?: VirtualRoutingConfig,
  ): GraphEdge[] {
    if (virtualConfig) {
      if (uId === 'virtual-start') {
        return virtualConfig.startEdges;
      }
      if (uId === 'virtual-end') {
        return [];
      }
      const entry = graph.nodes.get(uId);
      if (entry) {
        const extra = virtualConfig.endVirtualEdges.get(uId);
        return extra ? [...entry.edges, extra] : entry.edges;
      }
      return [];
    }

    return graph.nodes.get(uId)?.edges ?? [];
  }

  /**
   * Executes bidirectional A* search with meet-in-the-middle stopping condition.
   */
  private runBidirectionalAStar(
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
    const coords: Coordinate[] = new Array<Coordinate>(N);

    let idx = 0;
    for (const [nodeId, entry] of graph.nodes) {
      nodeIdToInt.set(nodeId, idx);
      intToNodeId[idx] = nodeId;
      coords[idx] = { lat: entry.node.lat, lng: entry.node.lng };
      idx++;
    }

    if (virtualConfig) {
      if (!nodeIdToInt.has(startId)) {
        nodeIdToInt.set(startId, idx);
        intToNodeId[idx] = startId;
        coords[idx] = { lat: virtualConfig.startNode.lat, lng: virtualConfig.startNode.lng };
        idx++;
      }
      if (!nodeIdToInt.has(endId)) {
        nodeIdToInt.set(endId, idx);
        intToNodeId[idx] = endId;
        coords[idx] = { lat: virtualConfig.endNode.lat, lng: virtualConfig.endNode.lng };
      }
    }

    const startInt = nodeIdToInt.get(startId);
    const endInt = nodeIdToInt.get(endId);

    if (startInt === undefined || endInt === undefined) {
      return { destReached: false, previous: new Map() };
    }

    if (startInt === endInt) {
      return { destReached: true, previous: new Map() };
    }

    const totalNodes = intToNodeId.length;

    // Build reverse incoming edges adjacency for backward search
    const incomingEdges: IncomingEdge[][] = Array.from({ length: totalNodes }, () => []);
    for (let u = 0; u < totalNodes; u++) {
      const uId = intToNodeId[u];
      const outgoing = this.getForwardEdges(uId, graph, virtualConfig);
      for (const edge of outgoing) {
        const v = nodeIdToInt.get(edge.target);
        if (v !== undefined) {
          incomingEdges[v].push({ sourceInt: u, edge });
        }
      }
    }

    const vMax = computeMaxTravelSpeedMs(overrides);
    const startCoord = coords[startInt];
    const endCoord = coords[endInt];
    const hST =
      haversineDistance(startCoord.lat, startCoord.lng, endCoord.lat, endCoord.lng) / vMax;

    const hF = (i: number): number =>
      haversineDistance(coords[i].lat, coords[i].lng, endCoord.lat, endCoord.lng) / vMax;

    const hB = (i: number): number =>
      haversineDistance(coords[i].lat, coords[i].lng, startCoord.lat, startCoord.lng) / vMax;

    // Symmetric consistent potentials (Ikeda et al. / Goldberg & Harrelson)
    const keyF = (i: number, dist: number): number => dist + (hF(i) - hB(i) - hST) / 2;
    const keyB = (i: number, dist: number): number => dist + (hB(i) - hF(i) - hST) / 2;

    const getNodeRef = (i: number): GraphNode | undefined => {
      const id = intToNodeId[i];
      if (virtualConfig) {
        if (id === 'virtual-start') return virtualConfig.startNode;
        if (id === 'virtual-end') return virtualConfig.endNode;
      }
      return graph.nodes.get(id)?.node;
    };

    const computeTurnPenalty = (parentIdx: number, currIdx: number, nextIdx: number): number => {
      if (parentIdx < 0 || nextIdx < 0) return 0;
      const pNode = getNodeRef(parentIdx);
      const cNode = getNodeRef(currIdx);
      const nNode = getNodeRef(nextIdx);
      if (pNode && cNode && nNode) {
        return getEffectiveTurnPenalty(pNode, cNode, nNode, overrides, rulesConfig);
      }
      return 0;
    };

    const distF = new Float64Array(totalNodes).fill(Infinity);
    const parentF = new Int32Array(totalNodes).fill(-1);
    const closedF = new Uint8Array(totalNodes);
    const heapF = new MinHeap<number>();

    const distB = new Float64Array(totalNodes).fill(Infinity);
    const succB = new Int32Array(totalNodes).fill(-1);
    const closedB = new Uint8Array(totalNodes);
    const heapB = new MinHeap<number>();

    distF[startInt] = 0;
    heapF.push(startInt, keyF(startInt, 0));

    distB[endInt] = 0;
    heapB.push(endInt, keyB(endInt, 0));

    let mu = Infinity;
    let bestMeeting: MeetingPoint | null = null;

    while (!heapF.isEmpty() && !heapB.isEmpty()) {
      const topFItem = heapF.peek();
      const topBItem = heapB.peek();
      if (!topFItem || !topBItem) break;

      const topF = topFItem.priority;
      const topB = topBItem.priority;

      // Meet-in-the-middle stopping condition
      if (topF + topB + hST >= mu) {
        break;
      }

      if (topF <= topB) {
        const u = heapF.pop();
        if (u === null) continue;
        if (closedF[u] === 1) continue;
        if (topF > keyF(u, distF[u]) + 1e-9) continue;
        closedF[u] = 1;

        const uId = intToNodeId[u];

        // Check meeting at node u
        if (distB[u] < Infinity) {
          const parentIdStr = parentF[u] !== -1 ? intToNodeId[parentF[u]] : null;
          const succIdStr = succB[u] !== -1 ? intToNodeId[succB[u]] : null;
          let nodeCrossingDelta = 0;
          let nodeBanned = false;
          if (parentIdStr && succIdStr) {
            const effect = getCrossingTurnEffect(parentIdStr, uId, succIdStr, overrides);
            if (effect.isBanned) nodeBanned = true;
            nodeCrossingDelta = effect.timeDelta;
          }
          if (!nodeBanned) {
            let candCost = distF[u] + distB[u] + nodeCrossingDelta;
            if (parentF[u] !== -1 && succB[u] !== -1) {
              candCost += computeTurnPenalty(parentF[u], u, succB[u]);
            }
            if (candCost < mu) {
              mu = candCost;
              bestMeeting = { type: 'node', node: u };
            }
          }
        }

        const outgoing = this.getForwardEdges(uId, graph, virtualConfig);
        for (const edge of outgoing) {
          const v = nodeIdToInt.get(edge.target);
          if (v === undefined || closedF[v] === 1) continue;
          const vId = intToNodeId[v];

          let stepCost = costFn(uId, edge, vId, overrides, graph);
          if (parentF[u] !== -1) {
            stepCost += computeTurnPenalty(parentF[u], u, v);
          }

          const parentId = parentF[u] !== -1 ? intToNodeId[parentF[u]] : null;
          const crossingEffect = getCrossingTurnEffect(parentId, uId, vId, overrides);
          if (crossingEffect.isBanned) continue;
          stepCost += crossingEffect.timeDelta;

          // Check meeting across edge u -> v
          if (distB[v] < Infinity) {
            const succIdStr = succB[v] !== -1 ? intToNodeId[succB[v]] : null;
            let edgeTurnBanned = false;
            let edgeTurnDelta = 0;
            if (succIdStr) {
              const effect = getCrossingTurnEffect(uId, vId, succIdStr, overrides);
              if (effect.isBanned) edgeTurnBanned = true;
              edgeTurnDelta = effect.timeDelta;
            }
            if (!edgeTurnBanned) {
              let edgeMeetingCost = distF[u] + stepCost + distB[v] + edgeTurnDelta;
              if (succB[v] !== -1) {
                edgeMeetingCost += computeTurnPenalty(u, v, succB[v]);
              }
              if (edgeMeetingCost < mu) {
                mu = edgeMeetingCost;
                bestMeeting = { type: 'edge', u, v };
              }
            }
          }

          const newDist = distF[u] + stepCost;
          if (newDist < distF[v]) {
            distF[v] = newDist;
            parentF[v] = u;
            heapF.push(v, keyF(v, newDist));
          }
        }
      } else {
        const v = heapB.pop();
        if (v === null) continue;
        if (closedB[v] === 1) continue;
        if (topB > keyB(v, distB[v]) + 1e-9) continue;
        closedB[v] = 1;

        const vId = intToNodeId[v];

        // Check meeting at node v
        if (distF[v] < Infinity) {
          const parentIdStr = parentF[v] !== -1 ? intToNodeId[parentF[v]] : null;
          const succIdStr = succB[v] !== -1 ? intToNodeId[succB[v]] : null;
          let nodeCrossingDelta = 0;
          let nodeBanned = false;
          if (parentIdStr && succIdStr) {
            const effect = getCrossingTurnEffect(parentIdStr, vId, succIdStr, overrides);
            if (effect.isBanned) nodeBanned = true;
            nodeCrossingDelta = effect.timeDelta;
          }
          if (!nodeBanned) {
            let candCost = distF[v] + distB[v] + nodeCrossingDelta;
            if (parentF[v] !== -1 && succB[v] !== -1) {
              candCost += computeTurnPenalty(parentF[v], v, succB[v]);
            }
            if (candCost < mu) {
              mu = candCost;
              bestMeeting = { type: 'node', node: v };
            }
          }
        }

        // Expand incoming edges into v (stepping backward from v to u)
        for (const inEdge of incomingEdges[v]) {
          const u = inEdge.sourceInt;
          if (closedB[u] === 1) continue;
          const uId = intToNodeId[u];

          let stepCost = costFn(uId, inEdge.edge, vId, overrides, graph);
          if (succB[v] !== -1) {
            stepCost += computeTurnPenalty(u, v, succB[v]);
          }

          const crossingEffect = getCrossingTurnEffect(null, uId, vId, overrides);
          if (crossingEffect.isBanned) continue;
          stepCost += crossingEffect.timeDelta;

          const succIdStr = succB[v] !== -1 ? intToNodeId[succB[v]] : null;
          if (succIdStr) {
            const turnEffect = getCrossingTurnEffect(uId, vId, succIdStr, overrides);
            if (turnEffect.isBanned) continue;
            stepCost += turnEffect.timeDelta;
          }

          // Check meeting across edge u -> v
          if (distF[u] < Infinity) {
            const parentIdStr = parentF[u] !== -1 ? intToNodeId[parentF[u]] : null;
            let edgeTurnBanned = false;
            let edgeTurnDelta = 0;
            if (parentIdStr) {
              const effect = getCrossingTurnEffect(parentIdStr, uId, vId, overrides);
              if (effect.isBanned) edgeTurnBanned = true;
              edgeTurnDelta = effect.timeDelta;
            }
            if (!edgeTurnBanned) {
              let edgeMeetingCost = distF[u] + stepCost + distB[v] + edgeTurnDelta;
              if (parentF[u] !== -1) {
                edgeMeetingCost += computeTurnPenalty(parentF[u], u, v);
              }
              if (edgeMeetingCost < mu) {
                mu = edgeMeetingCost;
                bestMeeting = { type: 'edge', u, v };
              }
            }
          }

          const newDist = distB[v] + stepCost;
          if (newDist < distB[u]) {
            distB[u] = newDist;
            succB[u] = v;
            heapB.push(u, keyB(u, newDist));
          }
        }
      }
    }

    if (!bestMeeting || mu === Infinity) {
      return { destReached: false, previous: new Map() };
    }

    const pathInts: number[] = [];

    if (bestMeeting.type === 'node') {
      const m = bestMeeting.node;
      const forwardPath: number[] = [];
      let curr = m;
      while (curr !== -1) {
        forwardPath.push(curr);
        if (curr === startInt) break;
        curr = parentF[curr];
      }
      forwardPath.reverse();
      pathInts.push(...forwardPath);

      let bCurr = succB[m];
      while (bCurr !== -1) {
        pathInts.push(bCurr);
        if (bCurr === endInt) break;
        bCurr = succB[bCurr];
      }
    } else {
      const { u, v } = bestMeeting;
      const forwardPath: number[] = [];
      let curr = u;
      while (curr !== -1) {
        forwardPath.push(curr);
        if (curr === startInt) break;
        curr = parentF[curr];
      }
      forwardPath.reverse();
      pathInts.push(...forwardPath);

      let bCurr = v;
      while (bCurr !== -1) {
        pathInts.push(bCurr);
        if (bCurr === endInt) break;
        bCurr = succB[bCurr];
      }
    }

    const previous = new Map<string, string>();
    for (let i = 1; i < pathInts.length; i++) {
      const fromId = intToNodeId[pathInts[i - 1]];
      const toId = intToNodeId[pathInts[i]];
      previous.set(toId, fromId);
    }

    return { destReached: true, previous };
  }

  /**
   * Evaluates shortest/most-comfortable path routing using Bidirectional A*.
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

    const { destReached, previous } = this.runBidirectionalAStar(
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

    const stats = buildRouteStatistics(graph, previous, END_VNODE_ID, overrides, virtualConfig);

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

    const { destReached, previous } = this.runBidirectionalAStar(
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

    const stats = buildRouteStatistics(graph, previous, endNodeId, overrides);

    const finalCoords: Coordinate[] = [];
    if (stats.coordinates.length >= 2) {
      const n0 = stats.coordinates[0];
      const n1 = stats.coordinates[1];
      const nkMinus1 = stats.coordinates[stats.coordinates.length - 2];
      const nk = stats.coordinates[stats.coordinates.length - 1];

      const projectedStart = projectPointOnSegment(start, n0, n1);
      const projectedEnd = projectPointOnSegment(end, nkMinus1, nk);

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
      finalCoords.push(start, stats.coordinates[0], end);
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

/**
 * Alias for AStarRouter emphasizing bidirectional meet-in-the-middle search architecture.
 */
export const BidirectionalAStarRouter = AStarRouter;

/**
 * Type alias for BidirectionalAStarRouter.
 */
export type BidirectionalAStarRouter = AStarRouter;
