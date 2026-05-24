import type { StreetGraph, GraphEdge, GraphNode } from '../graph/types';
import type { Coordinate } from '../common/types';
import type { LocalOverrides } from '../storage/types';
import type { IRouter, CostFunction, RouteResult } from './types';
import { haversineDistance } from '../graph/parser';
import { mapOSMToSignAndRoad, mapOSMNodeToControl, hasCycleway } from './rules';
import { calculateDisplayCost } from './cost';
import { MinHeap } from '../common/MinHeap';
import {
  calculateTurnPenalty,
  findNearestNode,
  projectPointOnSegment,
  getProjectionT,
  findNearestEdge,
} from '../common/geometry';

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

export class DijkstraRouter implements IRouter {
  private runDijkstra(
    graph: StreetGraph,
    startId: string,
    endId: string,
    costFn: CostFunction,
    overrides: LocalOverrides,
  ): { destReached: boolean; previous: Map<string, string> } {
    const distances = new Map<string, number>();
    const previous = new Map<string, string>();
    const visited = new Set<string>();
    const heap = new MinHeap<string>();

    distances.set(startId, 0);
    heap.push(startId, 0);

    for (const nodeId of graph.nodes.keys()) {
      if (nodeId !== startId) {
        distances.set(nodeId, Infinity);
      }
    }

    let destReached = false;

    while (!heap.isEmpty()) {
      const currentId = heap.pop();
      if (!currentId) break;

      if (currentId === endId) {
        destReached = true;
        break;
      }

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentEntry = graph.nodes.get(currentId);
      if (!currentEntry) continue;

      const currentDist = distances.get(currentId) || 0;

      for (const edge of currentEntry.edges) {
        const neighborId = edge.target;
        if (visited.has(neighborId)) continue;

        let edgeCost = costFn(currentId, edge, neighborId, overrides, graph);

        const parentId = previous.get(currentId);
        if (parentId) {
          const parentEntry = graph.nodes.get(parentId);
          const neighborEntry = graph.nodes.get(neighborId);
          if (parentEntry && neighborEntry) {
            edgeCost += calculateTurnPenalty(
              parentEntry.node,
              currentEntry.node,
              neighborEntry.node,
            );
          }
        }

        const altDist = currentDist + edgeCost;

        if (altDist < (distances.get(neighborId) || Infinity)) {
          distances.set(neighborId, altDist);
          previous.set(neighborId, currentId);
          heap.push(neighborId, altDist);
        }
      }
    }

    return { destReached, previous };
  }

