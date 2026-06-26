import { haversineDistance } from '../common/geo';
import { findNearestEdge } from '../common/geometry';
import { MinHeap } from '../common/MinHeap';
import type { Coordinate } from '../common/types';
import { DEFAULT_RULES_CONFIG, type LocalOverrides } from '../config';
import type { GraphEdge, GraphNode, StreetGraph } from '../graph/types';
import { calculateDisplayCost, calculateTurnPenalty, evaluateEdge } from '../router/edge-metrics';
import { getEffectiveTurnPenalty } from '../router/statistics';
import { avoidBusyRoadsCost, avoidStoppingCost, standardCost } from '../router/strategies';
import type { CostFunction, RouteResult } from '../router/types';
import { getTurnDetails, mapOSMNodeToControl } from '../rules';
import type { InspectorBranchEvaluation } from './types';

// Map strategy label to cost function
const STRATEGY_COST_FNS = {
  standard: standardCost,
  'avoid-stops': avoidStoppingCost,
  'quiet-streets': avoidBusyRoadsCost,
};

function runDijkstraForProjection(
  graph: StreetGraph,
  startId: string,
  endId: string,
  costFn: CostFunction,
  overrides: LocalOverrides,
  endVirtualEdges?: Map<string, GraphEdge>,
  virtualEndNode?: GraphNode,
): { destReached: boolean; previous: Map<string, string> } {
  const rulesConfig = overrides.rulesConfig ?? DEFAULT_RULES_CONFIG;
  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const visited = new Set<string>();
  const heap = new MinHeap<string>();

  distances.set(startId, 0);
  heap.push(startId, 0);

  let destReached = false;

  while (!heap.isEmpty()) {
    const u = heap.pop();
    if (!u) break;

    if (u === endId) {
      destReached = true;
      break;
    }

    if (visited.has(u)) continue;
    visited.add(u);

    const currentDist = distances.get(u) ?? Infinity;

    // Get outgoing edges for u
    let edges: GraphEdge[] = [];
    let uNode: GraphNode | undefined;

    if (u === 'virtual-end') {
      uNode = virtualEndNode;
      edges = [];
    } else {
      const entry = graph.nodes.get(u);
      if (entry) {
        uNode = entry.node;
        edges = entry.edges;
        if (endVirtualEdges) {
          const extra = endVirtualEdges.get(u);
          if (extra) {
            edges = [...edges, extra];
          }
        }
      }
    }

    if (!uNode) continue;

    for (const edge of edges) {
      const v = edge.target;
      if (visited.has(v)) continue;

      let edgeCost = costFn(u, edge, v, overrides, graph);

      // Add turn penalty if there is a parent
      const parentId = previous.get(u);
      if (parentId) {
        let parentNode: GraphNode | undefined;
        if (parentId === 'virtual-end') {
          parentNode = virtualEndNode;
        } else {
          parentNode = graph.nodes.get(parentId)?.node;
        }

        let neighborNode: GraphNode | undefined;
        if (v === 'virtual-end') {
          neighborNode = virtualEndNode;
        } else {
          neighborNode = graph.nodes.get(v)?.node;
        }

        if (parentNode && neighborNode) {
          edgeCost += getEffectiveTurnPenalty(
            parentNode,
            uNode,
            neighborNode,
            overrides,
            rulesConfig,
          );
        }
      }

      const altDist = currentDist + edgeCost;
      const oldDist = distances.get(v) ?? Infinity;

      if (altDist < oldDist) {
        distances.set(v, altDist);
        previous.set(v, u);
        heap.push(v, altDist);
      }
    }
  }

  return { destReached, previous };
}

/**
 * On-demand evaluator that calculates the detailed alternative branch metrics
 * at any given intersection node along a computed route.
 */
