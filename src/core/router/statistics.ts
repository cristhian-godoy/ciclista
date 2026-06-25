import { haversineDistance } from '../common/geo';
import type { Coordinate } from '../common/types';
import { DEFAULT_RULES_CONFIG, type LocalOverrides, type RulesConfiguration } from '../config';
import type { GraphEdge, GraphNode, StreetGraph } from '../graph/types';
import {
  calculateTurnPenalty,
  getSurfaceType,
  getTurnDetails,
  hasCycleway,
  mapOSMNodeToControl,
  mapOSMToSignAndRoad,
} from '../rules';
import { calculateDisplayCost, evaluateEdge } from './edge-metrics';
import type { AlternativeEdgeEvaluation, CostFunction, RouteResult } from './types';

/**
 * Configuration for out-of-network virtual routing.
 * Defines temporary start/end nodes and their corresponding virtual edges
 * to connect points outside the street graph into the traversable graph structure.
 */
export interface VirtualRoutingConfig {
  startNode: GraphNode;
  endNode: GraphNode;
  startEdges: GraphEdge[];
  endVirtualEdges: Map<string, GraphEdge>;
}

/**
 * Calculates the effective turn penalty considering default rules configuration and node turn overrides.
 */
export function getEffectiveTurnPenalty(
  parentNode: GraphNode,
  currentNode: GraphNode,
  nextNode: GraphNode,
  overrides: LocalOverrides,
  rulesConfig: RulesConfiguration,
): number {
  const nodeOverride = overrides.nodeTurns.get(currentNode.id);
  if (nodeOverride) {
    const compositeKey = `${parentNode.id}->${nextNode.id}`;
    const overrideType = nodeOverride[compositeKey];
    if (overrideType) {
      if (overrideType === 'right_turn') return rulesConfig.turns.rightTurnPenaltySeconds;
      if (overrideType === 'left_turn') return rulesConfig.turns.leftTurnPenaltySeconds;
      if (overrideType === 'green_arrow_right') return rulesConfig.turns.greenArrowRightTurnSeconds;
      if (overrideType === 'indirect_left') return rulesConfig.turns.indirectLeftTurnSeconds;
      if (overrideType === 'u_turn') return rulesConfig.turns.uTurnPenaltySeconds;
    }
  }

  return calculateTurnPenalty(parentNode, currentNode, nextNode, rulesConfig.turns);
}

/**
 * Classifies an OSM highway tag into one of four categories for route analytics.
 */
export function getRoadTypeCategory(
  highway: string,
  tags: Record<string, string>,
): 'cycleway' | 'residential' | 'primary' | 'other' {
  const hasCyclewayTag = hasCycleway(tags);
  const hasBicycleDesignated = tags.bicycle === 'designated' || tags.bicycle === 'yes';

  if (
    highway === 'cycleway' ||
    hasCyclewayTag ||
    hasBicycleDesignated ||
    tags.bicycle_road === 'yes' ||
    tags.cyclestreet === 'yes'
  ) {
    return 'cycleway';
  }

  if (
    ['residential', 'living_street', 'tertiary', 'tertiary_link', 'unclassified'].includes(highway)
  )
    return 'residential';
  if (['primary', 'primary_link', 'secondary', 'secondary_link'].includes(highway))
    return 'primary';
  return 'other';
}

/**
 * Builds route statistics by traversing the path back from the end node.
 */
