import { ROUTING_CONFIG } from '../common/constants';
import {
  calculateTurnPenalty,
  findNearestEdge,
  findNearestNode,
  getProjectionT,
  projectPointOnSegment,
} from '../common/geometry';
import { logger } from '../common/logger';
import { MinHeap } from '../common/MinHeap';
import type { Coordinate } from '../common/types';
import { haversineDistance } from '../graph/parser';
import type { GraphEdge, GraphNode, StreetGraph } from '../graph/types';
import type { LocalOverrides } from '../storage/types';
import { calculateDisplayCost, evaluateEdge, standardCost } from './cost';
import { getSurfaceType, hasCycleway, mapOSMNodeToControl, mapOSMToSignAndRoad } from './rules';
import type { AlternativeEdgeEvaluation, CostFunction, IRouter, RouteResult } from './types';

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
      nodeIdToInt.set(startId, idx);
      intToNodeId[idx] = startId;
      idx++;

      nodeIdToInt.set(endId, idx);
      intToNodeId[idx] = endId;
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

      if (virtualConfig && currentId === startId) {
        currentNode = virtualConfig.startNode;
        currentEdges = virtualConfig.startEdges;
      } else if (virtualConfig && currentId === endId) {
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
          if (virtualConfig && parentId === startId) {
            parentNode = virtualConfig.startNode;
          } else if (virtualConfig && parentId === endId) {
            parentNode = virtualConfig.endNode;
          } else {
            parentNode = graph.nodes.get(parentId)?.node;
          }

          let neighborNode: GraphNode | undefined;
          if (virtualConfig && neighborId === startId) {
            neighborNode = virtualConfig.startNode;
          } else if (virtualConfig && neighborId === endId) {
            neighborNode = virtualConfig.endNode;
          } else {
            neighborNode = graph.nodes.get(neighborId)?.node;
          }

          if (parentNode && neighborNode) {
            edgeCost += calculateTurnPenalty(parentNode, currentNode, neighborNode);
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

  private buildRouteStatistics(
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
                accumulatedDuration += calculateTurnPenalty(pNode, nNode, nextNNode);
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
          if (parentNode && currentNode && neighborNode) {
            turnPenalty = calculateTurnPenalty(parentNode, currentNode, neighborNode);
          }

          // Exclude U-turns (angle > 135 degrees)
          if (parentNode && turnPenalty === ROUTING_CONFIG.U_TURN_PENALTY_SECONDS) {
            continue;
          }

          // Run Dijkstra projection from the alternative target to the route destination
          const { destReached, previous: prevAlt } = this.runDijkstra(
            graph,
            edge.target,
            endId,
            costFn || standardCost,
            overrides,
            virtualConfig,
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
              if (virtualConfig && nId === 'virtual-start') {
                nNode = virtualConfig.startNode;
              } else if (virtualConfig && nId === 'virtual-end') {
                nNode = virtualConfig.endNode;
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
                  let nextNodeEdges: GraphEdge[];
                  if (virtualConfig && nId === 'virtual-start') {
                    nextNodeEdges = virtualConfig.startEdges;
                  } else {
                    const baseEdges = graph.nodes.get(nId)?.edges || [];
                    const extraEdge = virtualConfig?.endVirtualEdges.get(nId);
                    nextNodeEdges =
                      virtualConfig && extraEdge ? [...baseEdges, extraEdge] : baseEdges;
                  }

                  const nextEdge = nextNodeEdges.find((e) => e.target === nextNId);
                  if (nextEdge) {
                    altDistanceMeters += nextEdge.distance;
                    altDurationSeconds += calculateDisplayCost(
                      nId,
                      nextEdge,
                      nextNId,
                      overrides,
                      graph,
                    );

                    if (j > 0) {
                      const pId = path[j - 1];
                      let pNode: GraphNode | undefined;
                      if (virtualConfig && pId === 'virtual-start') {
                        pNode = virtualConfig.startNode;
                      } else if (virtualConfig && pId === 'virtual-end') {
                        pNode = virtualConfig.endNode;
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
            const firstNode = graph.nodes.get(nodeId)?.node;
            const fullCoords = firstNode
              ? [{ lat: firstNode.lat, lng: firstNode.lng }, ...altCoordinates]
              : altCoordinates;

            evaluation.altPathNodeIds = altPathNodeIds;
            evaluation.altCoordinates = fullCoords;
            evaluation.altDurationSeconds =
              evaluation.displayCostSeconds + turnPenalty + altDurationSeconds;
            evaluation.altDistanceMeters = altDistanceMeters;
            evaluation.altSignalCount = altSignalCount;
          }

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
          return (
            haversineDistance(lastNode.lat, lastNode.lng, currentNode.lat, currentNode.lng) > 35
          );
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
              turnPenalty = calculateTurnPenalty(parentNode, currentNode, nextNode);
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

    const stats = this.buildRouteStatistics(
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
      alternativeEvaluations: stats.alternativeEvaluations,
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

    const stats = this.buildRouteStatistics(graph, previous, endNodeId, costFn, overrides);

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
      alternativeEvaluations: stats.alternativeEvaluations,
    };
  }
}