export function evaluateIntersectionBranches(
  nodeId: string,
  routeResult: RouteResult,
  graph: StreetGraph,
  overrides: LocalOverrides,
  activeStrategyLabel: 'standard' | 'avoid-stops' | 'quiet-streets' = 'standard',
): InspectorBranchEvaluation[] {
  const pathNodeIds = routeResult.pathNodeIds || [];
  if (pathNodeIds.length === 0) return [];

  const idx = pathNodeIds.indexOf(nodeId);
  if (idx === -1) return [];

  const currentNodeEntry = graph.nodes.get(nodeId);
  if (!currentNodeEntry) return [];
  const currentNode = currentNodeEntry.node;

  // 1. Get backward node/parent node
  const backwardNodeId = idx > 0 ? pathNodeIds[idx - 1] : null;
  let parentNode: GraphNode | undefined;
  if (backwardNodeId) {
    parentNode = graph.nodes.get(backwardNodeId)?.node;
  }

  // 2. Precompute remaining metrics along the chosen path from the current index `idx`
  let chosenRemainingDuration = 0;
  let chosenRemainingDistance = 0;
  let chosenRemainingSignals = 0;

  if (routeResult.edges) {
    for (let k = idx; k < routeResult.edges.length; k++) {
      const edge = routeResult.edges[k];
      chosenRemainingDuration += edge.cost;
      chosenRemainingDistance += edge.distance;
    }
  }

  const rulesConfig = overrides.rulesConfig ?? DEFAULT_RULES_CONFIG;

  for (let k = idx; k < pathNodeIds.length; k++) {
    const nId = pathNodeIds[k];
    const nNode = graph.nodes.get(nId)?.node;
    if (nNode) {
      if (mapOSMNodeToControl(nNode.tags) === 'signal') {
        chosenRemainingSignals++;
      }
    }
  }

  // 3. Find outgoing edges
  const currentEdges = currentNodeEntry.edges;
  const endId = pathNodeIds[pathNodeIds.length - 1];

  // Set up virtualEndNode and endVirtualEdges if endId is virtual-end
  const endVirtualEdges = new Map<string, GraphEdge>();
  let virtualEndNode: GraphNode | undefined;
  const endCoord = routeResult.coordinates[routeResult.coordinates.length - 1];

  if (endId === 'virtual-end') {
    const endEdgeRef = findNearestEdge(graph, endCoord);
    if (endEdgeRef) {
      const endProj = endEdgeRef.projected;
      const endUId = endEdgeRef.uId;
      const endVId = endEdgeRef.vId;
      const endEdge = endEdgeRef.edge;
      const endU = graph.nodes.get(endUId);
      const endV = graph.nodes.get(endVId);
      if (endU && endV) {
        const endUNode = endU.node;
        const endVNode = endV.node;

        virtualEndNode = {
          id: 'virtual-end',
          lat: endProj.lat,
          lng: endProj.lng,
          tags: {},
        };

        const distUToE = haversineDistance(endUNode.lat, endUNode.lng, endProj.lat, endProj.lng);
        const distVToE = haversineDistance(endVNode.lat, endVNode.lng, endProj.lat, endProj.lng);

        endVirtualEdges.set(endUId, {
          target: 'virtual-end',
          distance: distUToE,
          name: endEdge.name,
          speedLimit: endEdge.speedLimit,
          tags: endEdge.tags,
        });

        const endEdgeVU = graph.nodes.get(endVId)?.edges.find((e) => e.target === endUId);
        if (endEdgeVU) {
          endVirtualEdges.set(endVId, {
            target: 'virtual-end',
            distance: distVToE,
            name: endEdgeVU.name,
            speedLimit: endEdgeVU.speedLimit,
            tags: endEdgeVU.tags,
          });
        }
      }
    }
  }

  const evals: InspectorBranchEvaluation[] = [];

  for (const edge of currentEdges) {
    if (backwardNodeId && edge.target === backwardNodeId) {
      continue;
    }

    let neighborNode: GraphNode | undefined;
    if (edge.target === 'virtual-end') {
      neighborNode = virtualEndNode;
    } else {
      neighborNode = graph.nodes.get(edge.target)?.node;
    }

    let turnPenalty = 0;
    let isUTurn = false;
    if (parentNode && currentNode && neighborNode) {
      turnPenalty = getEffectiveTurnPenalty(
        parentNode,
        currentNode,
        neighborNode,
        overrides,
        rulesConfig,
      );
      isUTurn = getTurnDetails(parentNode, currentNode, neighborNode).direction === 'u-turn';
    }

    if (isUTurn) {
      continue;
    }

    // Run Dijkstra projection from the alternative target to the route destination
    const costFn = STRATEGY_COST_FNS[activeStrategyLabel] || standardCost;
    const { destReached, previous: prevAlt } = runDijkstraForProjection(
      graph,
      edge.target,
      endId,
      costFn,
      overrides,
      endVirtualEdges,
      virtualEndNode,
    );

    let altPathNodeIds: string[] = [];
    const altCoordinates: Coordinate[] = [];
    let altDistanceMeters = edge.distance;
    let altDurationSeconds = 0;
    let altSignalCount = 0;

    if (destReached) {
      const path: string[] = [];
      let curr = endId;
      while (curr && curr !== edge.target) {
        path.unshift(curr);
        curr = prevAlt.get(curr) || '';
      }
      if (curr === edge.target) {
        path.unshift(edge.target);
      }

      altPathNodeIds = path;

      for (let j = 0; j < path.length; j++) {
        const nId = path[j];
        let nNode: GraphNode | undefined;
        if (nId === 'virtual-end') {
          nNode = virtualEndNode;
        } else {
          nNode = graph.nodes.get(nId)?.node;
        }

        if (nNode) {
          altCoordinates.push({ lat: nNode.lat, lng: nNode.lng });

          const nodeTags = nNode.tags || {};
          if (mapOSMNodeToControl(nodeTags) === 'signal') {
            altSignalCount++;
          }

          if (j < path.length - 1) {
            const nextNId = path[j + 1];
            const baseEdges = graph.nodes.get(nId)?.edges || [];
            const extraEdge = endVirtualEdges.get(nId);
            const nextNodeEdges = extraEdge ? [...baseEdges, extraEdge] : baseEdges;

            const nextEdge = nextNodeEdges.find((e) => e.target === nextNId);
            if (nextEdge) {
              altDistanceMeters += nextEdge.distance;
              altDurationSeconds += calculateDisplayCost(nId, nextEdge, nextNId, overrides, graph);

              if (j > 0) {
                const pId = path[j - 1];
                let pNode: GraphNode | undefined;
                if (pId === 'virtual-end') {
                  pNode = virtualEndNode;
                } else {
                  pNode = graph.nodes.get(pId)?.node;
                }
                const nextNNode = graph.nodes.get(nextNId)?.node;
                if (pNode && nextNNode) {
                  altDurationSeconds += calculateTurnPenalty(pNode, nNode, nextNNode);
                }
              }
            }
          }
        }
      }
    }

    const evaluation = evaluateEdge(
      nodeId,
      edge,
      edge.target,
      overrides,
      graph,
      costFn,
      turnPenalty,
      backwardNodeId || undefined,
    );

    if (destReached) {
      const fullCoords = [{ lat: currentNode.lat, lng: currentNode.lng }, ...altCoordinates];

      evaluation.altPathNodeIds = altPathNodeIds;
      evaluation.altCoordinates = fullCoords;
      evaluation.altDurationSeconds =
        evaluation.displayCostSeconds + turnPenalty + altDurationSeconds;
      evaluation.altDistanceMeters = altDistanceMeters;
      evaluation.altSignalCount = altSignalCount;
    }

    evaluation.chosenRemainingDuration = chosenRemainingDuration;
    evaluation.chosenRemainingDistance = chosenRemainingDistance;
    evaluation.chosenRemainingSignals = chosenRemainingSignals;

    evals.push(evaluation);
  }

  return evals;
}