export function buildRouteStatistics(
  graph: StreetGraph,
  previous: Map<string, string>,
  endId: string,
  costFn: CostFunction | undefined,
  overrides: LocalOverrides,
  virtualConfig?: VirtualRoutingConfig,
): {
  pathNodeIds: string[];
  coordinates: Coordinate[];
  totalDistanceMeters: number;
  streets: string[];
  trafficSignalsCount: number;
  signalCount: number;
  yieldCount: number;
  crossingCount: number;
  roadTypeTotals: Record<string, number>;
  surfaceTotals: Record<'paved' | 'gravel' | 'cobblestone', number>;
  edges: NonNullable<RouteResult['edges']>;
  totalDisplayCost: number;
  alternativeEvaluations: Record<string, AlternativeEdgeEvaluation[]>;
} {
  const pathNodeIds: string[] = [];
  let current = endId;
  while (current) {
    pathNodeIds.unshift(current);
    current = previous.get(current) || '';
  }

  const coordinates: Coordinate[] = [];
  let totalDistanceMeters = 0;
  let trafficSignalsCount = 0;
  let signalCount = 0;
  let yieldCount = 0;
  let crossingCount = 0;
  const roadTypeTotals: Record<string, number> = {
    cycleway: 0,
    residential: 0,
    primary: 0,
    other: 0,
  };
  const surfaceTotals: Record<'paved' | 'gravel' | 'cobblestone', number> = {
    paved: 0,
    gravel: 0,
    cobblestone: 0,
  };
  const streetsSet = new Set<string>();
  const edgesDetails: NonNullable<RouteResult['edges']> = [];
  let totalDisplayCost = 0;
  const alternativeEvaluations: Record<string, AlternativeEdgeEvaluation[]> = {};

  let lastSignalNode: { lat: number; lng: number } | null = null;
  let lastYieldNode: { lat: number; lng: number } | null = null;
  let lastStopNode: { lat: number; lng: number } | null = null;
  let lastCrossingNode: { lat: number; lng: number } | null = null;

  // Precompute remaining metrics along the chosen path from each index
  const remainingDurations = new Array<number>(pathNodeIds.length).fill(0);
  const remainingDistances = new Array<number>(pathNodeIds.length).fill(0);
  const remainingSignals = new Array<number>(pathNodeIds.length).fill(0);

  let accumulatedDistance = 0;
  let accumulatedDuration = 0;
  let accumulatedSignals = 0;

  for (let k = pathNodeIds.length - 1; k >= 0; k--) {
    const nodeId = pathNodeIds[k];
    let nNode: GraphNode | undefined;
    let curEdges: GraphEdge[] = [];
    if (virtualConfig && nodeId === 'virtual-start') {
      nNode = virtualConfig.startNode;
      curEdges = virtualConfig.startEdges;
    } else if (virtualConfig && nodeId === 'virtual-end') {
      nNode = virtualConfig.endNode;
      curEdges = [];
    } else {
      const entry = graph.nodes.get(nodeId);
      if (entry) {
        nNode = entry.node;
        curEdges = entry.edges;
        if (virtualConfig) {
          const extraEdge = virtualConfig.endVirtualEdges.get(nodeId);
          if (extraEdge) curEdges = [...curEdges, extraEdge];
        }
      }
    }

    if (nNode) {
      const nodeTags = nNode.tags || {};
      if (mapOSMNodeToControl(nodeTags) === 'signal') {
        accumulatedSignals++;
      }

      if (k < pathNodeIds.length - 1) {
        const nextNodeId = pathNodeIds[k + 1];
        const edge = curEdges.find((e) => e.target === nextNodeId);
        if (edge) {
          accumulatedDistance += edge.distance;
          accumulatedDuration += calculateDisplayCost(nodeId, edge, nextNodeId, overrides, graph);

          if (k > 0) {
            const parentId = pathNodeIds[k - 1];
            let pNode: GraphNode | undefined;
            if (virtualConfig && parentId === 'virtual-start') {
              pNode = virtualConfig.startNode;
            } else if (virtualConfig && parentId === 'virtual-end') {
              pNode = virtualConfig.endNode;
            } else {
              pNode = graph.nodes.get(parentId)?.node;
            }
            const nextNNode = graph.nodes.get(nextNodeId)?.node;
            if (pNode && nextNNode) {
              const rulesConfig = overrides.rulesConfig ?? DEFAULT_RULES_CONFIG;
              accumulatedDuration += getEffectiveTurnPenalty(
                pNode,
                nNode,
                nextNNode,
                overrides,
                rulesConfig,
              );
            }
          }
        }
      }
    }

    remainingDistances[k] = accumulatedDistance;
    remainingDurations[k] = accumulatedDuration;
    remainingSignals[k] = accumulatedSignals;
  }

  for (let i = 0; i < pathNodeIds.length; i++) {
    const nodeId = pathNodeIds[i];
    let currentNode: GraphNode | undefined;
    let currentEdges: GraphEdge[] = [];

    if (virtualConfig && nodeId === 'virtual-start') {
      currentNode = virtualConfig.startNode;
      currentEdges = virtualConfig.startEdges;
    } else if (virtualConfig && nodeId === 'virtual-end') {
      currentNode = virtualConfig.endNode;
      currentEdges = [];
    } else {
      const entry = graph.nodes.get(nodeId);
      if (entry) {
        currentNode = entry.node;
        currentEdges = entry.edges;
        if (virtualConfig) {
          const extraEdge = virtualConfig.endVirtualEdges.get(nodeId);
          if (extraEdge) {
            currentEdges = [...currentEdges, extraEdge];
          }
        }
      }
    }

    if (!currentNode) continue;
    coordinates.push({ lat: currentNode.lat, lng: currentNode.lng });

    if (currentEdges.length > 0) {
      const evals: AlternativeEdgeEvaluation[] = [];
      const backwardNodeId = i > 0 ? pathNodeIds[i - 1] : null;

      let parentNode: GraphNode | undefined;
      if (i > 0 && backwardNodeId) {
        if (virtualConfig && backwardNodeId === 'virtual-start') {
          parentNode = virtualConfig.startNode;
        } else if (virtualConfig && backwardNodeId === 'virtual-end') {
          parentNode = virtualConfig.endNode;
        } else {
          parentNode = graph.nodes.get(backwardNodeId)?.node;
        }
      }

      for (const edge of currentEdges) {
        if (backwardNodeId && edge.target === backwardNodeId) {
          continue;
        }

        let neighborNode: GraphNode | undefined;
        if (virtualConfig && edge.target === 'virtual-start') {
          neighborNode = virtualConfig.startNode;
        } else if (virtualConfig && edge.target === 'virtual-end') {
          neighborNode = virtualConfig.endNode;
        } else {
          neighborNode = graph.nodes.get(edge.target)?.node;
        }

        let turnPenalty = 0;
        let isUTurn = false;
        if (parentNode && currentNode && neighborNode) {
          const rulesConfig = overrides.rulesConfig ?? DEFAULT_RULES_CONFIG;
          turnPenalty = getEffectiveTurnPenalty(
            parentNode,
            currentNode,
            neighborNode,
            overrides,
            rulesConfig,
          );
          isUTurn = getTurnDetails(parentNode, currentNode, neighborNode).direction === 'u-turn';
        }

        // Exclude U-turns (angle > 135 degrees)
        if (isUTurn) {
          continue;
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

        evaluation.chosenRemainingDuration = remainingDurations[i];
        evaluation.chosenRemainingDistance = remainingDistances[i];
        evaluation.chosenRemainingSignals = remainingSignals[i];

        evals.push(evaluation);
      }
      alternativeEvaluations[nodeId] = evals;
    }

    const tags = currentNode.tags || {};
    const controlType = mapOSMNodeToControl(tags);

    if (controlType) {
      const isNewCluster = (lastNode: { lat: number; lng: number } | null) => {
        if (!lastNode) return true;
        return haversineDistance(lastNode.lat, lastNode.lng, currentNode.lat, currentNode.lng) > 35;
      };

      if (controlType === 'signal' && isNewCluster(lastSignalNode)) {
        trafficSignalsCount++;
        signalCount++;
        lastSignalNode = { lat: currentNode.lat, lng: currentNode.lng };
      } else if (controlType === 'yield' && isNewCluster(lastYieldNode)) {
        yieldCount++;
        lastYieldNode = { lat: currentNode.lat, lng: currentNode.lng };
      } else if (controlType === 'stop' && isNewCluster(lastStopNode)) {
        lastStopNode = { lat: currentNode.lat, lng: currentNode.lng };
      } else if (controlType === 'crossing' && isNewCluster(lastCrossingNode)) {
        crossingCount++;
        lastCrossingNode = { lat: currentNode.lat, lng: currentNode.lng };
      }
    }

    if (i < pathNodeIds.length - 1) {
      const nextNodeId = pathNodeIds[i + 1];
      const edge = currentEdges.find((e) => e.target === nextNodeId);
      if (edge) {
        totalDistanceMeters += edge.distance;
        if (edge.name) {
          streetsSet.add(edge.name);
        }
        const displayCost = calculateDisplayCost(nodeId, edge, nextNodeId, overrides, graph);

        let turnPenalty = 0;
        if (i > 0) {
          const parentId = pathNodeIds[i - 1];
          let parentNode: GraphNode | undefined;
          if (virtualConfig && parentId === 'virtual-start') {
            parentNode = virtualConfig.startNode;
          } else if (virtualConfig && parentId === 'virtual-end') {
            parentNode = virtualConfig.endNode;
          } else {
            parentNode = graph.nodes.get(parentId)?.node;
          }

          let nextNode: GraphNode | undefined;
          if (virtualConfig && nextNodeId === 'virtual-start') {
            nextNode = virtualConfig.startNode;
          } else if (virtualConfig && nextNodeId === 'virtual-end') {
            nextNode = virtualConfig.endNode;
          } else {
            nextNode = graph.nodes.get(nextNodeId)?.node;
          }

          if (parentNode && nextNode) {
            const rulesConfig = overrides.rulesConfig ?? DEFAULT_RULES_CONFIG;
            turnPenalty = getEffectiveTurnPenalty(
              parentNode,
              currentNode,
              nextNode,
              overrides,
              rulesConfig,
            );
          }
        }

        totalDisplayCost += displayCost + turnPenalty;

        const cat = getRoadTypeCategory(edge.tags.highway || 'unknown', edge.tags);
        roadTypeTotals[cat] = (roadTypeTotals[cat] || 0) + edge.distance;

        const surfaceType = getSurfaceType(edge.tags);
        surfaceTotals[surfaceType] += edge.distance;

        const { sign: matchedSign, road: matchedRoad } = mapOSMToSignAndRoad(
          edge.tags.highway || '',
          edge.tags,
        );
        edgesDetails.push({
          sourceId: nodeId,
          targetId: nextNodeId,
          name: edge.name || 'Unnamed Street',
          distance: edge.distance,
          highway: edge.tags.highway || 'unknown',
          tags: edge.tags,
          cost: displayCost + turnPenalty,
          matchedSign,
          matchedRoad,
        });
      }
    }
  }

  return {
    pathNodeIds,
    coordinates,
    totalDistanceMeters,
    streets: Array.from(streetsSet),
    trafficSignalsCount,
    signalCount,
    yieldCount,
    crossingCount,
    roadTypeTotals,
    surfaceTotals,
    edges: edgesDetails,
    totalDisplayCost,
    alternativeEvaluations,
  };
}