  private buildRouteStatistics(
    graph: StreetGraph,
    previous: Map<string, string>,
    endId: string,
    overrides: LocalOverrides,
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
    edges: NonNullable<RouteResult['edges']>;
    totalDisplayCost: number;
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
    const streetsSet = new Set<string>();
    const edgesDetails: NonNullable<RouteResult['edges']> = [];
    let totalDisplayCost = 0;

    for (let i = 0; i < pathNodeIds.length; i++) {
      const nodeId = pathNodeIds[i];
      const entry = graph.nodes.get(nodeId);
      if (!entry) continue;
      coordinates.push({ lat: entry.node.lat, lng: entry.node.lng });

      const tags = entry.node.tags || {};
      const controlType = mapOSMNodeToControl(tags);
      if (controlType === 'signal') {
        trafficSignalsCount++;
        signalCount++;
      } else if (controlType === 'yield') {
        yieldCount++;
      } else if (controlType === 'crossing') {
        crossingCount++;
      }

      if (i < pathNodeIds.length - 1) {
        const nextNodeId = pathNodeIds[i + 1];
        const edge = entry.edges.find((e) => e.target === nextNodeId);
        if (edge) {
          totalDistanceMeters += edge.distance;
          if (edge.name) {
            streetsSet.add(edge.name);
          }
          const displayCost = calculateDisplayCost(nodeId, edge, nextNodeId, overrides, graph);

          let turnPenalty = 0;
          if (i > 0) {
            const parentId = pathNodeIds[i - 1];
            const parentEntry = graph.nodes.get(parentId);
            const nextEntry = graph.nodes.get(nextNodeId);
            if (parentEntry && nextEntry) {
              turnPenalty = calculateTurnPenalty(parentEntry.node, entry.node, nextEntry.node);
            }
          }

          totalDisplayCost += displayCost + turnPenalty;

          const cat = getRoadTypeCategory(edge.tags.highway || 'unknown', edge.tags);
          roadTypeTotals[cat] = (roadTypeTotals[cat] || 0) + edge.distance;

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
      edges: edgesDetails,
      totalDisplayCost,
    };
  }

  findRoute(
    graph: StreetGraph,
    start: Coordinate,
    end: Coordinate,
    costFn: CostFunction,
    overrides: LocalOverrides,
  ): RouteResult | null {
    const startEdgeRef = findNearestEdge(graph, start);
    const endEdgeRef = findNearestEdge(graph, end);

    // If we can't find nearest edges (e.g. empty/invalid graph), fall back to node snapping
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
      console.warn('Virtual routing reference nodes missing from graph. Falling back.');
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

    const backupNodes = new Map<string, GraphEdge[]>();
    const backupNodeEdges = (nodeId: string) => {
      if (backupNodes.has(nodeId)) return;
      const entry = graph.nodes.get(nodeId);
      if (entry) {
        backupNodes.set(nodeId, [...entry.edges]);
      }
    };

    try {
      // 1. Inject virtual start/end nodes
      graph.nodes.set(START_VNODE_ID, { node: virtualStartNode, edges: [] });
      graph.nodes.set(END_VNODE_ID, { node: virtualEndNode, edges: [] });

      // 2. Add outgoing edges from virtual-start
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

      // Edge UV_S (virtual-start -> V_s)
      graph.nodes.get(START_VNODE_ID)!.edges.push({
        target: startVId,
        distance: distToVs,
        name: startEdge.name,
        speedLimit: startEdge.speedLimit,
        tags: startEdge.tags,
      });

      // Edge VU_S (virtual-start -> U_s if bidirectional)
      const startEdgeVU = graph.nodes.get(startVId)?.edges.find((e) => e.target === startUId);
      if (startEdgeVU) {
        graph.nodes.get(START_VNODE_ID)!.edges.push({
          target: startUId,
          distance: distToUs,
          name: startEdgeVU.name,
          speedLimit: startEdgeVU.speedLimit,
          tags: startEdgeVU.tags,
        });
      }

      // 3. Add incoming edges to virtual-end
      const distUToE = haversineDistance(endUNode.lat, endUNode.lng, endProj.lat, endProj.lng);
      const distVToE = haversineDistance(endVNode.lat, endVNode.lng, endProj.lat, endProj.lng);

      backupNodeEdges(endUId);
      graph.nodes.get(endUId)!.edges.push({
        target: END_VNODE_ID,
        distance: distUToE,
        name: endEdge.name,
        speedLimit: endEdge.speedLimit,
        tags: endEdge.tags,
      });

      const endEdgeVU = graph.nodes.get(endVId)?.edges.find((e) => e.target === endUId);
      if (endEdgeVU) {
        backupNodeEdges(endVId);
        graph.nodes.get(endVId)!.edges.push({
          target: END_VNODE_ID,
          distance: distVToE,
          name: endEdgeVU.name,
          speedLimit: endEdgeVU.speedLimit,
          tags: endEdgeVU.tags,
        });
      }

      // 4. Handle same-edge direct routing
      const sameEdge =
        (startUId === endUId && startVId === endVId) ||
        (startUId === endVId && startVId === endUId);
      if (sameEdge) {
        const ts = getProjectionT(start, startUNode, startVNode);
        const te = getProjectionT(end, startUNode, startVNode);

        if (ts <= te) {
          graph.nodes.get(START_VNODE_ID)!.edges.push({
            target: END_VNODE_ID,
            distance: haversineDistance(startProj.lat, startProj.lng, endProj.lat, endProj.lng),
            name: startEdge.name,
            speedLimit: startEdge.speedLimit,
            tags: startEdge.tags,
          });
        }

        if (ts >= te && startEdgeVU) {
          graph.nodes.get(START_VNODE_ID)!.edges.push({
            target: END_VNODE_ID,
            distance: haversineDistance(startProj.lat, startProj.lng, endProj.lat, endProj.lng),
            name: startEdgeVU.name,
            speedLimit: startEdgeVU.speedLimit,
            tags: startEdgeVU.tags,
          });
        }
      }

      // 5. Run Dijkstra search loop
      const { destReached, previous } = this.runDijkstra(
        graph,
        START_VNODE_ID,
        END_VNODE_ID,
        costFn,
        overrides,
      );

      if (!destReached) {
        console.warn('Destination node is unreachable from source node');
        return null;
      }

      // 6. Reconstruct the path and calculate statistics
      const stats = this.buildRouteStatistics(graph, previous, END_VNODE_ID, overrides);

      // Add start/end coordinates to the path with duplicate cleaning
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

      // Add out-of-network interpolation segments to stats
      const startInterpDist = haversineDistance(start.lat, start.lng, startProj.lat, startProj.lng);
      const endInterpDist = haversineDistance(end.lat, end.lng, endProj.lat, endProj.lng);

      const totalDistanceMeters = stats.totalDistanceMeters + startInterpDist + endInterpDist;

      const startInterpDuration = startInterpDist / 1.5;
      const endInterpDuration = endInterpDist / 1.5;
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
        edges: stats.edges,
      };
    } finally {
      // 7. Restore the graph to pristine state
      for (const [nodeId, originalEdges] of backupNodes.entries()) {
        const entry = graph.nodes.get(nodeId);
        if (entry) {
          entry.edges = originalEdges;
        }
      }
      graph.nodes.delete(START_VNODE_ID);
      graph.nodes.delete(END_VNODE_ID);
    }
  }

  private findRouteNodeFallback(
    graph: StreetGraph,
    start: Coordinate,
    end: Coordinate,
    costFn: CostFunction,
    overrides: LocalOverrides,
  ): RouteResult | null {
    // 1. Snap start/end coords to nearest nodes
    const startNodeId = findNearestNode(graph, start);
    const endNodeId = findNearestNode(graph, end);

    if (!startNodeId || !endNodeId) {
      console.error('Could not find start or end nodes in graph');
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
      };
    }

    // 2. Run Dijkstra search loop
    const { destReached, previous } = this.runDijkstra(
      graph,
      startNodeId,
      endNodeId,
      costFn,
      overrides,
    );

    if (!destReached) {
      console.warn('Destination node is unreachable from source node');
      return null;
    }

    // 3. Reconstruct the path and calculate statistics
    const stats = this.buildRouteStatistics(graph, previous, endNodeId, overrides);

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

      // Clean consecutive duplicates
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
      edges: stats.edges,
    };
  }
}
